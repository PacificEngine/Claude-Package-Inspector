import { describe, expect, it } from 'vitest';
import { LOOP_STEPS, buildLoop, detuneCentsForDay, weirdness } from './music';

const DAYS = [1, 2, 3, 4, 5, 6, 7];

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

describe('buildLoop', () => {
  it('is deterministic for a day', () => {
    for (const d of DAYS) expect(buildLoop(d)).toEqual(buildLoop(d));
  });

  it('is a four-bar loop with four chords of at least three notes', () => {
    for (const d of DAYS) {
      const loop = buildLoop(d);
      expect(loop.steps).toBe(LOOP_STEPS);
      expect(loop.chords).toHaveLength(4);
      for (const chord of loop.chords) expect(chord.notes.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps every event inside the loop and every note in a playable range', () => {
    for (const d of DAYS) {
      const loop = buildLoop(d);
      const events = [...loop.chords, ...loop.bass, ...loop.melody, ...loop.drums];
      for (const e of events) {
        expect(e.step).toBeGreaterThanOrEqual(0);
        expect(e.step).toBeLessThan(LOOP_STEPS);
      }
      const midis = [
        ...loop.chords.flatMap((c) => c.notes),
        ...loop.bass.map((n) => n.midi),
        ...loop.melody.map((n) => n.midi),
      ];
      for (const m of midis) {
        expect(m).toBeGreaterThanOrEqual(30);
        expect(m).toBeLessThanOrEqual(96);
      }
    }
  });

  it('slows down as the days get stranger, within a mellow tempo range', () => {
    expect(buildLoop(7).bpm).toBeLessThan(buildLoop(1).bpm);
    for (const d of DAYS) {
      expect(buildLoop(d).bpm).toBeGreaterThanOrEqual(55);
      expect(buildLoop(d).bpm).toBeLessThanOrEqual(90);
    }
  });

  it('has a gentle beat with kick, snare and hats', () => {
    const kinds = new Set(buildLoop(1).drums.map((h) => h.kind));
    expect(kinds).toEqual(new Set(['kick', 'snare', 'hat']));
  });

  it('sounds cozy on day 1: no tritones in any chord', () => {
    for (const chord of buildLoop(1).chords) {
      const intervals = chord.notes.map((n) => (n - chord.root + 120) % 12);
      expect(intervals).not.toContain(6);
    }
  });

  it('turns strange later: a chord gains a tritone by day 7', () => {
    const hasTritone = buildLoop(7).chords.some((chord) =>
      chord.notes.some((n) => (n - chord.root + 120) % 12 === 6),
    );
    expect(hasTritone).toBe(true);
  });

  it('carries the detune amount for the day', () => {
    for (const d of DAYS) expect(buildLoop(d).detuneCents).toBe(detuneCentsForDay(d));
  });
});
