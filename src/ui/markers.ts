import { viewOf } from '../game/handling';
import { markerClues, visibleDefects } from '../game/inspection';
import type { DefectId, Handling, Package, View } from '../game/types';
import { bodyRect, insideLayout, type InsideLayout, type Rect } from './geometry';

export interface Marker {
  defect: DefectId;
  view: View;
  rect: Rect;
}

type OnBody = (b: Rect) => Rect;

const FRONT: Partial<Record<DefectId, OnBody>> = {
  leaking: (b) => ({ x: b.x + b.w * 0.15, y: b.y + b.h, w: b.w * 0.7, h: 24 }),
  crushed_corner: (b) => ({ x: b.x + b.w - 44, y: b.y, w: 44, h: 44 }),
  torn_tape: (b) => ({ x: b.x, y: b.y, w: b.w, h: 14 }),
  bulging: (b) => ({ x: b.x - b.w * 0.12, y: b.y, w: b.w * 1.24, h: b.h }),
  missing_label: (b) => ({ x: b.x + b.w * 0.2, y: b.y + b.h * 0.4, w: b.w * 0.6, h: b.h * 0.3 }),
  wet_cardboard: (b) => ({ x: b.x, y: b.y + b.h * 0.6, w: b.w, h: b.h * 0.4 }),
  bottomless: (b) => ({ x: b.x + b.w * 0.1, y: b.y + b.h - 6, w: b.w * 0.8, h: 26 }),
  scorching: (b) => ({ x: b.x - 10, y: b.y - 10, w: b.w + 20, h: b.h + 20 }),
  tiny_weather: (b) => ({ x: b.x + b.w / 2 - 30, y: b.y - 40, w: 60, h: 46 }),
};

const BACK: Partial<Record<DefectId, OnBody>> = {
  bottomless: (b) => ({ x: b.x + b.w * 0.14, y: b.y + b.h * 0.16, w: b.w * 0.72, h: b.h * 0.68 }),
  wet_cardboard: (b) => ({ x: b.x + b.w * 0.08, y: b.y + b.h * 0.4, w: b.w * 0.44, h: b.h * 0.4 }),
  crushed_corner: (b) => ({ x: b.x + b.w - 44, y: b.y, w: 44, h: 44 }),
  bulging: (b) => ({ x: b.x + 8, y: b.y + 8, w: b.w - 16, h: b.h - 16 }),
};

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
  const body = bodyRect(pkg.kind, width, height);
  const layout = insideLayout(width, height);
  const markers: Marker[] = [];
  for (const defect of visibleDefects(pkg, handling, view)) {
    const rect =
      view === 'inside'
        ? INSIDE[defect]?.(layout)
        : (view === 'front' ? FRONT : BACK)[defect]?.(body);
    if (rect) markers.push({ defect, view, rect });
  }
  return markers;
}

// True once everything the marker would record is already in the notes.
export function markerNoted(pkg: Package, handling: Handling, marker: Marker): boolean {
  const clues = markerClues(pkg, handling, marker.defect, marker.view);
  return clues.length > 0 && clues.every((c) => handling.notes.includes(c.key));
}
