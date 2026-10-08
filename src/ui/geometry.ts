import type { PackageKind } from '../game/types';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Where the closed package sits on the belt.
export function bodyRect(kind: PackageKind, w: number, h: number): Rect {
  const floor = h - 40;
  switch (kind) {
    case 'box':
      return { x: w / 2 - 80, y: floor - 130, w: 160, h: 130 };
    case 'parcel':
      return { x: w / 2 - 95, y: floor - 90, w: 190, h: 90 };
    case 'can':
      return { x: w / 2 - 50, y: floor - 120, w: 100, h: 120 };
    case 'jar':
      return { x: w / 2 - 55, y: floor - 110, w: 110, h: 110 };
    case 'tube':
      return { x: w / 2 - 35, y: floor - 150, w: 70, h: 150 };
  }
}

// The cutaway of the open box: a back wall with the floor near its bottom.
export interface InsideLayout {
  wall: Rect;
  floorY: number;
  cx: number;
}

export function insideLayout(width: number, height: number): InsideLayout {
  const wall = { x: 24, y: 20, w: width - 48, h: height - 40 };
  return { wall, floorY: wall.y + wall.h - 36, cx: width / 2 };
}
