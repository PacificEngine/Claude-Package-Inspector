import { describe, expect, it } from 'vitest';
import { bodyRect, insideLayout, itemSlots, patchRect } from './geometry';

describe('patchRect', () => {
  it('keeps the usual patch near the top-left of a box', () => {
    const b = bodyRect('box', 320, 260);
    expect(patchRect('box', b)).toEqual({ x: b.x + b.w * 0.1, y: b.y + b.h * 0.1, w: b.w * 0.3, h: 14 });
  });

  it('puts a tetrahedron patch inside the triangle at both of its corners', () => {
    const b = bodyRect('tetra', 320, 260);
    const r = patchRect('tetra', b);
    const halfWidthAt = (y: number): number => ((y - b.y) / b.h) * (b.w / 2);
    for (const y of [r.y, r.y + r.h]) {
      expect(r.x).toBeGreaterThanOrEqual(b.x + b.w / 2 - halfWidthAt(y));
      expect(r.x + r.w).toBeLessThanOrEqual(b.x + b.w / 2 + halfWidthAt(y));
    }
    expect(r.y + r.h).toBeLessThanOrEqual(b.y + b.h);
  });
});

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
