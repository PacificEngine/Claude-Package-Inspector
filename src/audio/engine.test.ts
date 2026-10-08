import { describe, expect, it } from 'vitest';
import { createAudioEngine } from './engine';
import { DEFAULT_TRACK_ID, TRACKS } from './music';

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

describe('track and auto-play settings', () => {
  it('defaults to auto-play on, starting with the default track', () => {
    expect(createAudioEngine(fakeStorage()).getTrackState()).toEqual({
      trackId: DEFAULT_TRACK_ID,
      autoPlay: true,
    });
  });

  it('remembers the chosen track and auto-play setting', () => {
    const store = fakeStorage();
    const engine = createAudioEngine(store);
    engine.selectTrack(TRACKS[2].id);
    engine.setAutoPlay(false);
    expect(createAudioEngine(store).getTrackState()).toEqual({
      trackId: TRACKS[2].id,
      autoPlay: false,
    });
  });

  it('keeps auto-play on when a track is picked by hand', () => {
    const engine = createAudioEngine(fakeStorage());
    engine.selectTrack(TRACKS[1].id);
    expect(engine.getTrackState()).toEqual({ trackId: TRACKS[1].id, autoPlay: true });
  });

  it('ignores a saved track that no longer exists', () => {
    const store = fakeStorage({ 'packinspect.track': 'gone', 'packinspect.autoplay': '1' });
    expect(createAudioEngine(store).getTrackState().trackId).toBe(DEFAULT_TRACK_ID);
  });

  it('tells listeners when the track changes', () => {
    const engine = createAudioEngine(fakeStorage());
    const seen: string[] = [];
    engine.onTrackChange((id) => seen.push(id));
    engine.selectTrack(TRACKS[3].id);
    expect(seen).toEqual([TRACKS[3].id]);
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
    expect(() => {
      engine.selectTrack(TRACKS[1].id);
      engine.setAutoPlay(false);
    }).not.toThrow();
    expect(engine.getTrackState()).toEqual({ trackId: TRACKS[1].id, autoPlay: false });
  });
});

