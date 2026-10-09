import { describe, expect, it } from 'vitest';
import { newHandling } from '../game/handling';
import { makePackage } from '../game/testing';
import type { DefectId } from '../game/types';
import { bodyRect, insideLayout, itemSlots, labelRect, shippingLabelRect } from './geometry';
import { itemMarkersFor, labelMarkersFor, markerNoted, markersFor } from './markers';

const W = 320;
const H = 260;
const front = newHandling();
const flipped = { ...newHandling(), flipped: true, used: ['look' as const, 'rotate' as const] };
const open = { ...newHandling(), opened: true };

describe('markersFor', () => {
  it('has no markers on a clean package', () => {
    expect(markersFor(makePackage(), front, W, H)).toEqual([]);
  });

  it('puts a marker on each defect visible from the front', () => {
    const pkg = makePackage({ kind: 'can', defects: ['leaking', 'rattling'] });
    const markers = markersFor(pkg, front, W, H);
    expect(markers.map((m) => [m.defect, m.view])).toEqual([['leaking', 'front']]);
    const body = bodyRect('can', W, H);
    expect(markers[0].rect.y).toBeGreaterThanOrEqual(body.y + body.h); // the drip is below the can
  });

  it('shows a front marker for torn tape along the top edge', () => {
    const body = bodyRect('box', W, H);
    const [m] = markersFor(makePackage({ defects: ['torn_tape'] }), front, W, H);
    expect(m.rect).toEqual({ x: body.x, y: body.y, w: body.w, h: 14 });
  });

  it('keeps flip-only defects off the front and shows them on the back', () => {
    const pkg = makePackage({ defects: ['bottomless', 'wet_cardboard'] });
    expect(markersFor(pkg, { ...front, used: ['look', 'rotate'] }, W, H)).toEqual([]);
    expect(markersFor(pkg, flipped, W, H).map((m) => [m.defect, m.view])).toEqual([
      ['bottomless', 'back'],
      ['wet_cardboard', 'back'],
    ]);
  });

  it('shows interior markers only inside', () => {
    const pkg = makePackage({ defects: ['bottomless', 'tiny_weather', 'torn_tape'] });
    const inside = markersFor(pkg, open, W, H);
    expect(inside.map((m) => [m.defect, m.view])).toEqual([
      ['bottomless', 'inside'],
      ['tiny_weather', 'inside'],
    ]);
  });

  it('hides the marker of a repaired defect', () => {
    const pkg = makePackage({ defects: ['bottomless'] });
    expect(markersFor(pkg, { ...open, repaired: ['bottomless'] }, W, H)).toEqual([]);
  });

  it('keeps every marker inside the canvas, in every view', () => {
    const all: DefectId[] = [
      'leaking', 'crushed_corner', 'torn_tape', 'bulging', 'wet_cardboard', 'missing_label',
      'bottomless', 'humming', 'whispering', 'ticking', 'scorching', 'future_contents', 'tiny_weather',
    ];
    const handlings = [
      { ...front, used: ['look' as const, 'uv' as const, 'pebble' as const] },
      flipped,
      open,
    ];
    for (const kind of ['box', 'can', 'parcel', 'jar', 'tube'] as const) {
      for (const h of handlings) {
        for (const m of markersFor(makePackage({ kind, defects: all }), h, W, H)) {
          expect(m.rect.x, `${kind} ${m.defect}`).toBeGreaterThanOrEqual(0);
          expect(m.rect.y, `${kind} ${m.defect}`).toBeGreaterThanOrEqual(0);
          expect(m.rect.x + m.rect.w, `${kind} ${m.defect}`).toBeLessThanOrEqual(W);
          expect(m.rect.y + m.rect.h, `${kind} ${m.defect}`).toBeLessThanOrEqual(H);
        }
      }
    }
  });

  it('places inside markers relative to the floor of the cutaway', () => {
    const { floorY } = insideLayout(W, H);
    const [m] = markersFor(makePackage({ defects: ['bottomless'] }), open, W, H);
    expect(m.rect.y).toBeLessThanOrEqual(floorY);
    expect(m.rect.y + m.rect.h).toBeGreaterThanOrEqual(floorY);
  });
});

describe('markerNoted', () => {
  it('is false until every clue of the marker is recorded', () => {
    const pkg = makePackage({ kind: 'can', defects: ['leaking'] });
    const h = { ...front, used: ['look' as const, 'uv' as const] };
    const [m] = markersFor(pkg, h, W, H);
    expect(markerNoted(pkg, h, m)).toBe(false);
    expect(markerNoted(pkg, { ...h, notes: ['look:leaking'] }, m)).toBe(false);
    expect(markerNoted(pkg, { ...h, notes: ['look:leaking', 'uv:leaking'] }, m)).toBe(true);
  });
});

describe('new shapes', () => {
  it('puts the missing-label marker on the label rectangle for every kind', () => {
    for (const kind of ['box', 'can', 'parcel', 'jar', 'tube', 'prism', 'tetra'] as const) {
      const body = bodyRect(kind, W, H);
      const pkg = makePackage({ kind, defects: ['missing_label'] });
      const [m] = markersFor(pkg, front, W, H);
      expect(m.rect, kind).toEqual(labelRect(kind, body));
    }
  });

  it('keeps every marker of a prism and a tetrahedron inside the canvas', () => {
    const faceHandlings = [
      { ...front, used: ['look' as const, 'uv' as const, 'pebble' as const] },
      { ...flipped, face: 2 },
      open,
    ];
    for (const kind of ['prism', 'tetra'] as const) {
      for (const h of faceHandlings) {
        for (const m of markersFor(makePackage({ kind, defects: ['missing_label', 'bottomless', 'torn_tape'] }), h, W, H)) {
          expect(m.rect.x + m.rect.w).toBeLessThanOrEqual(W);
          expect(m.rect.y + m.rect.h).toBeLessThanOrEqual(H);
          expect(m.rect.x).toBeGreaterThanOrEqual(0);
          expect(m.rect.y).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
});

describe('item markers', () => {
  const leaky = { id: 2, name: 'honey', art: 'dome' as const, color: '#e0a020', weightKg: 0.5, leaking: true };
  const fine = { id: 1, name: 'pickles', art: 'dome' as const, color: '#6b8e23', weightKg: 0.5 };
  const pkg = makePackage({ defects: ['wet_cardboard'], contents: [fine, leaky] });

  it('marks only unsealed leaking items, only inside', () => {
    expect(itemMarkersFor(pkg, front, W, H)).toEqual([]);
    expect(itemMarkersFor(pkg, open, W, H).map((m) => m.itemId)).toEqual([2]);
    expect(itemMarkersFor(pkg, { ...open, sealed: [2] }, W, H)).toEqual([]);
    expect(itemMarkersFor(pkg, { ...open, discarded: [2] }, W, H)).toEqual([]);
  });

  it('places the marker over the item slot', () => {
    const [m] = itemMarkersFor(pkg, open, W, H);
    expect(m.rect).toEqual(itemSlots(2, W, H)[1].rect);
  });
});

describe('label markers', () => {
  const box = makePackage({ kind: 'box', labelFace: 2 });

  it('offers the shipping label on face 1 and the contents label on its own face', () => {
    expect(labelMarkersFor(box, front, W, H).map((m) => m.label)).toEqual(['shipping']);
    expect(labelMarkersFor(box, { ...front, face: 2 }, W, H).map((m) => m.label)).toEqual(['contents']);
    expect(labelMarkersFor(box, { ...front, face: 1 }, W, H)).toEqual([]);
  });

  it('offers both on one face when they share it', () => {
    expect(labelMarkersFor(makePackage({ kind: 'can', labelFace: 0 }), front, W, H).map((m) => m.label)).toEqual([
      'shipping',
      'contents',
    ]);
  });

  it('offers no label when the box is open or flipped', () => {
    expect(labelMarkersFor(box, open, W, H)).toEqual([]);
    expect(labelMarkersFor(box, flipped, W, H)).toEqual([]);
  });

  it('has no contents label to click while it is missing, but does once it is reprinted', () => {
    const lost = makePackage({ kind: 'can', defects: ['missing_label'], labelFace: 0 });
    expect(labelMarkersFor(lost, front, W, H).map((m) => m.label)).toEqual(['shipping']);
    expect(
      labelMarkersFor(lost, { ...front, repaired: ['missing_label'] }, W, H).map((m) => m.label),
    ).toEqual(['shipping', 'contents']);
  });

  it('places the markers on the label rectangles', () => {
    const b = bodyRect('box', W, H);
    const [ship] = labelMarkersFor(box, front, W, H);
    expect(ship.rect).toEqual(shippingLabelRect('box', b));
    const [cont] = labelMarkersFor(box, { ...front, face: 2 }, W, H);
    expect(cont.rect).toEqual(labelRect('box', b));
  });
});
