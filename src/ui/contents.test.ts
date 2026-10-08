import { describe, expect, it } from 'vitest';
import { makePackage } from '../game/testing';
import { newHandling } from '../game/handling';
import type { DefectId } from '../game/types';
import { contentsFor, describeContents } from './contents';

const item = (id: number, name = `t${id}`) => ({ id, name, art: 'dome' as const, color: '#fff', weightKg: 0.3 });
const fresh = newHandling();

describe('contentsFor', () => {
  it('shows the items still inside, not the ones thrown away', () => {
    const pkg = makePackage({ contents: [item(1, 'teapot'), item(2, 'brick')] });
    expect(contentsFor(pkg, newHandling()).items.map((i) => i.name)).toEqual(['teapot', 'brick']);
    expect(contentsFor(pkg, { ...newHandling(), discarded: [2] }).items.map((i) => i.name)).toEqual(['teapot']);
  });

  it('keeps the extras of unrepaired defects only', () => {
    const pkg = makePackage({ defects: ['bottomless', 'ticking'], contents: [item(1)] });
    expect(contentsFor(pkg, newHandling()).extras).toEqual(['void', 'clock']);
    expect(contentsFor(pkg, { ...newHandling(), repaired: ['bottomless'] }).extras).toEqual(['clock']);
  });

  it('has nothing odd inside a clean package or one with unrelated defects', () => {
    expect(contentsFor(makePackage(), fresh).extras).toEqual([]);
    expect(contentsFor(makePackage({ defects: ['torn_tape', 'crushed_corner'] }), fresh).extras).toEqual([]);
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
    expect(contentsFor(makePackage({ defects: [defect] }), fresh).extras).toEqual([extra]);
  });

  it('does not repeat an extra when two defects look the same inside', () => {
    expect(contentsFor(makePackage({ defects: ['humming', 'whispering'] }), fresh).extras).toEqual(['waves']);
  });
});

describe('describeContents', () => {
  it('describes the items by name', () => {
    const pkg = makePackage({ contents: [item(1, 'teapot'), item(2, 'duck')] });
    expect(describeContents(contentsFor(pkg, newHandling()))).toBe('teapot, duck');
  });

  it('adds what looks wrong inside', () => {
    const pkg = makePackage({ defects: ['bottomless', 'tiny_weather'], contents: [item(1, 'teapot')] });
    const text = describeContents(contentsFor(pkg, fresh));
    expect(text).toMatch(/^teapot, plus /);
    expect(text).toMatch(/bottomless black void/);
    expect(text).toMatch(/tiny storm/);
  });
});
