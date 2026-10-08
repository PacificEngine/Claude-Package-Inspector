import { describe, expect, it } from 'vitest';
import { createAudioEngine } from './engine';

function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
}

describe('createAudioEngine (no audio available, as under test)', () => {
  it('starts unmuted by default', () => {
    expect(createAudioEngine(fakeStorage()).isMuted()).toBe(false);
  });

  it('remembers the mute choice in storage', () => {
    const store = fakeStorage();
    createAudioEngine(store).setMuted(true);
    expect(store.data['packinspect.muted']).toBe('1');
    expect(createAudioEngine(store).isMuted()).toBe(true);
    const again = createAudioEngine(store);
    again.setMuted(false);
    expect(createAudioEngine(store).isMuted()).toBe(false);
  });

  it('survives storage that throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    const engine = createAudioEngine(broken);
    expect(engine.isMuted()).toBe(false);
    expect(() => engine.setMuted(true)).not.toThrow();
    expect(engine.isMuted()).toBe(true);
  });

  it('is a safe no-op without an audio context', () => {
    const engine = createAudioEngine(null);
    expect(() => {
      engine.resume();
      engine.setDay(4);
      engine.play('ship');
    }).not.toThrow();
  });
});
