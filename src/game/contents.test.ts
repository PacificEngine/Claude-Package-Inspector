import { describe, expect, it } from 'vitest';
import {
  CATALOG,
  MARBLE,
  PACKAGING_KG,
  STOWAWAYS,
  currentWeightKg,
  declaredAfter,
  itemsIn,
  labelMatches,
  legitItemIds,
  weightMatches,
  type Item,
} from './contents';
import { newHandling } from './handling';
import { kindsForDay } from './packages';
import { LAST_DAY, ruleCardForDay } from './rules';
import { typeNamesFor } from './shapes';
import { makePackage } from './testing';
import type { PackageKind } from './types';

const KINDS: PackageKind[] = ['box', 'can', 'parcel', 'jar', 'tube', 'prism', 'tetra', 'octa'];

describe('catalogs', () => {
  it('has three plain-noun items with positive weights for every kind', () => {
    for (const kind of KINDS) {
      expect(CATALOG[kind]).toHaveLength(3);
      for (const item of CATALOG[kind]) {
        expect(item.name).not.toMatch(/^(a|an|the) /i);
        expect(item.baseKg).toBeGreaterThan(0);
      }
      expect(PACKAGING_KG[kind]).toBeGreaterThan(0);
    }
  });

  it('gives the octahedron its own items and keeps the crystals there', () => {
    expect(CATALOG.octa.map((i) => i.name)).toEqual(['crystals', 'gold nuggets', 'pearls']);
    expect(CATALOG.tetra.map((i) => i.name)).not.toContain('crystals');
    expect(CATALOG.tetra.map((i) => i.name)).toEqual(expect.arrayContaining(['party hats', 'dice']));
    expect(PACKAGING_KG.octa).toBe(0.3);
  });

  it('never names an item after a package type', () => {
    const types = KINDS.flatMap((k) => typeNamesFor(k));
    for (const kind of KINDS) for (const item of CATALOG[kind]) expect(types).not.toContain(item.name);
  });

  it('only restricts items that can turn up by that day', () => {
    for (let day = 1; day <= LAST_DAY; day++) {
      const available = kindsForDay(day).flatMap((k) => CATALOG[k].map((i) => i.name));
      for (const name of ruleCardForDay(day).restrictedItems) expect(available, `${day} ${name}`).toContain(name);
    }
  });

  it('has stowaways and a marble that read as things that do not belong', () => {
    expect(STOWAWAYS.map((s) => s.name)).toEqual(['brick', 'sandbags', 'rock']);
    expect(MARBLE.name).toBe('impossibly dense marble');
  });
});

const item = (id: number, weightKg: number, over: Partial<Item> = {}): Item => ({
  id,
  name: `thing${id}`,
  art: 'dome',
  color: '#fff',
  weightKg,
  ...over,
});
const pkg = makePackage({
  packagingKg: 0.5,
  contents: [item(1, 0.6), item(2, 0.3), item(3, 0.8, { extra: true })],
  declaredWeightKg: 1.4,
  actualWeightKg: 2.2,
});

describe('what is left in a package', () => {
  it('lists the items that have not been thrown away', () => {
    expect(itemsIn(pkg, newHandling()).map((i) => i.id)).toEqual([1, 2, 3]);
    expect(itemsIn(pkg, { ...newHandling(), discarded: [2] }).map((i) => i.id)).toEqual([1, 3]);
  });

  it('weighs the package minus whatever was thrown away', () => {
    expect(currentWeightKg(pkg, newHandling())).toBe(2.2);
    expect(currentWeightKg(pkg, { ...newHandling(), discarded: [3] })).toBe(1.4);
  });

  it('matches the declared weight within 0.05 kg', () => {
    expect(weightMatches(pkg, newHandling())).toBe(false);
    expect(weightMatches(pkg, { ...newHandling(), discarded: [3] })).toBe(true);
  });

  it('lists the legit items for the label', () => {
    expect(legitItemIds(pkg)).toEqual([1, 2]);
  });

  it('matches the label only when the printed items equal what is inside', () => {
    expect(labelMatches(pkg, newHandling())).toBe(false);
    expect(labelMatches(pkg, { ...newHandling(), labelItems: [1, 2, 3] })).toBe(true);
    expect(labelMatches(pkg, { ...newHandling(), labelItems: [3, 2, 1] })).toBe(true);
    expect(labelMatches(pkg, { ...newHandling(), labelItems: [1, 2, 3], discarded: [3] })).toBe(false);
  });
});

describe('the weight rule counts only the stowaways', () => {
  it('compares with the declared weight minus legit items thrown away', () => {
    expect(declaredAfter(pkg, [])).toBe(1.4);
    expect(declaredAfter(pkg, [1])).toBe(0.8);
    expect(declaredAfter(pkg, [3])).toBe(1.4); // an extra never counted in the declared weight
  });

  it('is not fooled by swapping a legit item for an equal-weight stowaway', () => {
    const swap = makePackage({
      packagingKg: 0,
      declaredWeightKg: 1,
      actualWeightKg: 1.6,
      contents: [item(1, 0.6), item(2, 0.4), item(3, 0.6, { extra: true })],
    });
    expect(weightMatches(swap, { ...newHandling(), discarded: [1] })).toBe(false);
    expect(weightMatches(swap, { ...newHandling(), discarded: [3] })).toBe(true);
  });

  it('stays matched when only legit items are thrown away from a package with no stowaway', () => {
    expect(weightMatches(pkg, { ...newHandling(), discarded: [3, 1] })).toBe(true);
  });
});
