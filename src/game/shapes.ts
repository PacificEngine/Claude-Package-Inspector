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

const SHAPE_NAMES: Record<Shape, string> = {
  cuboid: 'cuboid',
  cylinder: 'cylinder',
  prism: 'triangular prism',
  tetra: 'tetrahedron',
};

export const shapeName = (kind: PackageKind): string => SHAPE_NAMES[SHAPE_OF_KIND[kind]];

// The note names the shape only; how it turns is explained on the Shapes tab.
export const shapeNote = (kind: PackageKind): string => `Shape: ${shapeName(kind)}`;
