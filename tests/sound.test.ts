import { describe, expect, it } from 'vitest';
import { dispatch, newGame, standardPerks, type GameState } from '../src/core';
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
});
