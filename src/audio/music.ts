import { createRng } from '../game/rng';

export const STEPS_PER_BAR = 16;
export const LOOP_STEPS = STEPS_PER_BAR * 4;

export interface Chord {
  step: number;
  length: number;
  root: number;
  notes: number[];
}
export interface NoteEvent {
  step: number;
  length: number;
  midi: number;
}
export interface DrumHit {
  step: number;
  kind: 'kick' | 'snare' | 'hat';
}
export interface Loop {
  bpm: number;
  steps: number;
  chords: Chord[];
  bass: NoteEvent[];
  melody: NoteEvent[];
  drums: DrumHit[];
  detuneCents: number;
}

// 0 on day 1 (cozy) up to 1 on the last day (off-kilter).
export function weirdness(day: number): number {
  return Math.min(1, Math.max(0, (day - 1) / 6));
}

export const detuneCentsForDay = (day: number): number => Math.round(weirdness(day) * 45);

// Fmaj7 - Em7 - Dm7 - Cmaj7, the classic mellow lo-fi walk-down.
const PROGRESSION: ReadonlyArray<{ root: number; intervals: readonly number[] }> = [
  { root: 53, intervals: [0, 4, 7, 11] },
  { root: 52, intervals: [0, 3, 7, 10] },
  { root: 50, intervals: [0, 3, 7, 10] },
  { root: 48, intervals: [0, 4, 7, 11] },
];

// F major pentatonic over two octaves.
const SCALE = [65, 67, 69, 72, 74, 77, 79, 81];

function buildChords(day: number): Chord[] {
  return PROGRESSION.map((p, bar) => {
    const notes = p.intervals.map((i) => p.root + 12 + i);
    // From day 4 the last chord picks up a tritone, from day 6 the second a flat nine.
    if (day >= 4 && bar === 3) notes.push(p.root + 12 + 6);
    if (day >= 6 && bar === 1) notes.push(p.root + 12 + 1);
    return { step: bar * STEPS_PER_BAR, length: STEPS_PER_BAR, root: p.root + 12, notes };
  });
}

function buildBass(): NoteEvent[] {
  return PROGRESSION.flatMap((p, bar) => [
    { step: bar * STEPS_PER_BAR, length: 6, midi: p.root - 12 },
    { step: bar * STEPS_PER_BAR + 10, length: 4, midi: p.root - 12 + 7 },
  ]);
}

function buildMelody(day: number): NoteEvent[] {
  const rng = createRng(day * 7919);
  const odd = weirdness(day) * 0.3;
  const notes: NoteEvent[] = [];
  for (let bar = 0; bar < 4; bar++) {
    for (const beat of [0, 4, 8, 12]) {
      if (!rng.chance(0.6)) continue;
      let midi = rng.pick(SCALE);
      if (rng.chance(odd)) midi += 1; // a note that does not belong
      notes.push({ step: bar * STEPS_PER_BAR + beat, length: 3, midi });
    }
  }
  return notes;
}

function buildDrums(): DrumHit[] {
  const hits: DrumHit[] = [];
  for (let bar = 0; bar < 4; bar++) {
    const base = bar * STEPS_PER_BAR;
    hits.push({ step: base, kind: 'kick' }, { step: base + 10, kind: 'kick' });
    hits.push({ step: base + 4, kind: 'snare' }, { step: base + 12, kind: 'snare' });
    for (let s = 0; s < STEPS_PER_BAR; s += 2) hits.push({ step: base + s, kind: 'hat' });
  }
  return hits;
}

export function buildLoop(day: number): Loop {
  return {
    bpm: Math.round(76 - weirdness(day) * 12),
    steps: LOOP_STEPS,
    chords: buildChords(day),
    bass: buildBass(),
    melody: buildMelody(day),
    drums: buildDrums(),
    detuneCents: detuneCentsForDay(day),
  };
}
