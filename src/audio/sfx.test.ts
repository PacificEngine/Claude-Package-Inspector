import { describe, expect, it } from 'vitest';
import { SOUND_EVENTS, sfxFor } from './sfx';

describe('sfxFor', () => {
  it('has a non-empty, well-formed sound for every event', () => {
    for (const event of SOUND_EVENTS) {
      const tones = sfxFor(event);
      expect(tones.length).toBeGreaterThan(0);
      for (const t of tones) {
        expect(t.dur).toBeGreaterThan(0);
        expect(t.at).toBeGreaterThanOrEqual(0);
        expect(t.gain).toBeGreaterThan(0);
        expect(t.gain).toBeLessThanOrEqual(1);
        if (t.type !== 'noise') expect(t.freq).toBeGreaterThan(0);
      }
    }
  });

  it('rises for good news and falls for bad news', () => {
    const first = (e: Parameters<typeof sfxFor>[0]) => sfxFor(e);
    const ship = first('ship');
    expect(ship[ship.length - 1].freq).toBeGreaterThan(ship[0].freq);
    const strike = first('strike');
    expect(strike[0].slideTo ?? strike[0].freq).toBeLessThan(strike[0].freq + 1);
  });

  it('makes the day-end jingle longer than a single blip', () => {
    expect(sfxFor('dayEnd').length).toBeGreaterThanOrEqual(4);
  });
});
