import { buildLoop, type Loop } from './music';
import { sfxFor, type SoundEvent, type Tone } from './sfx';

const MUTE_KEY = 'packinspect.muted';
const LOOKAHEAD_SECONDS = 0.35;
const TICK_MS = 100;

export interface AudioEngine {
  /** Call from a user gesture; browsers block audio until then. */
  resume(): void;
  setDay(day: number): void;
  play(event: SoundEvent): void;
  setMuted(muted: boolean): void;
  isMuted(): boolean;
}

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

const midiToHz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

export function createAudioEngine(storage: KeyValueStore | null): AudioEngine {
  let muted = readMuted(storage);
  let day = 1;
  let loop: Loop = buildLoop(day);
  let pendingLoop: Loop | null = null;

  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let music: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let nextStepTime = 0;
  let step = 0;

  const AudioCtor: typeof AudioContext | undefined =
    typeof window === 'undefined'
      ? undefined
      : (window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);

  function applyMute(): void {
    if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.8, ctx.currentTime, 0.05);
  }

  function setup(): void {
    if (ctx || !AudioCtor) return;
    try {
      ctx = new AudioCtor();
    } catch {
      ctx = null;
      return;
    }
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.8;
    master.connect(ctx.destination);

    // A low-pass filter on the music bus is most of the lo-fi sound.
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 1400;
    music = ctx.createGain();
    music.gain.value = 0.35;
    music.connect(lowpass);
    lowpass.connect(master);

    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    nextStepTime = ctx.currentTime + 0.1;
    setInterval(schedule, TICK_MS);
  }

  function osc(
    type: OscillatorType,
    freq: number,
    start: number,
    dur: number,
    gain: number,
    dest: AudioNode,
    detune = 0,
    slideTo?: number,
  ): void {
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
    o.detune.value = detune;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g);
    g.connect(dest);
    o.start(start);
    o.stop(start + dur + 0.05);
  }

  function noiseBurst(start: number, dur: number, gain: number, dest: AudioNode, highpass: number): void {
    if (!ctx || !noise) return;
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const g = ctx.createGain();
    src.buffer = noise;
    filter.type = 'highpass';
    filter.frequency.value = highpass;
    g.gain.setValueAtTime(gain, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(dest);
    src.start(start);
    src.stop(start + dur + 0.02);
  }

  function scheduleStep(index: number, time: number, secondsPerStep: number): void {
    if (!music) return;
    const drift = () => (Math.random() * 2 - 1) * loop.detuneCents;
    for (const chord of loop.chords) {
      if (chord.step !== index) continue;
      for (const midi of chord.notes) {
        osc('triangle', midiToHz(midi), time, chord.length * secondsPerStep, 0.06, music, drift());
      }
    }
    for (const n of loop.bass) {
      if (n.step === index) osc('sine', midiToHz(n.midi), time, n.length * secondsPerStep, 0.22, music);
    }
    for (const n of loop.melody) {
      if (n.step === index) {
        osc('sine', midiToHz(n.midi), time, n.length * secondsPerStep, 0.09, music, drift());
      }
    }
    for (const hit of loop.drums) {
      if (hit.step !== index) continue;
      if (hit.kind === 'kick') osc('sine', 120, time, 0.18, 0.4, music, 0, 45);
      else if (hit.kind === 'snare') noiseBurst(time, 0.12, 0.12, music, 1500);
      else noiseBurst(time, 0.04, 0.05, music, 6000);
    }
  }

  function schedule(): void {
    if (!ctx || ctx.state !== 'running') return;
    while (nextStepTime < ctx.currentTime + LOOKAHEAD_SECONDS) {
      const secondsPerStep = 60 / loop.bpm / 4;
      // Swing the off-beat 16ths a little for the lazy lo-fi feel.
      const swing = step % 2 === 1 ? secondsPerStep * 0.18 : 0;
      scheduleStep(step, nextStepTime + swing, secondsPerStep);
      nextStepTime += secondsPerStep;
      step += 1;
      if (step >= loop.steps) {
        step = 0;
        if (pendingLoop) {
          loop = pendingLoop;
          pendingLoop = null;
        }
      }
    }
  }

  function playTone(t: Tone, base: number): void {
    if (!ctx || !master) return;
    const start = base + t.at;
    if (t.type === 'noise') noiseBurst(start, t.dur, t.gain, master, 800);
    else osc(t.type, t.freq, start, t.dur, t.gain, master, 0, t.slideTo);
  }

  return {
    resume() {
      setup();
      if (ctx && ctx.state === 'suspended') void ctx.resume();
    },
    setDay(next) {
      if (next === day) return;
      day = next;
      // Swap at the next loop boundary so the music never lurches mid-phrase.
      pendingLoop = buildLoop(day);
    },
    play(event) {
      if (muted || !ctx || ctx.state !== 'running') return;
      const base = ctx.currentTime + 0.01;
      for (const tone of sfxFor(event)) playTone(tone, base);
    },
    setMuted(next) {
      muted = next;
      try {
        storage?.setItem(MUTE_KEY, next ? '1' : '0');
      } catch {
        // Storage can be unavailable (private mode); the setting just will not persist.
      }
      applyMute();
    },
    isMuted: () => muted,
  };
}

function readMuted(storage: KeyValueStore | null): boolean {
  try {
    return storage?.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}
