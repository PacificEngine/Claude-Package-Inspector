import { describe, expect, it } from 'vitest';
import { makePackage } from '../game/testing';
import type { DefectId, PackageKind } from '../game/types';
import { CONTENT_ITEMS, contentsFor, describeContents } from './contents';

const KINDS: PackageKind[] = ['box', 'can', 'parcel', 'jar', 'tube'];

describe('contentsFor', () => {
  it('is deterministic for a package', () => {
    const pkg = makePackage({ id: 4, kind: 'jar' });
    expect(contentsFor(pkg)).toEqual(contentsFor(pkg));
  });

  it('picks an item that belongs to the package kind', () => {
    for (const kind of KINDS) {
      for (let id = 1; id <= 9; id++) {
        const item = contentsFor(makePackage({ id, kind })).item;
        expect(CONTENT_ITEMS[kind]).toContainEqual(item);
      }
    }
  });

  it('varies what is inside from package to package', () => {
    for (const kind of KINDS) {
      const names = new Set(
        [1, 2, 3, 4, 5, 6].map((id) => contentsFor(makePackage({ id, kind })).item.name),
      );
      expect(names.size).toBeGreaterThan(1);
    }
  });

  it('has nothing odd inside a clean package or one with unrelated defects', () => {
    expect(contentsFor(makePackage()).extras).toEqual([]);
    expect(contentsFor(makePackage({ defects: ['torn_tape', 'crushed_corner'] })).extras).toEqual([]);
  });

  it.each<[DefectId, string]>([
    ['bottomless', 'void'],
    ['tiny_weather', 'storm'],
    ['leaking', 'liquid'],
    ['ticking', 'clock'],
    ['scorching', 'glow'],
    ['future_contents', 'gadget'],
    ['humming', 'waves'],
    ['whispering', 'waves'],
  ])('shows %s as %s inside', (defect, extra) => {
    expect(contentsFor(makePackage({ defects: [defect] })).extras).toEqual([extra]);
  });

  it('does not repeat an extra when two defects look the same inside', () => {
    expect(contentsFor(makePackage({ defects: ['humming', 'whispering'] })).extras).toEqual(['waves']);
  });
});

describe('describeContents', () => {
  it('names the item for a clean package', () => {
    const c = contentsFor(makePackage({ id: 1, kind: 'box' }));
    expect(describeContents(c)).toBe(c.item.name);
  });

  it('adds what looks wrong inside', () => {
    const text = describeContents(contentsFor(makePackage({ defects: ['bottomless', 'tiny_weather'] })));
    expect(text).toMatch(/bottomless black void/);
    expect(text).toMatch(/tiny storm/);
  });

  it('leaves out what a repair has fixed', () => {
    const pkg = makePackage({ defects: ['bottomless', 'ticking'] });
    expect(contentsFor(pkg, ['bottomless']).extras).toEqual(['clock']);
    expect(contentsFor(pkg, ['bottomless', 'ticking']).extras).toEqual([]);
  });
});
