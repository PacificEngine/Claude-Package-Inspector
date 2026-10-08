import type { Handling, Package, PackageKind } from './types';

// 'dome' is a heap of something (fruit, jam), 'sticks' stand upright, 'cloth' is a folded bundle.
export type ContentsArt = 'dome' | 'sticks' | 'cloth' | 'teapot' | 'duck' | 'tower' | 'book';

export interface Item {
  id: number;
  name: string; // a plain noun: "teapot"
  art: ContentsArt;
  color: string;
  weightKg: number;
  extra?: boolean; // should not be in the package: a stowaway or the marble
  leaking?: boolean;
}

export interface CatalogItem {
  name: string;
  art: ContentsArt;
  color: string;
  baseKg: number;
}

export const CATALOG: Record<PackageKind, CatalogItem[]> = {
  box: [
    { name: 'teapot', art: 'teapot', color: '#c05a5a', baseKg: 0.6 },
    { name: 'rubber ducks', art: 'duck', color: '#f2c94c', baseKg: 0.3 },
    { name: 'model lighthouse', art: 'tower', color: '#e8e8e8', baseKg: 0.8 },
  ],
  parcel: [
    { name: 'woolly socks', art: 'cloth', color: '#7a9cc6', baseKg: 0.2 },
    { name: 'old books', art: 'book', color: '#8b5a3c', baseKg: 0.9 },
    { name: 'knitted scarf', art: 'cloth', color: '#c97b9a', baseKg: 0.2 },
  ],
  can: [
    { name: 'peaches', art: 'dome', color: '#f4a259', baseKg: 0.4 },
    { name: 'beans', art: 'dome', color: '#a0522d', baseKg: 0.4 },
    { name: 'tomatoes', art: 'dome', color: '#d94a38', baseKg: 0.4 },
  ],
  jar: [
    { name: 'strawberry jam', art: 'dome', color: '#b3203a', baseKg: 0.5 },
    { name: 'pickles', art: 'dome', color: '#6b8e23', baseKg: 0.5 },
    { name: 'honey', art: 'dome', color: '#e0a020', baseKg: 0.6 },
  ],
  tube: [
    { name: 'pencils', art: 'sticks', color: '#e0c040', baseKg: 0.2 },
    { name: 'paintbrushes', art: 'sticks', color: '#5a8f5a', baseKg: 0.1 },
    { name: 'rolled poster', art: 'sticks', color: '#d9d2c0', baseKg: 0.2 },
  ],
  prism: [
    { name: 'candles', art: 'sticks', color: '#f2e2b0', baseKg: 0.3 },
    { name: 'toy tent', art: 'tower', color: '#d95d5d', baseKg: 0.4 },
    { name: 'cheese wedges', art: 'dome', color: '#f2c94c', baseKg: 0.5 },
  ],
  tetra: [
    { name: 'crystals', art: 'tower', color: '#8fd3f4', baseKg: 0.4 },
    { name: 'party hats', art: 'tower', color: '#ff7eb6', baseKg: 0.2 },
    { name: 'dice', art: 'book', color: '#e8e8e8', baseKg: 0.1 },
  ],
};

// Things that turn up in a package with the wrong weight.
export const STOWAWAYS: Array<Omit<CatalogItem, 'baseKg'>> = [
  { name: 'brick', art: 'book', color: '#9b6a5a' },
  { name: 'sandbags', art: 'dome', color: '#c2b280' },
  { name: 'rock', art: 'dome', color: '#8a8f98' },
];

export const MARBLE: Omit<CatalogItem, 'baseKg'> = {
  name: 'impossibly dense marble',
  art: 'dome',
  color: '#2d3748',
};

export const PACKAGING_KG: Record<PackageKind, number> = {
  box: 0.5,
  parcel: 0.3,
  can: 0.1,
  jar: 0.2,
  tube: 0.1,
  prism: 0.4,
  tetra: 0.3,
};

export const itemsIn = (pkg: Package, handling: Handling): Item[] =>
  pkg.contents.filter((i) => !handling.discarded.includes(i.id));

export const round1 = (n: number): number => Math.round(n * 10) / 10;

// What the scale reads once the discarded items are out.
export function weightLeft(pkg: Package, discarded: readonly number[]): number {
  const gone = pkg.contents
    .filter((i) => discarded.includes(i.id))
    .reduce((sum, i) => sum + i.weightKg, 0);
  return round1(pkg.actualWeightKg - gone);
}

export const currentWeightKg = (pkg: Package, handling: Handling): number =>
  weightLeft(pkg, handling.discarded);

// The one place that decides how close a reading must be to the label to count as matching.
export const weightIsDeclared = (weightKg: number, declaredKg: number): boolean =>
  Math.abs(weightKg - declaredKg) < 0.05;

export const weightMatches = (pkg: Package, handling: Handling): boolean =>
  weightIsDeclared(currentWeightKg(pkg, handling), pkg.declaredWeightKg);

// The ids of the items the label on the box was printed for.
export const legitItemIds = (pkg: Package): number[] =>
  pkg.contents.filter((i) => !i.extra).map((i) => i.id);

export function labelMatches(pkg: Package, handling: Handling): boolean {
  if (handling.labelItems === null) return false;
  const inside = itemsIn(pkg, handling).map((i) => i.id).sort((a, b) => a - b);
  const printed = [...handling.labelItems].sort((a, b) => a - b);
  return inside.length === printed.length && inside.every((id, i) => id === printed[i]);
}
