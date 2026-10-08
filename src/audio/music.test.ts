import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TRACK_ID,
  STEPS_PER_BAR,
  TRACKS,
  buildTrack,
  detuneCentsForDay,
  eventsByStep,
  isTrackId,
  nextTrackId,
  trackSeconds,
  weirdness,
} from './music';

const DAYS = [1, 2, 3, 4, 5, 6, 7];
const IDS = TRACKS.map((t) => t.id);

describe('weirdness and detune', () => {
  it('starts calm and rises to full by the last day', () => {
    expect(weirdness(1)).toBe(0);
    expect(weirdness(7)).toBe(1);
    expect(detuneCentsForDay(1)).toBe(0);
    expect(detuneCentsForDay(7)).toBeGreaterThan(0);
  });

  it('never decreases as days pass', () => {
    for (let d = 2; d <= 7; d++) {
      expect(detuneCentsForDay(d)).toBeGreaterThanOrEqual(detuneCentsForDay(d - 1));
    }
  });

  it('clamps days outside the campaign', () => {
    expect(weirdness(0)).toBe(0);
    expect(weirdness(99)).toBe(1);
  });
});

describe('the track list', () => {
  it('offers five distinctly named tracks, starting with the default', () => {
    expect(TRACKS).toHaveLength(5);
    expect(new Set(IDS).size).toBe(5);
    expect(new Set(TRACKS.map((t) => t.name)).size).toBe(5);
    expect(DEFAULT_TRACK_ID).toBe(TRACKS[0].id);
  });

  it('recognises valid track ids only', () => {
    for (const id of IDS) expect(isTrackId(id)).toBe(true);
    expect(isTrackId('nope')).toBe(false);
    expect(isTrackId('')).toBe(false);
  });

  it('cycles through every track in order and wraps back to the start', () => {
    const seen: string[] = [];
    let id = DEFAULT_TRACK_ID;
    for (let i = 0; i < TRACKS.length; i++) {
      seen.push(id);
      id = nextTrackId(id);
    }
    expect(seen).toEqual(IDS);
    expect(id).toBe(DEFAULT_TRACK_ID);
  });
});

describe('buildTrack', () => {
  it('is deterministic for a track and day', () => {
    for (const id of IDS) for (const d of DAYS) expect(buildTrack(id, d)).toEqual(buildTrack(id, d));
  });

  it('is a whole number of bars and lasts a few minutes on every day', () => {
    for (const id of IDS) {
      for (const d of DAYS) {
        const track = buildTrack(id, d);
        expect(track.steps % STEPS_PER_BAR).toBe(0);
        expect(trackSeconds(track)).toBeGreaterThanOrEqual(150);
        expect(trackSeconds(track)).toBeLessThanOrEqual(330);
      }
    }
  });

  it('makes the default track much longer than the old 13-second loop', () => {
    expect(trackSeconds(buildTrack(DEFAULT_TRACK_ID, 1))).toBeGreaterThanOrEqual(180);
  });

  it('keeps every event inside the track and every note in a playable range', () => {
    for (const id of IDS) {
      for (const d of DAYS) {
        const track = buildTrack(id, d);
        const events = [...track.chords, ...track.bass, ...track.melody, ...track.drums];
        for (const e of events) {
          expect(e.step).toBeGreaterThanOrEqual(0);
          expect(e.step).toBeLessThan(track.steps);
        }
        const midis = [
          ...track.chords.flatMap((c) => c.notes),
          ...track.bass.map((n) => n.midi),
          ...track.melody.map((n) => n.midi),
        ];
        for (const m of midis) {
          expect(m).toBeGreaterThanOrEqual(30);
          expect(m).toBeLessThanOrEqual(96);
        }
        for (const c of track.chords) expect(c.notes.length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('slows down as the days get stranger', () => {
    for (const id of IDS) expect(buildTrack(id, 7).bpm).toBeLessThan(buildTrack(id, 1).bpm);
  });

  it('carries the detune amount for the day', () => {
    for (const id of IDS) for (const d of DAYS) expect(buildTrack(id, d).detuneCents).toBe(detuneCentsForDay(d));
  });

  it('sounds cozy on day 1: no tritones in any chord of any track', () => {
    for (const id of IDS) {
      for (const chord of buildTrack(id, 1).chords) {
        const intervals = chord.notes.map((n) => (n - chord.root + 120) % 12);
        expect(intervals).not.toContain(6);
      }
    }
  });

  it('turns strange later: every track gains a tritone chord by day 7', () => {
    for (const id of IDS) {
      const hasTritone = buildTrack(id, 7).chords.some((chord) =>
        chord.notes.some((n) => (n - chord.root + 120) % 12 === 6),
      );
      expect(hasTritone, id).toBe(true);
    }
  });

  it('opens with a chords-and-bass intro: no melody or drums in the first 8 bars', () => {
    for (const id of IDS) {
      const track = buildTrack(id, 1);
      const intro = STEPS_PER_BAR * 8;
      expect(track.melody.filter((n) => n.step < intro)).toEqual([]);
      expect(track.drums.filter((h) => h.step < intro)).toEqual([]);
    }
  });

  it('brings in a melody later, and a beat on every track except the ambient one', () => {
    for (const id of IDS) expect(buildTrack(id, 1).melody.length).toBeGreaterThan(0);
    const kinds = (id: string) => new Set(buildTrack(id as never, 1).drums.map((h) => h.kind));
    expect(kinds('warehouse')).toEqual(new Set(['kick', 'snare', 'hat']));
    expect(buildTrack('nightshift', 1).drums).toEqual([]);
    for (const id of IDS.filter((i) => i !== 'nightshift')) {
      expect(buildTrack(id, 1).drums.length).toBeGreaterThan(0);
    }
  });

  it('gives every track its own harmony', () => {
    const signatures = IDS.map((id) =>
      JSON.stringify(buildTrack(id, 1).chords.slice(8, 12).map((c) => c.notes)),
    );
    expect(new Set(signatures).size).toBe(IDS.length);
  });

  it('changes section: the second theme differs from the first', () => {
    for (const id of IDS) {
      const track = buildTrack(id, 1);
      const bar = (n: number) => track.chords.find((c) => c.step === n * STEPS_PER_BAR)!.notes;
      // 8-bar sections: intro, a, a, b -> bar 24 starts the b theme, bar 8 the first a theme
      expect(bar(24)).not.toEqual(bar(8));
    }
  });
});

describe('eventsByStep', () => {
  it('lists every event exactly once, keyed by an in-range step', () => {
    for (const id of IDS) {
      const track = buildTrack(id, 3);
      const index = eventsByStep(track);
      const total = [...index.values()].reduce((sum, list) => sum + list.length, 0);
      expect(total).toBe(
        track.chords.length + track.bass.length + track.melody.length + track.drums.length,
      );
      for (const step of index.keys()) {
        expect(step).toBeGreaterThanOrEqual(0);
        expect(step).toBeLessThan(track.steps);
      }
    }
  });
});
