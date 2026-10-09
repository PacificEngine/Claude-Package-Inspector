import { describe, expect, it } from 'vitest';
import { bodyRect, patchRect } from './geometry';

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
