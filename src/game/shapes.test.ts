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
  shownFace,
  sideCount,
  typeNamesFor,
  typeNote,
} from './shapes';
import type { PackageKind } from './types';

const KINDS: PackageKind[] = ['box', 'can', 'parcel', 'jar', 'tube', 'prism', 'tetra', 'octa'];

describe('shapes', () => {
  it('gives every kind a shape', () => {
    for (const kind of KINDS) expect(SHAPE_OF_KIND[kind]).toBeDefined();
    expect(SHAPE_OF_KIND.octa).toBe('octa');
  });

  it('counts placement faces on each side, including the top', () => {
    expect([faceCount('box', 'up'), faceCount('box', 'down')]).toEqual([5, 1]);
    expect([faceCount('parcel', 'up'), faceCount('parcel', 'down')]).toEqual([5, 1]);
    expect([faceCount('can', 'up'), faceCount('can', 'down')]).toEqual([3, 1]);
    expect([faceCount('jar', 'up'), faceCount('tube', 'down')]).toEqual([3, 1]);
    expect([faceCount('prism', 'up'), faceCount('prism', 'down')]).toEqual([4, 1]);
    expect([faceCount('tetra', 'up'), faceCount('tetra', 'down')]).toEqual([4, 1]);
    expect([faceCount('octa', 'up'), faceCount('octa', 'down')]).toEqual([4, 4]);
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

  it('names the package by its type in the first note', () => {
    expect(typeNote(makePackage({ kind: 'box' }))).toBe('Type: box');
    expect(typeNote(makePackage({ kind: 'can' }))).toBe('Type: can');
    expect(typeNote(makePackage({ kind: 'prism', typeName: 'wedge' }))).toBe('Type: wedge');
    expect(typeNote(makePackage({ kind: 'tetra', typeName: 'caltrops' }))).toBe('Type: caltrops');
    expect(typeNote(makePackage({ kind: 'octa', typeName: 'pyrite' }))).toBe('Type: pyrite');
  });

  it('lists the type names each kind can go by', () => {
    for (const kind of ['box', 'parcel', 'can', 'jar', 'tube'] as const) expect(typeNamesFor(kind)).toEqual([kind]);
    expect(typeNamesFor('prism')).toEqual(['tent', 'wedge']);
    expect(typeNamesFor('tetra')).toEqual(['pyraminx', 'caltrops']);
    expect(typeNamesFor('octa')).toEqual(['diamond', 'pyrite']);
  });

  it('defaults a test package type name from its kind', () => {
    expect(makePackage().typeName).toBe('box');
    expect(makePackage({ kind: 'jar' }).typeName).toBe('jar');
    expect(makePackage({ kind: 'prism' }).typeName).toBe('tent');
    expect(makePackage({ kind: 'tetra' }).typeName).toBe('pyraminx');
    expect(makePackage({ kind: 'octa' }).typeName).toBe('diamond');
  });
});

describe('orientation', () => {
  const at = (kind: PackageKind, flipPos: number, turn: number) => {
    const s = shownFace(kind, flipPos, turn);
    return `${s.placement.side}:${s.placement.face}${s.upsideDown ? ' upside-down' : ''}`;
  };

  it('has side counts, ring lengths and tops per shape', () => {
    expect([sideCount('box'), sideCount('can'), sideCount('prism'), sideCount('tetra'), sideCount('octa')]).toEqual([
      4, 2, 3, 4, 4,
    ]);
    expect([ringLength('box'), ringLength('tube'), ringLength('prism'), ringLength('tetra'), ringLength('octa')]).toEqual([
      4, 4, 4, 2, 2,
    ]);
    expect([hasTop('box'), hasTop('parcel'), hasTop('can'), hasTop('jar'), hasTop('tube'), hasTop('prism')]).toEqual([
      true, true, true, true, true, true,
    ]);
    expect([hasTop('tetra'), hasTop('octa')]).toEqual([false, false]);
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

  it('flips a cylinder through side, top (face 3), the same side upside-down, bottom', () => {
    expect([0, 1, 2, 3, 4].map((p) => at('can', p, 0))).toEqual([
      'up:0',
      'up:2',
      'up:0 upside-down',
      'down:0',
      'up:0',
    ]);
  });

  it('rotates a cylinder between its front and back', () => {
    expect([0, 1, 2].map((t) => at('can', 0, t))).toEqual(['up:0', 'up:1', 'up:0']);
    expect(at('jar', 2, 1)).toBe('up:1 upside-down');
    expect(orient('can', 1, 0).face).toBe(2);
  });

  it('spins a cylinder on its top as for boxes', () => {
    expect([0, 1, 2, 3, 4].map((t) => shownFace('can', 1, t).spin)).toEqual([0, 1, 2, 3, 0]);
    expect([0, 1, 2, 3, 4].map((t) => at('can', 1, t))).toEqual(['up:2', 'up:2', 'up:2', 'up:2', 'up:2']);
    expect(shownFace('tube', 3, 1).spin).toBe(3);
  });

  it('turns the other way once the package is upside-down or at the bottom', () => {
    expect([0, 1, 2, 3].map((p) => rotateDelta('box', p))).toEqual([1, 1, -1, -1]);
    expect([0, 1, 2, 3].map((p) => rotateDelta('can', p))).toEqual([1, 1, -1, -1]);
    expect([0, 1, 2, 3].map((p) => rotateDelta('prism', p))).toEqual([1, 1, -1, -1]);
    expect([0, 1].map((p) => rotateDelta('tetra', p))).toEqual([1, 1]);
    expect([0, 1].map((p) => rotateDelta('octa', p))).toEqual([1, 1]);
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

  it('flips an octahedron between four up faces and four down faces and never upside-down', () => {
    expect([0, 1, 0].map((p) => at('octa', p, 2))).toEqual(['up:2', 'down:2', 'up:2']);
    expect([0, 1, 2, 3, 4].map((t) => at('octa', 0, t))).toEqual(['up:0', 'up:1', 'up:2', 'up:3', 'up:0']);
    expect([0, 1, 2, 3, 4].map((t) => at('octa', 1, t))).toEqual(['down:0', 'down:1', 'down:2', 'down:3', 'down:0']);
    expect(shownFace('octa', 1, 0).part).toBe('bottom');
  });

  it('flips a tetrahedron between its four faces and its one bottom', () => {
    expect([0, 1, 2, 3, 4].map((t) => at('tetra', 0, t))).toEqual(['up:0', 'up:1', 'up:2', 'up:3', 'up:0']);
    expect([0, 1, 2, 3, 5].map((t) => at('tetra', 1, t))).toEqual(['down:0', 'down:0', 'down:0', 'down:0', 'down:0']);
    expect(shownFace('tetra', 1, 2).part).toBe('bottom');
    expect([0, 1, 2].map((p) => at('tetra', p, 2))).toEqual(['up:2', 'down:0', 'up:2']);
  });

  it('flips a prism through side, top, the opposite side upside-down, bottom', () => {
    expect([0, 1, 2, 3, 4].map((p) => at('prism', p, 0))).toEqual([
      'up:0',
      'up:3',
      'up:2 upside-down',
      'down:0',
      'up:0',
    ]);
    expect(shownFace('prism', 1, 0).part).toBe('top');
    expect(shownFace('prism', 3, 0).part).toBe('bottom');
  });

  it('flips a prism the same way from its second side, never spinning the top and bottom', () => {
    expect([0, 1, 2, 3].map((p) => at('prism', p, 1))).toEqual(['up:1', 'up:3', 'up:0 upside-down', 'down:0']);
    expect(shownFace('prism', 1, 1).spin).toBe(0);
    expect(shownFace('prism', 3, 1).spin).toBe(0);
  });

  it('derives flipped, face, upsideDown and spin from the position and turn', () => {
    expect(orient('box', 1, 1)).toEqual({ flipPos: 1, turn: 1, flipped: false, face: 4, upsideDown: false, spin: 1 });
    expect(orient('box', 2, 0)).toEqual({ flipPos: 2, turn: 0, flipped: false, face: 2, upsideDown: true, spin: 0 });
    expect(orient('box', 3, 0)).toEqual({ flipPos: 3, turn: 0, flipped: true, face: 0, upsideDown: false, spin: 0 });
    expect(orient('octa', 1, 3)).toEqual({ flipPos: 1, turn: 3, flipped: true, face: 3, upsideDown: false, spin: 0 });
    expect(orient('tetra', 1, 3)).toEqual({ flipPos: 1, turn: 3, flipped: true, face: 0, upsideDown: false, spin: 0 });
  });
});
