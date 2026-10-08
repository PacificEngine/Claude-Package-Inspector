export type SoundEvent = 'ship' | 'reject' | 'strike' | 'fine' | 'repair' | 'buy' | 'dayEnd' | 'rattle' | 'hum' | 'whisper' | 'tick' | 'slosh' | 'thunder';

export const SOUND_EVENTS: readonly SoundEvent[] = [
  'ship',
  'reject',
  'strike',
  'fine',
  'repair',
  'buy',
  'dayEnd',
  'rattle',
  'hum',
  'whisper',
  'tick',
  'slosh',
  'thunder',
];

export interface Tone {
  type: 'sine' | 'square' | 'triangle' | 'sawtooth' | 'noise';
  freq: number; // ignored for noise
  at: number; // seconds after the event
  dur: number;
  gain: number;
  slideTo?: number;
}

const blip = (freq: number, at: number, dur = 0.12, gain = 0.25): Tone => ({
  type: 'sine',
  freq,
  at,
  dur,
  gain,
});

export function sfxFor(event: SoundEvent): Tone[] {
  switch (event) {
    case 'ship':
      return [blip(660, 0), blip(880, 0.08)];
    case 'reject':
      return [{ type: 'triangle', freq: 220, at: 0, dur: 0.18, gain: 0.3, slideTo: 150 }];
    case 'strike':
      return [{ type: 'square', freq: 160, at: 0, dur: 0.3, gain: 0.2, slideTo: 90 }];
    case 'fine':
      return [blip(520, 0, 0.1), blip(390, 0.1, 0.1), blip(260, 0.2, 0.16)];
    case 'repair':
      return [{ type: 'noise', freq: 0, at: 0, dur: 0.22, gain: 0.25 }, blip(740, 0.22, 0.08, 0.2)];
    case 'buy':
      return [blip(988, 0, 0.07, 0.2), blip(1319, 0.07, 0.14, 0.2)];
    case 'dayEnd':
      return [
        blip(523, 0, 0.18),
        blip(659, 0.16, 0.18),
        blip(784, 0.32, 0.18),
        blip(1047, 0.48, 0.45),
      ];
    case 'rattle':
      return [0, 0.09, 0.17, 0.22, 0.31].map((at) => ({
        type: 'noise' as const,
        freq: 0,
        at,
        dur: 0.05,
        gain: 0.3,
      }));
    case 'hum':
      return [
        { type: 'sine', freq: 110, at: 0, dur: 1.0, gain: 0.25 },
        { type: 'sine', freq: 112, at: 0, dur: 1.0, gain: 0.2 },
      ];
    case 'whisper':
      return [
        { type: 'noise', freq: 0, at: 0, dur: 0.5, gain: 0.1 },
        { type: 'noise', freq: 0, at: 0.55, dur: 0.6, gain: 0.08 },
      ];
    case 'tick':
      return [0, 0.35, 0.7].map((at) => ({
        type: 'square' as const,
        freq: 1800,
        at,
        dur: 0.03,
        gain: 0.15,
      }));
    case 'slosh':
      return [
        { type: 'sine', freq: 300, at: 0, dur: 0.35, gain: 0.2, slideTo: 180 },
        { type: 'sine', freq: 260, at: 0.3, dur: 0.35, gain: 0.18, slideTo: 150 },
      ];
    case 'thunder':
      return [{ type: 'sawtooth', freq: 70, at: 0, dur: 0.9, gain: 0.25, slideTo: 40 }];
  }
}
