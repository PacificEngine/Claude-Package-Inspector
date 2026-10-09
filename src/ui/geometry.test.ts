import { describe, expect, it } from 'vitest';
import { bodyRect, clampInside, faceSquare, insideLayout, itemSlots, labelRect, rotateRect, shippingLabelRect, voidRect } from './geometry';

describe('itemSlots', () => {
  it('gives no slots for no items', () => {
    expect(itemSlots(0, 320, 260)).toEqual([]);
  });

  it('puts one item in the middle at full size', () => {
    const [slot] = itemSlots(1, 320, 260);
    expect(slot.cx).toBe(160);
    expect(slot.scale).toBeGreaterThanOrEqual(1.3);
  });

  it('spreads up to six items inside the wall without overlapping, shrinking them as they multiply', () => {
    const { wall } = insideLayout(320, 260);
    let lastScale = Infinity;
    for (let n = 1; n <= 6; n++) {
      const slots = itemSlots(n, 320, 260);
      expect(slots).toHaveLength(n);
      for (const s of slots) {
        expect(s.rect.x).toBeGreaterThanOrEqual(wall.x);
        expect(s.rect.x + s.rect.w).toBeLessThanOrEqual(wall.x + wall.w);
      }
      for (let i = 1; i < n; i++) {
        expect(slots[i].rect.x).toBeGreaterThanOrEqual(slots[i - 1].rect.x + slots[i - 1].rect.w - 0.01);
      }
      expect(slots[0].scale).toBeLessThanOrEqual(lastScale);
      lastScale = slots[0].scale;
    }
  });
});

describe('itemSlots art fit', () => {
  const DRAWN_WIDTH_AT_SCALE_1 = 52;

  it('never draws an item wider than its slot, and shrinks as items multiply', () => {
    let lastScale = Infinity;
    for (let n = 1; n <= 6; n++) {
      const slots = itemSlots(n, 320, 260);
      for (const s of slots) {
        expect(s.scale * DRAWN_WIDTH_AT_SCALE_1).toBeLessThanOrEqual(s.rect.w + 0.01);
      }
      expect(slots[0].scale).toBeLessThanOrEqual(lastScale);
      lastScale = slots[0].scale;
    }
  });

  it('keeps one or two items at full size', () => {
    expect(itemSlots(1, 320, 260)[0].scale).toBe(1.5);
    expect(itemSlots(2, 320, 260)[0].scale).toBe(1.5);
  });
});

describe('label rectangles', () => {
  it('puts the shipping label above the contents label, inside the body, for every kind', () => {
    for (const kind of ['box', 'can', 'parcel', 'jar', 'tube', 'prism', 'tetra', 'octa'] as const) {
      const b = bodyRect(kind, 320, 260);
      const ship = shippingLabelRect(kind, b);
      const cont = labelRect(kind, b);
      expect(ship.x, kind).toBeGreaterThanOrEqual(b.x);
      expect(ship.x + ship.w, kind).toBeLessThanOrEqual(b.x + b.w);
      expect(ship.y + ship.h, kind).toBeLessThanOrEqual(cont.y);
      expect(cont.y + cont.h, kind).toBeLessThanOrEqual(b.y + b.h);
    }
  });

  it('keeps the tetrahedron labels inside the triangle', () => {
    const b = bodyRect('tetra', 320, 260);
    for (const r of [shippingLabelRect('tetra', b), labelRect('tetra', b)]) {
      // half-width of the triangle at the top edge of each rectangle
      const half = (b.w / 2) * ((r.y - b.y) / b.h);
      expect(r.x).toBeGreaterThanOrEqual(b.x + b.w / 2 - half);
      expect(r.x + r.w).toBeLessThanOrEqual(b.x + b.w / 2 + half);
    }
  });
});

describe('octahedron geometry', () => {
  it('is a diamond-friendly square sitting on the floor', () => {
    expect(bodyRect('octa', 320, 260)).toEqual({ x: 90, y: 80, w: 140, h: 140 });
  });

  it('places the labels and void inside the diamond', () => {
    const b = bodyRect('octa', 320, 260);
    expect(labelRect('octa', b)).toEqual({ x: b.x + b.w * 0.3, y: b.y + b.h * 0.5, w: b.w * 0.4, h: b.h * 0.2 });
    expect(shippingLabelRect('octa', b)).toEqual({ x: b.x + b.w * 0.32, y: b.y + b.h * 0.28, w: b.w * 0.36, h: b.h * 0.18 });
    expect(voidRect('octa', b)).toEqual({ x: b.x + b.w * 0.34, y: b.y + b.h * 0.36, w: b.w * 0.32, h: b.h * 0.3 });
    for (const r of [shippingLabelRect('octa', b), labelRect('octa', b), voidRect('octa', b)]) {
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;
      for (const [x, y] of [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h]]) {
        expect(Math.abs(x - cx) / (b.w / 2) + Math.abs(y - cy) / (b.h / 2)).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('prism bottom geometry', () => {
  it('keeps the void inside the triangle drawn in the face square', () => {
    const sq = faceSquare('prism', bodyRect('prism', 320, 260));
    const r = voidRect('prism', sq);
    // half-width of the triangle (apex at the top centre) at the top edge of the void
    const half = (sq.w / 2) * ((r.y - sq.y) / sq.h);
    expect(r.x).toBeGreaterThanOrEqual(sq.x + sq.w / 2 - half);
    expect(r.x + r.w).toBeLessThanOrEqual(sq.x + sq.w / 2 + half);
    expect(r.y + r.h).toBeLessThanOrEqual(sq.y + sq.h);
  });
});

describe('faceSquare and rotateRect', () => {
  it('centres a square of the shorter side on the body', () => {
    const b = bodyRect('box', 320, 260);
    const sq = faceSquare('box', b);
    expect(sq.w).toBe(Math.min(b.w, b.h));
    expect(sq.h).toBe(sq.w);
    expect(sq.x + sq.w / 2).toBeCloseTo(b.x + b.w / 2);
    expect(sq.y + sq.h / 2).toBeCloseTo(b.y + b.h / 2);
  });

  it('rotates a rectangle clockwise about a point, in quarters', () => {
    const r = { x: 10, y: 0, w: 4, h: 2 };
    expect(rotateRect(r, 0, 0, 0)).toEqual(r);
    expect(rotateRect(r, 0, 0, 1)).toEqual({ x: -2, y: 10, w: 2, h: 4 });
    expect(rotateRect(r, 0, 0, 2)).toEqual({ x: -14, y: -2, w: 4, h: 2 });
    expect(rotateRect(r, 0, 0, 4)).toEqual(r);
    expect(rotateRect(r, 0, 0, -1)).toEqual(rotateRect(r, 0, 0, 3));
  });
});

describe('clampInside', () => {
  const bounds = { x: 10, y: 10, w: 100, h: 80 };

  it('leaves a rectangle that already fits', () => {
    const r = { x: 20, y: 20, w: 30, h: 10 };
    expect(clampInside(r, bounds)).toEqual(r);
  });

  it('pulls a rectangle hanging below back inside', () => {
    expect(clampInside({ x: 20, y: 95, w: 30, h: 10 }, bounds)).toEqual({ x: 20, y: 80, w: 30, h: 10 });
  });

  it('pulls a rectangle sticking out left and above back inside', () => {
    expect(clampInside({ x: 0, y: 0, w: 30, h: 10 }, bounds)).toEqual({ x: 10, y: 10, w: 30, h: 10 });
  });
});
