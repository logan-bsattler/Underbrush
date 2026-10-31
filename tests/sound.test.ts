import { describe, expect, it } from 'vitest';
import { bustAt, dispatch, hazardsNear, newGame, standardPerks, type GameState } from '../src/core';
import { audioSettings, play, setAudio, setScene, soundFor } from '../src/ui/sound';

describe('sound', () => {
  it('never throws without Web Audio or storage', () => {
    expect(audioSettings()).toEqual({ sound: true, music: true });
    expect(() => {
      play('flip');
      play('harvest', 4);
      setScene('winter');
      setAudio({ music: false });
      setAudio({ sound: false, music: true });
    }).not.toThrow();
    expect(audioSettings()).toEqual({ sound: false, music: true });
  });

  it('cues a sound for the moments of a forage trip', () => {
    let g: GameState = newGame({ mode: 'daily', seed: 'sound-test', perks: standardPerks() });
    const forage = dispatch(g, { type: 'forage', zone: 'meadow' });
    expect(soundFor({ type: 'forage', zone: 'meadow' }, forage.result, forage.state)?.sfx).toBe('setOut');
    g = forage.state;
    const flip = dispatch(g, { type: 'flip', index: 0 });
    expect(flip.result.kind).toBe('draw');
    expect(soundFor({ type: 'flip', index: 0 }, flip.result, flip.state)).not.toBeNull();
  });

  it('maps draw outcomes to their sounds', () => {
    const g = newGame({ mode: 'daily', seed: 'sound-test', perks: standardPerks() });
    const draw = (outcome: any) => soundFor({ type: 'flip', index: 0 }, { kind: 'draw', index: 0, card: { type: 'hazard' } as any, outcome }, g)?.sfx;
    expect(draw('bust')).toBe('bust');
    expect(draw('hazard')).toBe('hazard');
    expect(draw('wayDown')).toBe('wayDown');
    expect(draw('artifact')).toBe('rare');
    expect(draw('coins')).toBe('coins');
    expect(draw('known')).toBe('find');
    expect(draw('nothing')).toBe('flip');
    expect(soundFor({ type: 'harvest' }, { kind: 'harvest', gained: {}, squares: [1, 2, 3] }, g)).toEqual({ sfx: 'harvest', n: 3 });
    expect(soundFor({ type: 'festival' }, { kind: 'none' }, g)?.sfx).toBe('festival');
  });

  describe('hazard knocks', () => {
    const h = { type: 'hazard', name: 'Ticks' } as const;
    const ground = { type: 'ground', name: 'Leaf Litter', look: 'ground' } as const;
    // Hazards above and left of the centre (neighbours are side by side, not diagonal); ground everywhere else.
    function patchTrip(gear: string[] = []): GameState {
      const g = dispatch(newGame({ mode: 'daily', seed: 'knock-test', perks: standardPerks() }), { type: 'forage', zone: 'meadow' }).state;
      g.forage!.patch = [ground, h, ground, h, ground, ground, ground, ground, ground].map((card) => ({ card, flipped: false, outcome: null }));
      g.gear.push(...(gear as any));
      return g;
    }
    const turn = (g: GameState, index: number) => {
      const { state, result } = dispatch(g, { type: 'flip', index });
      return { state, cue: soundFor({ type: 'flip', index }, result, state) };
    };

    it('knocks once for each hazard beside a turned card, and stays quiet on a 0', () => {
      const g = patchTrip();
      const centre = turn(g, 4);
      expect(centre.cue).toMatchObject({ sfx: 'flip', near: hazardsNear(centre.state.forage!, 4), edge: false, under: false });
      expect(centre.cue?.near).toBe(2);
      expect(turn(centre.state, 8).cue).toEqual({ sfx: 'flip' });
    });

    it('never knocks for a hazard, a hazard the Knife ignores or a bust', () => {
      const first = turn(patchTrip(), 1);
      expect(first.cue).toEqual({ sfx: 'hazard' });
      expect(turn(first.state, 3).cue).toEqual({ sfx: 'bust' });
      expect(turn(patchTrip(['knife']), 1).cue).toEqual({ sfx: 'hazard' });
    });

    it('drops to the edge one hazard below a bust, unless the Knife is still unspent', () => {
      const hit = turn(patchTrip(), 1).state;
      expect(hit.forage!.hazards).toBe(bustAt(hit) - 1);
      expect(turn(hit, 0).cue).toMatchObject({ near: 2, edge: true });
      const knifed = patchTrip(['knife']);
      knifed.forage!.hazards = bustAt(knifed) - 1;
      expect(turn(knifed, 4).cue).toMatchObject({ near: 2, edge: false });
      knifed.forage!.knifeUsed = true;
      expect(turn(knifed, 4).cue).toMatchObject({ near: 2, edge: true });
    });

    it('echoes more below ground', () => {
      const g = patchTrip();
      g.forage!.layer = 1;
      g.forage!.patch[4].deep = true;
      expect(turn(g, 4).cue?.under).toBe(true);
    });

    it('never throws without Web Audio', () => {
      setAudio({ sound: true });
      expect(() => {
        play('find', 1, { sfx: 'find', near: 3, edge: true, under: true });
        play('flip', 1, { sfx: 'flip', near: 6 });
      }).not.toThrow();
    });
  });
});
