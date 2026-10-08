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
  cuboid: { up: 4, down: 1 },
  cylinder: { up: 1, down: 1 },
  prism: { up: 3, down: 0 },
  tetra: { up: 4, down: 4 },
};

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

const SHAPE_NOTES: Record<Shape, string> = {
  cuboid: 'Shape: cuboid. Four sides to rotate; flip it for the underside.',
  cylinder: 'Shape: cylinder. One round side; flip it for the base.',
  prism: 'Shape: triangular prism. Three sides to rotate; it cannot be flipped.',
  tetra: 'Shape: tetrahedron. Four sides to rotate; flip it for four more.',
};

export const shapeNote = (kind: PackageKind): string => SHAPE_NOTES[SHAPE_OF_KIND[kind]];
