import type { DefectId, Package, PackageKind, Placement, Side } from './types';

export type Shape = 'cuboid' | 'cylinder' | 'prism' | 'tetra';

export const SHAPE_OF_KIND: Record<PackageKind, Shape> = {
  box: 'cuboid',
  parcel: 'cuboid',
  can: 'cylinder',
  jar: 'cylinder',
  tube: 'cylinder',
  prism: 'prism',
  tetra: 'tetra',
};

const FACES: Record<Shape, Record<Side, number>> = {
  cuboid: { up: 5, down: 1 }, // four sides and the top / the bottom
  cylinder: { up: 2, down: 1 }, // the round side and the top / the bottom
  prism: { up: 3, down: 0 },
  tetra: { up: 4, down: 4 },
};

const SIDE_COUNT: Record<Shape, number> = { cuboid: 4, cylinder: 1, prism: 3, tetra: 4 };
// How many positions a flip cycles through.
const RING_LENGTH: Record<Shape, number> = { cuboid: 4, cylinder: 4, prism: 1, tetra: 2 };

export const sideCount = (kind: PackageKind): number => SIDE_COUNT[SHAPE_OF_KIND[kind]];
export const ringLength = (kind: PackageKind): number => RING_LENGTH[SHAPE_OF_KIND[kind]];
export const hasTop = (kind: PackageKind): boolean => {
  const shape = SHAPE_OF_KIND[kind];
  return shape === 'cuboid' || shape === 'cylinder';
};

const mod = (n: number, m: number): number => ((n % m) + m) % m;

export type FacePart = 'side' | 'top' | 'bottom';

export interface Shown {
  placement: Placement;
  part: FacePart;
  upsideDown: boolean;
  spin: number; // quarter turns the top or bottom picture is spun by
}

// The face on show, from where the package is in its flip cycle and how often it has been turned.
export function shownFace(kind: PackageKind, flipPos: number, turn: number): Shown {
  const shape = SHAPE_OF_KIND[kind];
  const sides = SIDE_COUNT[shape];
  const pos = mod(flipPos, RING_LENGTH[shape]);
  if (shape === 'prism') {
    return { placement: { side: 'up', face: mod(turn, sides) }, part: 'side', upsideDown: false, spin: 0 };
  }
  if (shape === 'tetra') {
    return pos === 0
      ? { placement: { side: 'up', face: mod(turn, sides) }, part: 'side', upsideDown: false, spin: 0 }
      : { placement: { side: 'down', face: mod(turn, sides) }, part: 'bottom', upsideDown: false, spin: 0 };
  }
  // Cuboids and cylinders: side, top, the opposite side upside-down, bottom.
  switch (pos) {
    case 0:
      return { placement: { side: 'up', face: mod(turn, sides) }, part: 'side', upsideDown: false, spin: 0 };
    case 1:
      return { placement: { side: 'up', face: sides }, part: 'top', upsideDown: false, spin: mod(turn, 4) };
    case 2:
      return { placement: { side: 'up', face: mod(turn + 2, sides) }, part: 'side', upsideDown: true, spin: 0 };
    default:
      return { placement: { side: 'down', face: 0 }, part: 'bottom', upsideDown: false, spin: mod(-turn, 4) };
  }
}

// The package spins the other way once it is upside-down (and on the bottom).
export function rotateDelta(kind: PackageKind, flipPos: number): 1 | -1 {
  return RING_LENGTH[SHAPE_OF_KIND[kind]] >= 4 && mod(flipPos, 4) >= 2 ? -1 : 1;
}

export interface Orientation {
  flipPos: number;
  turn: number;
  flipped: boolean; // the face on show is on the down side
  face: number; // its index on that side
  upsideDown: boolean;
  spin: number;
}

// The fields kept in the handling so the rest of the game need not know about the ring.
export function orient(kind: PackageKind, flipPos: number, turn: number): Orientation {
  const shown = shownFace(kind, flipPos, turn);
  return {
    flipPos: mod(flipPos, RING_LENGTH[SHAPE_OF_KIND[kind]]),
    turn,
    flipped: shown.placement.side === 'down',
    face: shown.placement.face,
    upsideDown: shown.upsideDown,
    spin: shown.spin,
  };
}

export const faceCount = (kind: PackageKind, side: Side): number => FACES[SHAPE_OF_KIND[kind]][side];

export const faceKey = (side: Side, face: number): string => `${side}:${face}`;

// These live on the underside, so you only find them by flipping.
const UNDERSIDE: readonly DefectId[] = ['bottomless', 'wet_cardboard'];

export const isUndersideDefect = (defect: DefectId): boolean => UNDERSIDE.includes(defect);

// These sit on one particular up face.
export const SURFACE_DEFECTS: readonly DefectId[] = [
  'leaking',
  'crushed_corner',
  'torn_tape',
  'bulging',
  'missing_label',
];

// Everything else (UV-only glows, storms) has no face: it shows whichever face is up.
export const isFaceless = (defect: DefectId): boolean =>
  !SURFACE_DEFECTS.includes(defect) && !isUndersideDefect(defect);

export function placementOf(pkg: Package, defect: DefectId): Placement {
  return pkg.placements?.[defect] ?? { side: isUndersideDefect(defect) ? 'down' : 'up', face: 0 };
}

const SHAPE_NAMES: Record<Shape, string> = {
  cuboid: 'cuboid',
  cylinder: 'cylinder',
  prism: 'triangular prism',
  tetra: 'tetrahedron',
};

export const shapeName = (kind: PackageKind): string => SHAPE_NAMES[SHAPE_OF_KIND[kind]];

// The note names the shape only; how it turns is explained on the Shapes tab.
export const shapeNote = (kind: PackageKind): string => `Shape: ${shapeName(kind)}`;
