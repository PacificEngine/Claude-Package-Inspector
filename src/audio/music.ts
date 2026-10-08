import { createRng } from '../game/rng';

export const STEPS_PER_BAR = 16; // sixteenth notes
const BARS_PER_SECTION = 8;

export type TrackId = 'warehouse' | 'jazz' | 'nightshift' | 'rainy' | 'sunrise';

export interface TrackInfo {
  id: TrackId;
  name: string;
}

// The first entry is the default; auto-play walks the list in this order.
export const TRACKS: readonly TrackInfo[] = [
  { id: 'warehouse', name: 'Warehouse Lo-fi' },
  { id: 'jazz', name: 'Conveyor Jazz' },
  { id: 'nightshift', name: 'Night Shift' },
  { id: 'rainy', name: 'Rainy Loading Dock' },
  { id: 'sunrise', name: 'Sunrise Shift' },
];

export const DEFAULT_TRACK_ID: TrackId = TRACKS[0].id;

export const isTrackId = (value: string): value is TrackId => TRACKS.some((t) => t.id === value);

export function nextTrackId(id: TrackId): TrackId {
  const index = TRACKS.findIndex((t) => t.id === id);
  return TRACKS[(index + 1) % TRACKS.length].id;
}

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
export interface Track {
  id: TrackId;
  name: string;
  bpm: number;
  steps: number;
  chords: Chord[];
  bass: NoteEvent[];
  melody: NoteEvent[];
  drums: DrumHit[];
  detuneCents: number;
}

export type StepEvent =
  | { kind: 'chord'; chord: Chord }
  | { kind: 'bass'; note: NoteEvent }
  | { kind: 'melody'; note: NoteEvent }
  | { kind: 'drum'; hit: DrumHit };

// 0 on day 1 (cozy) up to 1 on the last day (off-kilter).
export function weirdness(day: number): number {
  return Math.min(1, Math.max(0, (day - 1) / 6));
}

export const detuneCentsForDay = (day: number): number => Math.round(weirdness(day) * 45);

export const trackSeconds = (track: Track): number => ((track.steps / 4) * 60) / track.bpm;

// ---- track definitions -----------------------------------------------------------

type Feel = 'lofi' | 'swing' | 'ambient' | 'sparse' | 'bright';
type SectionKind = 'intro' | 'a' | 'b' | 'bridge' | 'outro';
interface ChordSpec {
  root: number;
  intervals: readonly number[];
}
interface TrackDef {
  bpm: number;
  feel: Feel;
  seed: number;
  scale: readonly number[]; // melody pool, low to high
  melodySteps: readonly number[];
  noteLength: number;
  progressions: Record<'a' | 'b' | 'bridge', readonly ChordSpec[]>;
}

// Eight sections of eight bars: about three minutes at a mellow tempo.
const FORM: readonly SectionKind[] = ['intro', 'a', 'a', 'b', 'a', 'bridge', 'a', 'outro'];

const maj7 = [0, 4, 7, 11];
const min7 = [0, 3, 7, 10];
const dom7 = [0, 4, 7, 10];
const major = [0, 4, 7];
const minor = [0, 3, 7];

const DEFS: Record<TrackId, TrackDef> = {
  warehouse: {
    bpm: 76,
    feel: 'lofi',
    seed: 1,
    scale: [65, 67, 69, 72, 74, 77, 79, 81],
    melodySteps: [0, 4, 8, 12],
    noteLength: 3,
    progressions: {
      a: [
        { root: 53, intervals: maj7 },
        { root: 52, intervals: min7 },
        { root: 50, intervals: min7 },
        { root: 48, intervals: maj7 },
      ],
      b: [
        { root: 46, intervals: maj7 },
        { root: 45, intervals: min7 },
        { root: 43, intervals: min7 },
        { root: 48, intervals: dom7 },
      ],
      bridge: [
        { root: 50, intervals: min7 },
        { root: 43, intervals: dom7 },
        { root: 48, intervals: maj7 },
        { root: 53, intervals: maj7 },
      ],
    },
  },
  jazz: {
    bpm: 96,
    feel: 'swing',
    seed: 2,
    scale: [67, 69, 71, 72, 74, 76, 79, 81],
    melodySteps: [0, 4, 6, 8, 12, 14],
    noteLength: 2,
    progressions: {
      a: [
        { root: 48, intervals: maj7 },
        { root: 45, intervals: dom7 },
        { root: 50, intervals: min7 },
        { root: 43, intervals: dom7 },
      ],
      b: [
        { root: 52, intervals: min7 },
        { root: 45, intervals: dom7 },
        { root: 50, intervals: min7 },
        { root: 43, intervals: dom7 },
      ],
      bridge: [
        { root: 53, intervals: maj7 },
        { root: 46, intervals: dom7 },
        { root: 52, intervals: min7 },
        { root: 45, intervals: dom7 },
      ],
    },
  },
  nightshift: {
    bpm: 58,
    feel: 'ambient',
    seed: 3,
    scale: [62, 64, 66, 69, 71, 74, 76, 78, 81],
    melodySteps: [0, 8],
    noteLength: 8,
    progressions: {
      a: [
        { root: 50, intervals: [0, 2, 7, 12] },
        { root: 47, intervals: min7 },
        { root: 43, intervals: maj7 },
        { root: 45, intervals: [0, 5, 7, 10] },
      ],
      b: [
        { root: 47, intervals: min7 },
        { root: 43, intervals: maj7 },
        { root: 52, intervals: min7 },
        { root: 45, intervals: [0, 5, 7, 10] },
      ],
      bridge: [
        { root: 43, intervals: maj7 },
        { root: 54, intervals: min7 },
        { root: 47, intervals: min7 },
        { root: 45, intervals: [0, 5, 7, 10] },
      ],
    },
  },
  rainy: {
    bpm: 68,
    feel: 'sparse',
    seed: 4,
    scale: [69, 72, 74, 76, 79, 81, 84],
    melodySteps: [0, 4, 8, 12],
    noteLength: 4,
    progressions: {
      a: [
        { root: 45, intervals: min7 },
        { root: 53, intervals: maj7 },
        { root: 48, intervals: maj7 },
        { root: 43, intervals: dom7 },
      ],
      b: [
        { root: 50, intervals: min7 },
        { root: 43, intervals: dom7 },
        { root: 48, intervals: maj7 },
        { root: 52, intervals: dom7 },
      ],
      bridge: [
        { root: 53, intervals: maj7 },
        { root: 52, intervals: min7 },
        { root: 50, intervals: min7 },
        { root: 52, intervals: dom7 },
      ],
    },
  },
  sunrise: {
    bpm: 98,
    feel: 'bright',
    seed: 5,
    scale: [72, 74, 76, 79, 81, 84, 86, 88],
    melodySteps: [0, 4, 6, 8, 12, 14],
    noteLength: 2,
    progressions: {
      a: [
        { root: 48, intervals: major },
        { root: 43, intervals: major },
        { root: 45, intervals: minor },
        { root: 53, intervals: major },
      ],
      b: [
        { root: 53, intervals: major },
        { root: 48, intervals: major },
        { root: 43, intervals: major },
        { root: 45, intervals: minor },
      ],
      bridge: [
        { root: 45, intervals: minor },
        { root: 53, intervals: major },
        { root: 48, intervals: major },
        { root: 43, intervals: major },
      ],
    },
  },
};

// What plays in each section: the song builds up, opens out, thins away.
const LAYERS: Record<SectionKind, { melody: number; drums: 'full' | 'hats' | 'none' }> = {
  intro: { melody: 0, drums: 'none' },
  a: { melody: 0.6, drums: 'full' },
  b: { melody: 0.8, drums: 'full' },
  bridge: { melody: 0.35, drums: 'hats' },
  outro: { melody: 0, drums: 'none' },
};

const DRUM_PATTERNS: Record<Feel, { kick: number[]; snare: number[]; hat: number[] }> = {
  lofi: { kick: [0, 10], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
  swing: { kick: [0], snare: [12], hat: [0, 4, 6, 8, 12, 14] },
  sparse: { kick: [0, 11], snare: [8], hat: [2, 6, 10, 14] },
  bright: { kick: [0, 8], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
  ambient: { kick: [], snare: [], hat: [] },
};

function bassForBar(feel: Feel, spec: ChordSpec, next: ChordSpec, bar: number, start: number): NoteEvent[] {
  const root = spec.root - 12;
  switch (feel) {
    case 'lofi':
      return [
        { step: start, length: 6, midi: root },
        { step: start + 10, length: 4, midi: root + 7 },
      ];
    case 'swing': {
      // A walking line that leans into the next chord.
      const approach = next.root - 12 + (bar % 2 === 0 ? -1 : 1);
      return [
        { step: start, length: 3, midi: root },
        { step: start + 4, length: 3, midi: root + spec.intervals[1] },
        { step: start + 8, length: 3, midi: root + 7 },
        { step: start + 12, length: 3, midi: approach },
      ];
    }
    case 'ambient':
      return [{ step: start, length: STEPS_PER_BAR, midi: root }];
    case 'sparse':
      return [
        { step: start, length: 8, midi: root },
        { step: start + 10, length: 4, midi: root + 7 },
      ];
    case 'bright':
      return [
        { step: start, length: 4, midi: root },
        { step: start + 8, length: 4, midi: root },
        { step: start + 12, length: 4, midi: root + 7 },
      ];
  }
}

export function buildTrack(id: TrackId, day: number): Track {
  const def = DEFS[id];
  const rng = createRng(def.seed * 1000 + day);
  const odd = weirdness(day) * 0.3;
  const chords: Chord[] = [];
  const bass: NoteEvent[] = [];
  const melody: NoteEvent[] = [];
  const drums: DrumHit[] = [];
  let scaleIndex = Math.floor(def.scale.length / 2);

  FORM.forEach((kind, sectionIndex) => {
    const progression = def.progressions[kind === 'b' ? 'b' : kind === 'bridge' ? 'bridge' : 'a'];
    const layers = LAYERS[kind];
    for (let bar = 0; bar < BARS_PER_SECTION; bar++) {
      const start = (sectionIndex * BARS_PER_SECTION + bar) * STEPS_PER_BAR;
      const spec = progression[bar % progression.length];
      const next = progression[(bar + 1) % progression.length];

      const notes = spec.intervals.map((i) => spec.root + 12 + i);
      // From day 4 a tritone creeps into the second themes, from day 6 a flat nine into the main ones.
      if (day >= 4 && (kind === 'b' || kind === 'bridge') && bar % 4 === 3) notes.push(spec.root + 18);
      if (day >= 6 && (kind === 'a' || kind === 'b') && bar % 4 === 1) notes.push(spec.root + 13);
      chords.push({ step: start, length: STEPS_PER_BAR, root: spec.root + 12, notes });

      const quietEnds = def.feel === 'ambient' && (kind === 'intro' || kind === 'outro');
      if (!quietEnds) bass.push(...bassForBar(def.feel, spec, next, bar, start));

      if (layers.melody > 0) {
        for (const beat of def.melodySteps) {
          if (!rng.chance(layers.melody)) continue;
          scaleIndex = Math.min(def.scale.length - 1, Math.max(0, scaleIndex + rng.int(5) - 2));
          let midi = def.scale[scaleIndex];
          if (rng.chance(odd)) midi += 1; // a note that does not belong
          melody.push({ step: start + beat, length: def.noteLength, midi });
        }
      }

      if (layers.drums !== 'none') {
        const pattern = DRUM_PATTERNS[def.feel];
        if (layers.drums === 'full') {
          for (const s of pattern.kick) drums.push({ step: start + s, kind: 'kick' });
          for (const s of pattern.snare) drums.push({ step: start + s, kind: 'snare' });
        }
        for (const s of pattern.hat) drums.push({ step: start + s, kind: 'hat' });
      }
    }
  });

  return {
    id,
    name: TRACKS.find((t) => t.id === id)!.name,
    bpm: Math.round(def.bpm * (1 - weirdness(day) * 0.15)),
    steps: FORM.length * BARS_PER_SECTION * STEPS_PER_BAR,
    chords,
    bass,
    melody,
    drums,
    detuneCents: detuneCentsForDay(day),
  };
}

// Groups events by the step they start on so the player only looks at what is due.
export function eventsByStep(track: Track): Map<number, StepEvent[]> {
  const index = new Map<number, StepEvent[]>();
  const add = (step: number, event: StepEvent): void => {
    const list = index.get(step);
    if (list) list.push(event);
    else index.set(step, [event]);
  };
  for (const chord of track.chords) add(chord.step, { kind: 'chord', chord });
  for (const note of track.bass) add(note.step, { kind: 'bass', note });
  for (const note of track.melody) add(note.step, { kind: 'melody', note });
  for (const hit of track.drums) add(hit.step, { kind: 'drum', hit });
  return index;
}
