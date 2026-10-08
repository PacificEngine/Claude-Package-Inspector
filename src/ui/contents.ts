import type { DefectId, Package, PackageKind } from '../game/types';

// 'dome' is a heap of something (fruit, jam), 'sticks' stand upright, 'cloth' is a folded bundle.
export type ContentsArt = 'dome' | 'sticks' | 'cloth' | 'teapot' | 'duck' | 'tower' | 'book';

export interface ContentsItem {
  name: string;
  art: ContentsArt;
  color: string;
}

export type ContentsExtra = 'void' | 'storm' | 'liquid' | 'clock' | 'glow' | 'gadget' | 'waves';

export interface Contents {
  item: ContentsItem;
  extras: ContentsExtra[];
}

export const CONTENT_ITEMS: Record<PackageKind, ContentsItem[]> = {
  box: [
    { name: 'a teapot', art: 'teapot', color: '#c05a5a' },
    { name: 'rubber ducks', art: 'duck', color: '#f2c94c' },
    { name: 'a model lighthouse', art: 'tower', color: '#e8e8e8' },
  ],
  parcel: [
    { name: 'woolly socks', art: 'cloth', color: '#7a9cc6' },
    { name: 'old books', art: 'book', color: '#8b5a3c' },
    { name: 'a knitted scarf', art: 'cloth', color: '#c97b9a' },
  ],
  prism: [
    { name: 'candles', art: 'sticks', color: '#f2e2b0' },
    { name: 'a toy tent', art: 'tower', color: '#d95d5d' },
    { name: 'cheese wedges', art: 'dome', color: '#f2c94c' },
  ],
  tetra: [
    { name: 'crystals', art: 'tower', color: '#8fd3f4' },
    { name: 'party hats', art: 'tower', color: '#ff7eb6' },
    { name: 'dice', art: 'book', color: '#e8e8e8' },
  ],
  can: [
    { name: 'peaches', art: 'dome', color: '#f4a259' },
    { name: 'beans', art: 'dome', color: '#a0522d' },
    { name: 'tomatoes', art: 'dome', color: '#d94a38' },
  ],
  jar: [
    { name: 'strawberry jam', art: 'dome', color: '#b3203a' },
    { name: 'pickles', art: 'dome', color: '#6b8e23' },
    { name: 'honey', art: 'dome', color: '#e0a020' },
  ],
  tube: [
    { name: 'pencils', art: 'sticks', color: '#e0c040' },
    { name: 'paintbrushes', art: 'sticks', color: '#5a8f5a' },
    { name: 'a rolled poster', art: 'sticks', color: '#d9d2c0' },
  ],
};

const EXTRA_FOR_DEFECT: Partial<Record<string, ContentsExtra>> = {
  bottomless: 'void',
  tiny_weather: 'storm',
  leaking: 'liquid',
  ticking: 'clock',
  scorching: 'glow',
  future_contents: 'gadget',
  humming: 'waves',
  whispering: 'waves',
};

const EXTRA_TEXT: Record<ContentsExtra, string> = {
  void: 'a bottomless black void',
  storm: 'a tiny storm',
  liquid: 'liquid pooling at the bottom',
  clock: 'a ticking clock',
  glow: 'a white-hot glow',
  gadget: 'a gadget that looks slightly wrong',
  waves: 'faint wavy lines rising',
};

// Purely cosmetic: chosen from the package id so it is stable, never affects the rules.
export function contentsFor(pkg: Package, repaired: readonly DefectId[] = []): Contents {
  const items = CONTENT_ITEMS[pkg.kind];
  const extras: ContentsExtra[] = [];
  for (const defect of pkg.defects) {
    if (repaired.includes(defect)) continue;
    const extra = EXTRA_FOR_DEFECT[defect];
    if (extra && !extras.includes(extra)) extras.push(extra);
  }
  return { item: items[pkg.id % items.length], extras };
}

export function describeContents(c: Contents): string {
  return [c.item.name, ...c.extras.map((e) => EXTRA_TEXT[e])].join(', plus ');
}
