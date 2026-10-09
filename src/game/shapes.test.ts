import { describe, expect, it } from 'vitest';
import { makePackage } from './testing';
import {
  SHAPE_OF_KIND,
  faceCount,
  faceKey,
  hasTop,
  isUndersideDefect,
  orient,
  placementOf,
  ringLength,
  rotateDelta,
  shapeName,
  shapeNote,
  shownFace,
  sideCount,
} from './shapes';
import type { PackageKind } from './types';

const KINDS: PackageKind[] = ['box', 'can', 'parcel', 'jar', 'tube', 'prism', 'tetra'];

describe('shapes', () => {
  it('gives every kind a shape', () => {
    for (const kind of KINDS) expect(SHAPE_OF_KIND[kind]).toBeDefined();
  });

  it('counts placement faces on each side, including the top', () => {
    expect([faceCount('box', 'up'), faceCount('box', 'down')]).toEqual([5, 1]);
    expect([faceCount('parcel', 'up'), faceCount('parcel', 'down')]).toEqual([5, 1]);
    expect([faceCount('can', 'up'), faceCount('can', 'down')]).toEqual([2, 1]);
    expect([faceCount('jar', 'up'), faceCount('tube', 'down')]).toEqual([2, 1]);
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

  it('names only the shape in the first note', () => {
    expect(shapeNote('box')).toBe('Shape: cuboid');
    expect(shapeNote('parcel')).toBe('Shape: cuboid');
    expect(shapeNote('can')).toBe('Shape: cylinder');
    expect(shapeNote('prism')).toBe('Shape: triangular prism');
    expect(shapeNote('tetra')).toBe('Shape: tetrahedron');
    expect(shapeName('jar')).toBe('cylinder');
  });
});

describe('orientation', () => {
  const at = (kind: PackageKind, flipPos: number, turn: number) => {
    const s = shownFace(kind, flipPos, turn);
    return `${s.placement.side}:${s.placement.face}${s.upsideDown ? ' upside-down' : ''}`;
  };

  it('has side counts, ring lengths and tops per shape', () => {
    expect([sideCount('box'), sideCount('can'), sideCount('prism'), sideCount('tetra')]).toEqual([4, 1, 3, 4]);
    expect([ringLength('box'), ringLength('tube'), ringLength('prism'), ringLength('tetra')]).toEqual([4, 4, 1, 2]);
    expect([hasTop('box'), hasTop('jar'), hasTop('prism'), hasTop('tetra')]).toEqual([true, true, false, false]);
  });

  it('flips a box through side, top, upside-down opposite side, bottom (face 1)', () => {
    expect([0, 1, 2, 3, 4].map((p) => at('box', p, 0))).toEqual([
      'up:0',
      'up:4',
      'up:2 upside-down',
      'down:0',
      'up:0',
    ]);
  });

  it('flips a box the same way from face 2', () => {
    expect([0, 1, 2, 3].map((p) => at('parcel', p, 1))).toEqual(['up:1', 'up:4', 'up:3 upside-down', 'down:0']);
  });

  it('flips a cylinder through side, top, upside-down side, bottom', () => {
    expect([0, 1, 2, 3, 4].map((p) => at('can', p, 0))).toEqual([
      'up:0',
      'up:1',
      'up:0 upside-down',
      'down:0',
      'up:0',
    ]);
  });

  it('turns the other way once the package is upside-down or at the bottom', () => {
    expect([0, 1, 2, 3].map((p) => rotateDelta('box', p))).toEqual([1, 1, -1, -1]);
    expect([0, 1, 2, 3].map((p) => rotateDelta('can', p))).toEqual([1, 1, -1, -1]);
    expect([0, 1].map((p) => rotateDelta('tetra', p))).toEqual([1, 1]);
    expect(rotateDelta('prism', 0)).toBe(1);
  });

  it('follows the worked example: face 1, top, rotate, upside-down face 4, bottom, rotate, face 1', () => {
    let pos = 0;
    let turn = 0;
    const seen: string[] = [at('box', pos, turn)];
    const flip = () => { pos = (pos + 1) % ringLength('box'); seen.push(at('box', pos, turn)); };
    const rotate = () => { turn += rotateDelta('box', pos); seen.push(at('box', pos, turn)); };
    flip(); // top
    rotate(); // spins on the top
    flip(); // upside-down face 4
    flip(); // bottom
    rotate(); // reverse spin
    flip(); // face 1
    expect(seen).toEqual([
      'up:0',
      'up:4',
      'up:4',
      'up:3 upside-down',
      'down:0',
      'down:0',
      'up:0',
    ]);
  });

  it('rotating on a side upright steps through the four sides and wraps', () => {
    expect([0, 1, 2, 3, 4, 5].map((t) => at('box', 0, t))).toEqual(['up:0', 'up:1', 'up:2', 'up:3', 'up:0', 'up:1']);
    expect([0, 1, 2, 3].map((t) => at('prism', 0, t))).toEqual(['up:0', 'up:1', 'up:2', 'up:0']);
  });

  it('keeps an upside-down package upside-down while rotating and shows other sides', () => {
    expect([0, -1, -2].map((t) => at('box', 2, t))).toEqual([
      'up:2 upside-down',
      'up:1 upside-down',
      'up:0 upside-down',
    ]);
  });

  it('spins the top one way and the bottom the other', () => {
    expect(shownFace('box', 1, 1).spin).toBe(1);
    expect(shownFace('box', 1, 5).spin).toBe(1);
    expect(shownFace('box', 3, 1).spin).toBe(3);
    expect(shownFace('box', 0, 3).spin).toBe(0);
  });

  it('flips a tetrahedron between four up faces and four down faces and never upside-down', () => {
    expect([0, 1, 0].map((p) => at('tetra', p, 2))).toEqual(['up:2', 'down:2', 'up:2']);
    expect(shownFace('tetra', 1, 0).part).toBe('bottom');
  });

  it('never flips a prism', () => {
    expect(at('prism', 0, 4)).toBe('up:1');
    expect(at('prism', 3, 4)).toBe('up:1'); // a stray position collapses back to the only one
  });

  it('derives flipped, face, upsideDown and spin from the position and turn', () => {
    expect(orient('box', 1, 1)).toEqual({ flipPos: 1, turn: 1, flipped: false, face: 4, upsideDown: false, spin: 1 });
    expect(orient('box', 2, 0)).toEqual({ flipPos: 2, turn: 0, flipped: false, face: 2, upsideDown: true, spin: 0 });
    expect(orient('box', 3, 0)).toEqual({ flipPos: 3, turn: 0, flipped: true, face: 0, upsideDown: false, spin: 0 });
    expect(orient('tetra', 1, 3)).toEqual({ flipPos: 1, turn: 3, flipped: true, face: 3, upsideDown: false, spin: 0 });
  });
});
