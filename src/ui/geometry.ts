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
    case 'prism':
      return { x: w / 2 - 90, y: floor - 95, w: 180, h: 95 };
    case 'tetra':
      return { x: w / 2 - 75, y: floor - 130, w: 150, h: 130 };
  }
}

// Where the contents label goes (or is missing). A tetrahedron's is lower, where the triangle is wide.
export function labelRect(kind: PackageKind, b: Rect): Rect {
  if (kind === 'tetra') return { x: b.x + b.w * 0.3, y: b.y + b.h * 0.62, w: b.w * 0.4, h: b.h * 0.26 };
  return { x: b.x + b.w * 0.2, y: b.y + b.h * 0.4, w: b.w * 0.6, h: b.h * 0.3 };
}

// The hole in a missing bottom. A tetrahedron's is smaller and lower so it fits the triangle.
export function voidRect(kind: PackageKind, b: Rect): Rect {
  if (kind === 'tetra') return { x: b.x + b.w * 0.34, y: b.y + b.h * 0.5, w: b.w * 0.32, h: b.h * 0.34 };
  return { x: b.x + b.w * 0.14, y: b.y + b.h * 0.16, w: b.w * 0.72, h: b.h * 0.68 };
}

// Where an applied repair patch goes. A tetrahedron's sits lower, where the triangle is wide enough.
export function patchRect(kind: PackageKind, b: Rect): Rect {
  if (kind === 'tetra') return { x: b.x + b.w * 0.4, y: b.y + b.h * 0.45, w: b.w * 0.2, h: 14 };
  return { x: b.x + b.w * 0.1, y: b.y + b.h * 0.1, w: b.w * 0.3, h: 14 };
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

export interface ItemSlot {
  cx: number;
  scale: number;
  rect: Rect;
}

const MAX_SCALE = 1.5;
// Roughly how wide an item is drawn at scale 1.
const DRAWN_WIDTH_AT_SCALE_1 = 52;

// Items stand side by side on the floor of the cutaway, scaled down until each fits its slot.
export function itemSlots(count: number, width: number, height: number): ItemSlot[] {
  if (count === 0) return [];
  const { wall, floorY, cx } = insideLayout(width, height);
  const gap = Math.min(80 * MAX_SCALE, (wall.w - 16) / count);
  const scale = Math.min(MAX_SCALE, gap / DRAWN_WIDTH_AT_SCALE_1);
  const left = cx - (gap * (count - 1)) / 2;
  const top = Math.max(wall.y + 24, floorY - 70 * scale);
  return Array.from({ length: count }, (_, i) => {
    const x = left + i * gap;
    return {
      cx: x,
      scale,
      rect: { x: x - gap / 2, y: top, w: gap, h: floorY + 30 - top },
    };
  });
}
