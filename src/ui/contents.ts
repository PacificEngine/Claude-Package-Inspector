import { itemsIn, type ContentsArt, type Item } from '../game/contents';
import type { Handling, Package } from '../game/types';

export type { ContentsArt };

export type ContentsExtra = 'void' | 'storm' | 'liquid' | 'clock' | 'glow' | 'gadget' | 'waves';

export interface Contents {
  items: Item[];
  extras: ContentsExtra[];
}

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

// The items still inside, plus an extra for each defect that has not been repaired.
export function contentsFor(pkg: Package, handling: Handling): Contents {
  const extras: ContentsExtra[] = [];
  for (const defect of pkg.defects) {
    if (handling.repaired.includes(defect)) continue;
    const extra = EXTRA_FOR_DEFECT[defect];
    if (extra && !extras.includes(extra)) extras.push(extra);
  }
  return { items: itemsIn(pkg, handling), extras };
}

export function describeContents(c: Contents): string {
  return [c.items.map((i) => i.name).join(', '), ...c.extras.map((e) => EXTRA_TEXT[e])]
    .filter((part) => part !== '')
    .join(', plus ');
}
