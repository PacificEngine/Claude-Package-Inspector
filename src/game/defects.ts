import type { DefectId, InspectionTool, PackageKind, RepairTool } from './types';

export interface DefectDef {
  id: DefectId;
  label: string;
  kinds: readonly PackageKind[];
  // Which inspection tools reveal it, with the text the player reads.
  clues: Partial<Record<InspectionTool, string>>;
  repairedBy: RepairTool | 'discard' | null;
  fantastical: boolean;
  // First day this defect may appear (see consistency test in Task 9).
  minDay: number;
  // Repairing it requires the box to be open.
  repairNeedsOpen: boolean;
  // What the player sees when the box is open, if it shows inside.
  insideClue?: string;
}

const ANY: readonly PackageKind[] = ['box', 'can', 'parcel', 'jar', 'tube', 'prism', 'tetra'];
const SURFACE_SHAPES: readonly PackageKind[] = ['box', 'parcel', 'prism'];
const UNDERSIDE_SHAPES: readonly PackageKind[] = ['box', 'parcel', 'tetra'];

export const DEFECTS: Record<DefectId, DefectDef> = {
  leaking: {
    id: 'leaking',
    label: 'Leak',
    kinds: ['can', 'jar', 'tube'],
    clues: {
      look: 'A dark drip trails down the side.',
      uv: 'UV shows a glowing wet streak.',
    },
    repairedBy: 'sealant',
    fantastical: false,
    minDay: 1,
    repairNeedsOpen: true,
    insideClue: 'Liquid is pooling at the bottom inside.',
  },
  crushed_corner: {
    id: 'crushed_corner',
    label: 'Crushed corner',
    kinds: SURFACE_SHAPES,
    clues: {
      look: 'One corner is crushed flat.',
      rotate: 'The crushed corner caves in when you turn it.',
    },
    repairedBy: 'tape',
    fantastical: false,
    minDay: 1,
    repairNeedsOpen: false,
  },
  torn_tape: {
    id: 'torn_tape',
    label: 'Torn tape',
    kinds: SURFACE_SHAPES,
    clues: { look: 'The sealing tape is torn and peeling.' },
    repairedBy: 'tape',
    fantastical: false,
    minDay: 1,
    repairNeedsOpen: false,
  },
  bulging: {
    id: 'bulging',
    label: 'Bulging',
    kinds: ['can', 'jar'],
    clues: {
      look: 'The sides are swollen outward.',
      rotate: 'It rocks on its bulging base.',
    },
    repairedBy: 'valve',
    fantastical: false,
    minDay: 1,
    repairNeedsOpen: true,
  },
  wet_cardboard: {
    id: 'wet_cardboard',
    label: 'Wet cardboard',
    kinds: UNDERSIDE_SHAPES,
    clues: {
      rotate: 'The underside is soggy.',
      uv: 'UV lights up a damp patch.',
    },
    repairedBy: 'sealant',
    fantastical: false,
    minDay: 2,
    repairNeedsOpen: true,
  },
  wrong_weight: {
    id: 'wrong_weight',
    label: 'Wrong weight',
    kinds: ANY,
    clues: { scale: 'The scale disagrees with the label.' },
    repairedBy: 'discard',
    fantastical: false,
    minDay: 3,
    repairNeedsOpen: true,
  },
  rattling: {
    id: 'rattling',
    label: 'Rattling contents',
    kinds: ANY,
    clues: { shake: 'Something loose clatters inside.' },
    repairedBy: null,
    fantastical: false,
    minDay: 4,
    repairNeedsOpen: true,
  },
  missing_label: {
    id: 'missing_label',
    label: 'Missing contents label',
    kinds: ANY,
    clues: { look: 'There is no contents label.' },
    repairedBy: 'relabel',
    fantastical: false,
    minDay: 1,
    repairNeedsOpen: true,
  },
  bottomless: {
    id: 'bottomless',
    label: 'No bottom',
    kinds: UNDERSIDE_SHAPES,
    clues: {
      rotate: 'You flip it over. There is no bottom, only darkness.',
      pebble: 'The pebble drops in... and never lands.',
    },
    repairedBy: 'tape',
    fantastical: true,
    minDay: 3,
    repairNeedsOpen: true,
    insideClue: 'Inside there is only a black void where the floor should be.',
  },
  humming: {
    id: 'humming',
    label: 'Humming',
    kinds: ANY,
    clues: { stethoscope: 'A low, steady hum from within.' },
    repairedBy: 'foam',
    fantastical: true,
    minDay: 6,
    repairNeedsOpen: true,
    insideClue: 'Faint wavy lines rise from the contents.',
  },
  whispering: {
    id: 'whispering',
    label: 'Whispering',
    kinds: ANY,
    clues: { stethoscope: 'Faint whispers. They know your name.' },
    repairedBy: 'foam',
    fantastical: true,
    minDay: 6,
    repairNeedsOpen: true,
    insideClue: 'Faint wavy lines rise from the contents.',
  },
  ticking: {
    id: 'ticking',
    label: 'Ticking',
    kinds: ANY,
    clues: { stethoscope: 'Tick. Tick. Tick. There should not be a clock in here.' },
    repairedBy: 'foam',
    fantastical: true,
    minDay: 6,
    repairNeedsOpen: true,
    insideClue: 'A small clock sits among the contents, ticking.',
  },
  scorching: {
    id: 'scorching',
    label: 'Hotter than the sun',
    kinds: ANY,
    clues: { uv: 'It glows white-hot. Hotter than the sun.' },
    repairedBy: null,
    fantastical: true,
    minDay: 4,
    repairNeedsOpen: true,
    insideClue: 'Something inside glows white-hot.',
  },
  future_contents: {
    id: 'future_contents',
    label: 'Contents from the future',
    kinds: ANY,
    clues: { shake: 'It sloshes before you shake it.' },
    repairedBy: null,
    fantastical: true,
    minDay: 4,
    repairNeedsOpen: true,
    insideClue: 'One of the gadgets inside looks slightly wrong.',
  },
  heavier_inside: {
    id: 'heavier_inside',
    label: 'Heavier inside than outside',
    kinds: ANY,
    clues: { scale: 'It weighs far more than it could possibly hold.' },
    repairedBy: null,
    fantastical: true,
    minDay: 3,
    repairNeedsOpen: true,
  },
  tiny_weather: {
    id: 'tiny_weather',
    label: 'Tiny weather inside',
    kinds: ['box', 'jar'],
    clues: {
      uv: 'A tiny storm flashes inside.',
      shake: 'You hear distant thunder.',
    },
    repairedBy: 'sealant',
    fantastical: true,
    minDay: 4,
    repairNeedsOpen: true,
    insideClue: 'A tiny storm swirls above the contents.',
  },
};

export const ALL_DEFECT_IDS = Object.keys(DEFECTS) as DefectId[];
