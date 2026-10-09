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

// The shipping (address) label sits above the contents label. A tetrahedron's is higher and narrower.
export function shippingLabelRect(kind: PackageKind, b: Rect): Rect {
  if (kind === 'tetra') return { x: b.x + b.w * 0.36, y: b.y + b.h * 0.36, w: b.w * 0.28, h: b.h * 0.2 };
  return { x: b.x + b.w * 0.2, y: b.y + b.h * 0.14, w: b.w * 0.6, h: b.h * 0.22 };
}

// The hole in a missing bottom. A tetrahedron's is smaller and lower so it fits the triangle.
export function voidRect(kind: PackageKind, b: Rect): Rect {
  if (kind === 'tetra') return { x: b.x + b.w * 0.34, y: b.y + b.h * 0.5, w: b.w * 0.32, h: b.h * 0.34 };
  return { x: b.x + b.w * 0.14, y: b.y + b.h * 0.16, w: b.w * 0.72, h: b.h * 0.68 };
}

// The square the top and bottom of a package are drawn in (a disk for a cylinder).
export function faceSquare(_kind: PackageKind, b: Rect): Rect {
  const side = Math.min(b.w, b.h);
  return { x: b.x + (b.w - side) / 2, y: b.y + (b.h - side) / 2, w: side, h: side };
}

// Turns a rectangle clockwise by whole quarter turns about a point.
export function rotateRect(r: Rect, cx: number, cy: number, quarters: number): Rect {
  const q = ((quarters % 4) + 4) % 4;
  let dx = r.x - cx;
  let dy = r.y - cy;
  let w = r.w;
  let h = r.h;
  for (let i = 0; i < q; i++) {
    const nx = -(dy + h);
    const ny = dx;
    dx = nx;
    dy = ny;
    [w, h] = [h, w];
  }
  return { x: cx + dx + 0, y: cy + dy + 0, w, h };
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

// Moves a rectangle the least distance needed to lie inside the bounds (centred if it is larger).
export function clampInside(r: Rect, bounds: Rect): Rect {
  const fit = (pos: number, size: number, lo: number, span: number): number =>
    size >= span ? lo + (span - size) / 2 : Math.min(Math.max(pos, lo), lo + span - size);
  return { ...r, x: fit(r.x, r.w, bounds.x, bounds.w), y: fit(r.y, r.h, bounds.y, bounds.h) };
}
