import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAudioEngine } from './engine';
import { TRACKS } from './music';

// Just enough Web Audio for the scheduler to run, with a clock the test controls.
class FakeParam {
  value = 0;
  setValueAtTime(): void {}
  exponentialRampToValueAtTime(): void {}
  setTargetAtTime(): void {}
}
class FakeNode {
  gain = new FakeParam();
  frequency = new FakeParam();
  detune = new FakeParam();
  type = '';
  buffer: unknown = null;
  connect(): void {}
  start(): void {}
  stop(): void {}
}
let clock = 0;
class FakeContext {
  state = 'running';
  sampleRate = 8000;
  destination = new FakeNode();
  get currentTime(): number {
    return clock;
  }
  createGain = () => new FakeNode();
  createBiquadFilter = () => new FakeNode();
  createOscillator = () => new FakeNode();
  createBufferSource = () => new FakeNode();
  createBuffer = (_channels: number, length: number) => ({
    getChannelData: () => new Float32Array(length),
  });
  resume(): Promise<void> {
    return Promise.resolve();
  }
}

function startEngine() {
  const engine = createAudioEngine(null);
  const seen: string[] = [];
  engine.onTrackChange((id) => seen.push(id));
  engine.resume();
  return { engine, seen };
}

// Moves the fake clock and lets the scheduler's timer fire once, like a long stretch of real time.
const elapse = (seconds: number): void => {
  clock += seconds;
  vi.advanceTimersByTime(100);
};

beforeEach(() => {
  clock = 0;
  vi.useFakeTimers();
  vi.stubGlobal('window', { AudioContext: FakeContext });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('playback across tracks', () => {
  it('stays on the first track while it is still playing', () => {
    const { engine, seen } = startEngine();
    elapse(60);
    expect(engine.getTrackState().trackId).toBe(TRACKS[0].id);
    expect(seen).toEqual([]);
  });

  it('moves on to the next track when one finishes, with auto-play on', () => {
    const { engine, seen } = startEngine();
    elapse(260); // the default track is a little over three minutes long
    expect(engine.getTrackState().trackId).toBe(TRACKS[1].id);
    expect(seen).toEqual([TRACKS[1].id]);
  });

  it('keeps going through the whole list and back to the start', () => {
    const { engine, seen } = startEngine();
    for (let i = 0; i < 12; i++) elapse(100);
    expect(seen.length).toBeGreaterThanOrEqual(TRACKS.length);
    expect(seen.slice(0, TRACKS.length)).toEqual([...TRACKS.slice(1).map((t) => t.id), TRACKS[0].id]);
    expect(TRACKS.map((t) => t.id)).toContain(engine.getTrackState().trackId);
  });

  it('loops the same track when auto-play is off', () => {
    const { engine, seen } = startEngine();
    engine.setAutoPlay(false);
    elapse(260);
    expect(engine.getTrackState().trackId).toBe(TRACKS[0].id);
    expect(seen).toEqual([]);
  });

  it('plays a picked track now and then carries on to the one after it', () => {
    const { engine, seen } = startEngine();
    engine.selectTrack(TRACKS[2].id);
    expect(seen).toEqual([TRACKS[2].id]);
    elapse(330); // longer than the slowest track
    expect(engine.getTrackState().trackId).toBe(TRACKS[3].id);
    expect(seen).toEqual([TRACKS[2].id, TRACKS[3].id]);
  });

  it('picks up a new day at the end of the track without changing which track plays', () => {
    const { engine, seen } = startEngine();
    engine.setAutoPlay(false);
    engine.setDay(5);
    elapse(260);
    expect(engine.getTrackState().trackId).toBe(TRACKS[0].id);
    expect(seen).toEqual([]);
  });
});
