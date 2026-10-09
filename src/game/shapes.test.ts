import { describe, expect, it } from 'vitest';
import { makePackage } from './testing';
import {
  SHAPE_OF_KIND,
  faceCount,
  faceKey,
  isUndersideDefect,
  placementOf,
  shapeNote,
} from './shapes';
import type { PackageKind } from './types';

const KINDS: PackageKind[] = ['box', 'can', 'parcel', 'jar', 'tube', 'prism', 'tetra'];

describe('shapes', () => {
  it('gives every kind a shape', () => {
    for (const kind of KINDS) expect(SHAPE_OF_KIND[kind]).toBeDefined();
  });

  it('counts faces on each side', () => {
    expect([faceCount('box', 'up'), faceCount('box', 'down')]).toEqual([4, 1]);
    expect([faceCount('parcel', 'up'), faceCount('parcel', 'down')]).toEqual([4, 1]);
    expect([faceCount('can', 'up'), faceCount('can', 'down')]).toEqual([1, 1]);
    expect([faceCount('jar', 'up'), faceCount('tube', 'down')]).toEqual([1, 1]);
    expect([faceCount('prism', 'up'), faceCount('prism', 'down')]).toEqual([3, 0]);
    expect([faceCount('tetra', 'up'), faceCount('tetra', 'down')]).toEqual([4, 4]);
  });

  it('names a face by side and index', () => {
    expect(faceKey('up', 2)).toBe('up:2');
    expect(faceKey('down', 0)).toBe('down:0');
  });

  it('puts underside defects on the down side and the rest on the up side by default', () => {
    expect(isUndersideDefect('bottomless')).toBe(true);
    expect(isUndersideDefect('wet_cardboard')).toBe(true);
    expect(isUndersideDefect('torn_tape')).toBe(false);
    expect(placementOf(makePackage({ defects: ['bottomless'] }), 'bottomless')).toEqual({ side: 'down', face: 0 });
    expect(placementOf(makePackage({ defects: ['torn_tape'] }), 'torn_tape')).toEqual({ side: 'up', face: 0 });
  });

  it('uses a stored placement when there is one', () => {
    const pkg = makePackage({
      defects: ['torn_tape'],
      placements: { torn_tape: { side: 'up', face: 2 } },
    });
    expect(placementOf(pkg, 'torn_tape')).toEqual({ side: 'up', face: 2 });
  });

  it('describes each shape in the first note', () => {
    expect(shapeNote('box')).toBe('Shape: cuboid. Four sides to rotate; flip it for the underside.');
    expect(shapeNote('parcel')).toBe(shapeNote('box'));
    expect(shapeNote('can')).toBe('Shape: cylinder. One round side; flip it for the base.');
    expect(shapeNote('prism')).toBe('Shape: triangular prism. Three sides to rotate; it cannot be flipped.');
    expect(shapeNote('tetra')).toBe('Shape: tetrahedron. Four sides to rotate; flip it for four more.');
  });
});
