import { itemsIn } from '../game/contents';
import { viewOf } from '../game/handling';
import { markerClues, visibleDefects } from '../game/inspection';
import { SHAPE_OF_KIND, shownFace } from '../game/shapes';
import type { DefectId, Handling, Package, PackageKind, View } from '../game/types';
import {
  bodyRect,
  faceSquare,
  insideLayout,
  itemSlots,
  labelRect,
  rotateRect,
  shippingLabelRect,
  voidRect,
  type InsideLayout,
  type Rect,
} from './geometry';

export interface Marker {
  defect: DefectId;
  view: View;
  rect: Rect;
}

type OnBody = (b: Rect, kind: PackageKind) => Rect;

const FRONT: Partial<Record<DefectId, OnBody>> = {
  leaking: (b) => ({ x: b.x + b.w * 0.15, y: b.y + b.h, w: b.w * 0.7, h: 24 }),
  crushed_corner: (b) => ({ x: b.x + b.w - 44, y: b.y, w: 44, h: 44 }),
  torn_tape: (b) => ({ x: b.x, y: b.y, w: b.w, h: 14 }),
  bulging: (b) => ({ x: b.x - b.w * 0.12, y: b.y, w: b.w * 1.24, h: b.h }),
  missing_label: (b, kind) => labelRect(kind, b),
  bottomless: (b) => ({ x: b.x + b.w * 0.1, y: b.y + b.h - 6, w: b.w * 0.8, h: 26 }),
  scorching: (b) => ({ x: b.x - 10, y: b.y - 10, w: b.w + 20, h: b.h + 20 }),
  tiny_weather: (b) => ({ x: b.x + b.w / 2 - 30, y: b.y - 40, w: 60, h: 46 }),
};

// On the top, relative to the face square (the torn tape is the seam across the middle).
const TOP: Partial<Record<DefectId, OnBody>> = {
  torn_tape: (s) => ({ x: s.x, y: s.y + s.h * 0.43, w: s.w, h: 14 }),
};

// Underside defects, relative to the face square (or the body for a tetrahedron).
const BACK: Partial<Record<DefectId, OnBody>> = {
  bottomless: (b, kind) => voidRect(kind, b),
  wet_cardboard: (b) => ({ x: b.x + b.w * 0.08, y: b.y + b.h * 0.4, w: b.w * 0.44, h: b.h * 0.4 }),
};

const turnAbout = (r: Rect, about: Rect, quarters: number): Rect =>
  rotateRect(r, about.x + about.w / 2, about.y + about.h / 2, quarters);

// Where a defect is on the face now showing, in canvas coordinates.
export function markerRectFor(
  pkg: Package,
  handling: Handling,
  defect: DefectId,
  width: number,
  height: number,
): Rect | undefined {
  const body = bodyRect(pkg.kind, width, height);
  const shown = shownFace(pkg.kind, handling.flipPos, handling.turn);
  if (shown.part === 'top') {
    const sq = faceSquare(pkg.kind, body);
    const r = TOP[defect]?.(sq, pkg.kind);
    return r && turnAbout(r, sq, shown.spin);
  }
  if (shown.part === 'bottom') {
    const tetra = SHAPE_OF_KIND[pkg.kind] === 'tetra';
    const area = tetra ? body : faceSquare(pkg.kind, body);
    const r = BACK[defect]?.(area, pkg.kind);
    return r && (tetra ? r : turnAbout(r, area, shown.spin));
  }
  const r = FRONT[defect]?.(body, pkg.kind);
  return r && (shown.upsideDown ? turnAbout(r, body, 2) : r);
}

type InLayout = (l: InsideLayout) => Rect;

// Rectangles line up with the cutaway drawing in packageArt.ts (contents drawn at 1.7x).
const INSIDE: Partial<Record<DefectId, InLayout>> = {
  bottomless: (l) => ({ x: l.cx - 75, y: l.floorY - 8, w: 150, h: 46 }),
  tiny_weather: (l) => ({ x: l.cx - 52, y: l.floorY - 112, w: 104, h: 108 }),
  leaking: (l) => ({ x: l.cx - 85, y: l.floorY + 4, w: 170, h: 26 }),
  ticking: (l) => ({ x: l.cx - 30, y: l.floorY - 76, w: 60, h: 60 }),
  scorching: (l) => ({ x: l.cx - 80, y: l.floorY - 100, w: 160, h: 100 }),
  future_contents: (l) => ({ x: l.cx - 36, y: l.floorY - 70, w: 72, h: 56 }),
  humming: (l) => ({ x: l.cx - 40, y: l.floorY - 86, w: 80, h: 86 }),
  whispering: (l) => ({ x: l.cx - 40, y: l.floorY - 86, w: 80, h: 86 }),
};

export function markersFor(pkg: Package, handling: Handling, width: number, height: number): Marker[] {
  const view = viewOf(handling);
  const layout = insideLayout(width, height);
  const markers: Marker[] = [];
  for (const defect of visibleDefects(pkg, handling, view)) {
    const rect = view === 'inside' ? INSIDE[defect]?.(layout) : markerRectFor(pkg, handling, defect, width, height);
    if (rect) markers.push({ defect, view, rect });
  }
  return markers;
}

// True once everything the marker would record is already in the notes.
export function markerNoted(pkg: Package, handling: Handling, marker: Marker): boolean {
  const clues = markerClues(pkg, handling, marker.defect, marker.view);
  return clues.length > 0 && clues.every((c) => handling.notes.includes(c.key));
}

export interface ItemMarker {
  itemId: number;
  rect: Rect;
}

// A leaking item that has not been sealed gets a marker on the inside screen.
export function itemMarkersFor(pkg: Package, handling: Handling, width: number, height: number): ItemMarker[] {
  if (viewOf(handling) !== 'inside') return [];
  const items = itemsIn(pkg, handling);
  const slots = itemSlots(items.length, width, height);
  return items.flatMap((item, i) =>
    item.leaking && !handling.sealed.includes(item.id) ? [{ itemId: item.id, rect: slots[i].rect }] : [],
  );
}

export interface LabelMarker {
  label: 'shipping' | 'contents';
  rect: Rect;
}

// The two labels on the outside, each clickable only on the side it sits on (turned with it).
export function labelMarkersFor(pkg: Package, handling: Handling, width: number, height: number): LabelMarker[] {
  const shown = shownFace(pkg.kind, handling.flipPos, handling.turn);
  if (viewOf(handling) !== 'front' || shown.part !== 'side') return [];
  const body = bodyRect(pkg.kind, width, height);
  const turned = (r: Rect): Rect => (shown.upsideDown ? turnAbout(r, body, 2) : r);
  const { side, face } = shown.placement;
  const markers: LabelMarker[] = [];
  if (side === 'up' && face === 0) markers.push({ label: 'shipping', rect: turned(shippingLabelRect(pkg.kind, body)) });
  const lost = pkg.defects.includes('missing_label') && !handling.repaired.includes('missing_label');
  if (side === 'up' && face === pkg.labelFace && !lost) {
    markers.push({ label: 'contents', rect: turned(labelRect(pkg.kind, body)) });
  }
  return markers;
}
