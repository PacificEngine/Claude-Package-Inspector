export type SoundEvent = 'ship' | 'reject' | 'strike' | 'fine' | 'repair' | 'buy' | 'dayEnd';

export const SOUND_EVENTS: readonly SoundEvent[] = [
  'ship',
  'reject',
  'strike',
  'fine',
  'repair',
  'buy',
  'dayEnd',
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
  }
}
