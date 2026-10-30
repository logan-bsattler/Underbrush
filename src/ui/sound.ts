import { useEffect, useState } from 'preact/hooks';
import type { Action, ActionResult, GameState, Season } from '../core';

/**
 * Sound effects and music, all synthesised with the Web Audio API: no audio files to download or license.
 * Nothing here may throw. Audio can be missing, blocked or suspended, and the game plays on silently.
 */

export interface AudioSettings {
  sound: boolean;
  music: boolean;
}

const KEY = 'underbrush:audio:v1';

function load(): AudioSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (raw && typeof raw === 'object') return { sound: raw.sound !== false, music: raw.music !== false };
  } catch {
    // Storage can be blocked (private mode); audio just starts on.
  }
  return { sound: true, music: true };
}

let settings = load();
const listeners = new Set<() => void>();

export function audioSettings(): AudioSettings {
  return settings;
}

/** Turns sound effects or music on or off, and remembers the choice. */
export function setAudio(patch: Partial<AudioSettings>) {
  settings = { ...settings, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Not saved, but it still applies for this visit.
  }
  listeners.forEach((f) => f());
  // The toggle is a tap, so this is a fine moment to start audio, or to stop it.
  if (!settings.music) stopMusic();
  if (settings.sound || settings.music) unlock();
  else safely(() => ctx?.suspend());
}

export function useAudioSettings(): AudioSettings {
  const [s, set] = useState(settings);
  useEffect(() => {
    const f = () => set(settings);
    listeners.add(f);
    return () => void listeners.delete(f);
  }, []);
  return s;
}

function safely(f: () => unknown) {
  try {
    const r = f();
    if (r instanceof Promise) r.catch(() => {});
  } catch {
    // Audio is only flavor.
  }
}

// ---------------------------------------------------------------- the mixer

let ctx: AudioContext | null = null;
let sfxBus: GainNode;
let musicBus: GainNode;
let echoIn: GainNode;

/** Kept quiet by default: the game should sit under whatever else is playing. */
const LEVEL = { master: 0.8, sound: 0.5, music: 0.28 };

function context(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const AC: typeof AudioContext | undefined = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!AC) return null;
    const c = new AC();
    const master = c.createGain();
    master.gain.value = LEVEL.master;
    const limit = c.createDynamicsCompressor();
    master.connect(limit).connect(c.destination);
    sfxBus = c.createGain();
    sfxBus.gain.value = LEVEL.sound;
    sfxBus.connect(master);
    // The music sits behind a soft lowpass, so it stays warm and out of the way.
    const warm = c.createBiquadFilter();
    warm.type = 'lowpass';
    warm.frequency.value = 4200;
    musicBus = c.createGain();
    musicBus.gain.value = LEVEL.music;
    musicBus.connect(warm).connect(master);
    // One shared echo, a little damped each time round, like a clearing in the woods.
    echoIn = c.createGain();
    const delay = c.createDelay(1);
    delay.delayTime.value = 0.38;
    const feedback = c.createGain();
    feedback.gain.value = 0.32;
    const damp = c.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.value = 2200;
    const wet = c.createGain();
    wet.gain.value = 0.5;
    echoIn.connect(delay).connect(damp).connect(feedback).connect(delay);
    damp.connect(wet).connect(master);
    ctx = c;
  } catch {
    ctx = null;
  }
  return ctx;
}

/** Browsers only let audio start from a tap or key press, so every gesture gives it a nudge. */
function unlock() {
  if (!settings.sound && !settings.music) return;
  const c = context();
  if (!c) return;
  if (c.state !== 'running') safely(() => c.resume());
  if (settings.music) startMusic();
}

if (typeof window !== 'undefined') {
  for (const ev of ['pointerdown', 'touchend', 'keydown']) window.addEventListener(ev, unlock, { capture: true, passive: true });
  // Hidden tabs and pocketed phones go quiet.
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) safely(() => ctx!.suspend());
    else if (settings.sound || settings.music) safely(() => ctx!.resume());
  });
}

/** For checking from the console: whether audio is running and the music is on. */
export function audioState() {
  return { context: ctx?.state ?? 'none', music: !!music.timer, scene: music.scene };
}

// ---------------------------------------------------------------- voices

interface Out {
  dry: AudioNode;
  wet: AudioNode;
}

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

function tone(
  c: BaseAudioContext,
  out: Out,
  at: number,
  o: { f: number; to?: number; type?: OscillatorType; dur: number; gain: number; attack?: number; wet?: number; lp?: number; detune?: number },
) {
  const osc = c.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.f, at);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, at + o.dur * 0.8);
  if (o.detune) osc.detune.value = o.detune;
  const g = c.createGain();
  const attack = o.attack ?? 0.005;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(o.gain, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(o.dur, attack + 0.01));
  let src: AudioNode = osc;
  if (o.lp) {
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = o.lp;
    src = osc.connect(f);
  }
  src.connect(g).connect(out.dry);
  if (o.wet) {
    const send = c.createGain();
    send.gain.value = o.wet;
    g.connect(send).connect(out.wet);
  }
  osc.start(at);
  osc.stop(at + o.dur + 0.05);
  return g;
}

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();
function noiseBuffer(c: BaseAudioContext) {
  let b = noiseBuffers.get(c);
  if (!b) {
    b = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseBuffers.set(c, b);
  }
  return b;
}

function noise(
  c: BaseAudioContext,
  out: Out,
  at: number,
  o: { dur: number; gain: number; f: number; to?: number; type?: BiquadFilterType; q?: number; attack?: number; wet?: number },
) {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  const f = c.createBiquadFilter();
  f.type = o.type ?? 'bandpass';
  f.frequency.setValueAtTime(o.f, at);
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, at + o.dur);
  f.Q.value = o.q ?? 1;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(o.gain, at + (o.attack ?? 0.005));
  g.gain.exponentialRampToValueAtTime(0.0001, at + o.dur);
  src.connect(f).connect(g).connect(out.dry);
  if (o.wet) {
    const send = c.createGain();
    send.gain.value = o.wet;
    g.connect(send).connect(out.wet);
  }
  src.start(at, Math.random() * 0.5);
  src.stop(at + o.dur + 0.05);
}

/** A small bell: a sine with a quiet, faster-fading overtone. */
function bell(c: BaseAudioContext, out: Out, at: number, f: number, gain: number, dur = 1.2, wet = 0.3) {
  tone(c, out, at, { f, dur, gain, wet });
  tone(c, out, at, { f: f * 2.76, dur: dur * 0.4, gain: gain * 0.25, wet });
}

// ---------------------------------------------------------------- sound effects

export type Sfx =
  | 'flip'
  | 'find'
  | 'rare'
  | 'coins'
  | 'hazard'
  | 'bust'
  | 'fall'
  | 'wayDown'
  | 'descend'
  | 'deal'
  | 'setOut'
  | 'home'
  | 'page'
  | 'thud'
  | 'water'
  | 'harvest'
  | 'order'
  | 'spend'
  | 'night'
  | 'dawn'
  | 'festival'
  | 'nope';

const effects: Record<Sfx, (c: BaseAudioContext, out: Out, t: number, n: number) => void> = {
  // A card turning on the forest floor: a papery brush.
  flip: (c, out, t) => {
    noise(c, out, t, { dur: 0.09, gain: 0.35, f: 2600, to: 1300, q: 1.2 });
    tone(c, out, t, { f: 420, to: 520, dur: 0.06, gain: 0.03 });
  },
  find: (c, out, t) => {
    effects.flip(c, out, t, 1);
    tone(c, out, t + 0.06, { f: hz(76), type: 'triangle', dur: 0.45, gain: 0.16, wet: 0.15 });
    tone(c, out, t + 0.14, { f: hz(81), type: 'triangle', dur: 0.6, gain: 0.14, wet: 0.2 });
  },
  rare: (c, out, t) => {
    effects.flip(c, out, t, 1);
    [79, 83, 86, 91].forEach((m, i) => bell(c, out, t + 0.06 + i * 0.08, hz(m), 0.11, 1.4, 0.45));
  },
  coins: (c, out, t) => {
    bell(c, out, t, hz(91), 0.09, 0.35, 0.1);
    bell(c, out, t + 0.07, hz(96), 0.08, 0.5, 0.15);
  },
  hazard: (c, out, t) => {
    effects.flip(c, out, t, 1);
    tone(c, out, t + 0.05, { f: hz(57), to: hz(55), type: 'sawtooth', dur: 0.45, gain: 0.1, lp: 700, attack: 0.02 });
    tone(c, out, t + 0.05, { f: hz(58), to: hz(56), type: 'sawtooth', dur: 0.45, gain: 0.07, lp: 600, attack: 0.02 });
  },
  bust: (c, out, t) => {
    noise(c, out, t, { dur: 0.3, gain: 0.6, f: 300, type: 'lowpass', q: 0.7 });
    [67, 64, 60, 55].forEach((m, i) => tone(c, out, t + 0.05 + i * 0.12, { f: hz(m), type: 'triangle', dur: 0.4, gain: 0.13, lp: 1400 }));
  },
  // A bust below ground: the bust, then a short low bump as you land. Soft: it's a scrape, not a disaster.
  fall: (c, out, t) => {
    effects.bust(c, out, t, 1);
    noise(c, out, t + 0.55, { dur: 0.25, gain: 0.35, f: 180, type: 'lowpass' });
    tone(c, out, t + 0.55, { f: 90, to: 55, dur: 0.35, gain: 0.16 });
  },
  // The way down: a hollow breath from somewhere below.
  wayDown: (c, out, t) => {
    effects.flip(c, out, t, 1);
    tone(c, out, t + 0.05, { f: 110, to: 82, dur: 1.1, gain: 0.22, attack: 0.08, wet: 0.3 });
    noise(c, out, t + 0.05, { dur: 0.9, gain: 0.08, f: 500, to: 250, q: 2, attack: 0.2 });
  },
  // Arriving in a layer: a low rumble and a drip echoing off the stone.
  descend: (c, out, t) => {
    tone(c, out, t, { f: 70, to: 48, dur: 1.4, gain: 0.25, attack: 0.1 });
    noise(c, out, t, { dur: 1.2, gain: 0.1, f: 900, to: 200, q: 1.5, attack: 0.15 });
    tone(c, out, t + 0.7, { f: 1400, to: 700, dur: 0.12, gain: 0.08, wet: 0.7 });
  },
  // A fresh patch dealt: a quick riffle of cards.
  deal: (c, out, t, n) => {
    for (let i = 0; i < Math.min(n, 9); i++) noise(c, out, t + i * 0.045, { dur: 0.05, gain: 0.18, f: 2200 + i * 80, to: 1500, q: 1.4 });
  },
  setOut: (c, out, t) => {
    noise(c, out, t, { dur: 0.5, gain: 0.12, f: 4000, to: 1800, type: 'highpass', attack: 0.12 });
    effects.deal(c, out, t + 0.3, 9);
  },
  home: (c, out, t) => {
    noise(c, out, t, { dur: 0.14, gain: 0.35, f: 500, type: 'lowpass' });
    tone(c, out, t, { f: 180, to: 120, dur: 0.18, gain: 0.12 });
  },
  page: (c, out, t) => {
    noise(c, out, t, { dur: 0.28, gain: 0.22, f: 1200, to: 3200, q: 0.8, attack: 0.06 });
  },
  thud: (c, out, t) => {
    noise(c, out, t, { dur: 0.15, gain: 0.4, f: 260, type: 'lowpass' });
    tone(c, out, t, { f: 140, to: 90, dur: 0.18, gain: 0.14 });
  },
  water: (c, out, t) => {
    [0, 0.11, 0.19].forEach((d, i) => tone(c, out, t + d, { f: 800 + i * 150, to: 1500 + i * 200, dur: 0.09, gain: 0.08, wet: 0.2 }));
  },
  // One soft pop per bed picked, climbing.
  harvest: (c, out, t, n) => {
    for (let i = 0; i < Math.min(n, 8); i++) tone(c, out, t + i * 0.09, { f: 420 + i * 60, to: 820 + i * 90, dur: 0.1, gain: 0.12 });
    if (n > 0) tone(c, out, t + Math.min(n, 8) * 0.09 + 0.05, { f: hz(79), type: 'triangle', dur: 0.6, gain: 0.1, wet: 0.2 });
  },
  order: (c, out, t) => {
    [72, 76, 79, 84].forEach((m, i) => bell(c, out, t + i * 0.04, hz(m), 0.08, 1.6, 0.35));
  },
  spend: (c, out, t) => {
    bell(c, out, t, hz(96), 0.07, 0.3, 0.05);
    bell(c, out, t + 0.07, hz(91), 0.07, 0.45, 0.1);
  },
  night: (c, out, t) => {
    bell(c, out, t, hz(67), 0.1, 2.2, 0.5);
    bell(c, out, t + 0.45, hz(62), 0.09, 2.6, 0.5);
  },
  dawn: (c, out, t) => {
    tone(c, out, t, { f: hz(74), type: 'triangle', dur: 0.5, gain: 0.08, attack: 0.04, wet: 0.3 });
    tone(c, out, t + 0.16, { f: hz(79), type: 'triangle', dur: 0.8, gain: 0.08, attack: 0.04, wet: 0.3 });
  },
  festival: (c, out, t) => {
    [65, 69, 72, 77].forEach((m, i) => tone(c, out, t + i * 0.13, { f: hz(m), type: 'triangle', dur: 0.5, gain: 0.13, wet: 0.25 }));
    [77, 81, 84, 89].forEach((m) => bell(c, out, t + 0.6, hz(m), 0.06, 2.4, 0.4));
  },
  nope: (c, out, t) => {
    tone(c, out, t, { f: 190, type: 'triangle', dur: 0.08, gain: 0.08, lp: 900 });
    tone(c, out, t + 0.09, { f: 150, type: 'triangle', dur: 0.12, gain: 0.08, lp: 900 });
  },
};

/** Plays a sound effect now. `n` counts beds for a harvest, cards for a deal. */
export function play(sfx: Sfx, n = 1) {
  if (!settings.sound) return;
  const c = ctx;
  if (!c || c.state !== 'running') return;
  safely(() => effects[sfx](c, { dry: sfxBus, wet: echoIn }, c.currentTime + 0.01, n));
}

export interface Cue {
  sfx: Sfx;
  n?: number;
}

/** The sound for an action the game just took, given its result and the state it left behind. */
export function soundFor(a: Action, r: ActionResult, s: GameState): Cue | null {
  if (r.kind === 'draw') {
    if (r.outcome === 'bust') return { sfx: s.forage?.layer ? 'fall' : 'bust' };
    if (r.outcome === 'hazard' || r.outcome === 'hazardIgnored') return { sfx: 'hazard' };
    if (r.outcome === 'wayDown') return { sfx: 'wayDown' };
    if (r.cleared || r.outcome === 'artifact' || s.forage?.patch[r.index]?.deep) return { sfx: 'rare' };
    if (r.outcome === 'coins') return { sfx: 'coins' };
    if (r.outcome === 'basket' || r.outcome === 'known' || r.outcome === 'swapped') return { sfx: 'find' };
    return { sfx: 'flip' };
  }
  if (r.kind === 'harvest') return { sfx: 'harvest', n: r.squares.length };
  if (r.kind === 'sell') return { sfx: 'coins' };
  if (r.kind === 'order') return { sfx: 'order' };
  if (r.kind === 'night') return { sfx: 'night' };
  if (r.kind === 'identify') return { sfx: 'page' };
  if (r.kind === 'dig') return { sfx: r.dug === 'found' ? 'rare' : r.dug === 'truffle' ? 'find' : 'thud' };
  switch (a.type) {
    case 'forage':
      return { sfx: 'setOut' };
    case 'deeper':
      return { sfx: 'deal', n: 9 };
    case 'descend':
      return { sfx: 'descend' };
    case 'closeTrip':
      return { sfx: 'home' };
    case 'water':
      return { sfx: 'water' };
    case 'plant':
    case 'placeSubstrate':
    case 'clearBlight':
    case 'compostSquare':
    case 'compostBasket':
    case 'discard':
    case 'placeTent':
    case 'moveTent':
      return { sfx: 'thud' };
    case 'buyGear':
    case 'buySpawn':
    case 'buySubstrate':
    case 'hireHand':
    case 'swapOrder':
      return { sfx: 'spend' };
    case 'cook':
    case 'saveSpawn':
      return { sfx: 'find' };
    case 'resolveCross':
      return { sfx: 'rare' };
    case 'festival':
      return { sfx: 'festival' };
    case 'dismissNight':
      return { sfx: 'dawn' };
  }
  return null;
}

// ---------------------------------------------------------------- music

/** What the music is set to: a season on the farm, or somewhere else. */
export type Scene = Season | 'title' | 'night' | 'under' | 'festival';

interface Profile {
  /** MIDI note the scale and chords sit on. */
  root: number;
  scale: number[];
  /** Pad chords, one per bar, in semitones above the root. */
  chords: number[][];
  /** Seconds per step; a bar is eight steps. */
  step: number;
  /** Chance of a melody note on each step. */
  density: number;
  wave: OscillatorType;
  /** Pad filter cutoff: lower is darker. */
  bright: number;
  pad: number;
  bass: boolean;
  /** Chance per step of a drip, underground. */
  drip?: number;
}

const majorPent = [0, 2, 4, 7, 9];
const minorPent = [0, 3, 5, 7, 10];

const profiles: Record<Scene, Profile> = {
  title: { root: 62, scale: majorPent, chords: [[0, 4, 7], [5, 9, 12], [-3, 4, 9], [2, 7, 11]], step: 0.7, density: 0.32, wave: 'triangle', bright: 1600, pad: 0.035, bass: true },
  spring: { root: 62, scale: majorPent, chords: [[0, 4, 7], [5, 9, 12], [-3, 4, 9], [7, 11, 14]], step: 0.55, density: 0.42, wave: 'triangle', bright: 2000, pad: 0.03, bass: true },
  summer: { root: 60, scale: [0, 2, 4, 6, 7, 9], chords: [[0, 4, 7], [2, 6, 9], [0, 4, 9], [-5, 2, 7]], step: 0.5, density: 0.48, wave: 'triangle', bright: 2400, pad: 0.03, bass: true },
  fall: { root: 57, scale: minorPent, chords: [[0, 3, 7], [-4, 3, 8], [-2, 5, 10], [-5, 2, 7]], step: 0.62, density: 0.36, wave: 'triangle', bright: 1500, pad: 0.035, bass: true },
  winter: { root: 64, scale: [0, 2, 3, 7, 10], chords: [[0, 3, 7], [-4, 0, 3], [-7, 0, 5], [-2, 2, 5]], step: 0.78, density: 0.24, wave: 'sine', bright: 1100, pad: 0.04, bass: false },
  night: { root: 55, scale: [0, 2, 5, 7, 9], chords: [[0, 7, 14], [-3, 4, 9]], step: 0.95, density: 0.14, wave: 'sine', bright: 700, pad: 0.03, bass: false },
  under: { root: 50, scale: minorPent, chords: [[0, 7, 15], [-2, 5, 12]], step: 0.85, density: 0.16, wave: 'sine', bright: 650, pad: 0.04, bass: true, drip: 0.1 },
  festival: { root: 65, scale: majorPent, chords: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]], step: 0.42, density: 0.55, wave: 'triangle', bright: 2600, pad: 0.03, bass: true },
};

const music = {
  timer: 0 as ReturnType<typeof setInterval> | 0,
  scene: 'title' as Scene,
  step: 0,
  next: 0,
  note: 5,
  pads: [] as { gain: GainNode; end: number }[],
};

function startMusic() {
  const c = ctx;
  if (!c || music.timer) return;
  musicBus.gain.cancelScheduledValues(c.currentTime);
  musicBus.gain.setValueAtTime(0.0001, c.currentTime);
  musicBus.gain.exponentialRampToValueAtTime(LEVEL.music, c.currentTime + 2);
  music.step = 0;
  music.next = c.currentTime + 0.2;
  music.timer = setInterval(() => safely(tick), 200);
}

function stopMusic() {
  if (!music.timer) return;
  clearInterval(music.timer);
  music.timer = 0;
  safely(() => {
    const c = ctx!;
    musicBus.gain.cancelScheduledValues(c.currentTime);
    musicBus.gain.setValueAtTime(musicBus.gain.value, c.currentTime);
    musicBus.gain.linearRampToValueAtTime(0, c.currentTime + 0.6);
  });
}

/** Sets the music's mood. The change comes in on the next bar, with the old pads fading out under it. */
export function setScene(scene: Scene) {
  if (scene === music.scene) return;
  music.scene = scene;
  const c = ctx;
  if (!c || !music.timer) return;
  safely(() => {
    const now = c.currentTime;
    for (const p of music.pads) {
      if (p.end <= now) continue;
      p.gain.gain.cancelScheduledValues(now);
      p.gain.gain.setValueAtTime(p.gain.gain.value, now);
      p.gain.gain.linearRampToValueAtTime(0, now + 1.5);
    }
    music.pads = [];
    music.step = 0;
    music.next = Math.min(music.next, now + 0.4);
  });
}

function tick() {
  const c = ctx;
  if (!c || c.state !== 'running') return;
  // Timers sleep in background tabs; don't try to catch up on what was missed.
  if (music.next < c.currentTime) music.next = c.currentTime + 0.05;
  while (music.next < c.currentTime + 1) {
    playStep(c, profiles[music.scene], music.step, music.next);
    music.next += profiles[music.scene].step;
    music.step++;
  }
  music.pads = music.pads.filter((p) => p.end > c.currentTime);
}

function playStep(c: AudioContext, p: Profile, step: number, t: number) {
  const out = { dry: musicBus, wet: echoIn };
  const barLen = p.step * 8;
  if (step % 8 === 0) {
    const chord = p.chords[Math.floor(step / 8) % p.chords.length];
    for (const n of chord) pad(c, hz(p.root + n - 12), t, barLen, p);
    if (p.bass) tone(c, out, t, { f: hz(p.root + chord[0] - 24), dur: barLen * 0.8, gain: 0.07, attack: 0.3 });
  }
  if (Math.random() < p.density) {
    // A gentle random walk over two octaves of the scale, so the melody wanders rather than jumps.
    const span = p.scale.length * 2;
    music.note = Math.max(0, Math.min(span - 1, music.note + Math.floor(Math.random() * 5) - 2));
    const semis = p.scale[music.note % p.scale.length] + 12 * Math.floor(music.note / p.scale.length);
    const at = t + Math.random() * 0.03;
    tone(c, out, at, { f: hz(p.root + semis), type: p.wave, dur: p.step * 3, gain: 0.11, wet: 0.35, lp: p.bright * 1.6 });
  }
  if (p.drip && Math.random() < p.drip) tone(c, out, t + p.step / 2, { f: 1500 + Math.random() * 600, to: 700, dur: 0.1, gain: 0.05, wet: 0.8 });
}

function pad(c: AudioContext, f: number, t: number, len: number, p: Profile) {
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(p.pad, t + Math.min(2, len / 3));
  g.gain.setValueAtTime(p.pad, t + len);
  g.gain.linearRampToValueAtTime(0, t + len + 1.6);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = p.bright * 0.5;
  lp.connect(g).connect(musicBus);
  for (const [type, detune] of [['sine', -5], ['triangle', 5]] as const) {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.detune.value = detune;
    o.connect(lp);
    o.start(t);
    o.stop(t + len + 1.7);
  }
  music.pads.push({ gain: g, end: t + len + 1.7 });
}
