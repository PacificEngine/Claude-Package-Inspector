import { describe, expect, it } from 'vitest';
import { DEFECTS } from './defects';
import { generatePackage, kindsForDay } from './packages';
import { createRng } from './rng';
import { ruleCardForDay } from './rules';
import { faceCount } from './shapes';

const sample = (day: number, n = 400) => {
  const rng = createRng(day * 101);
  const card = ruleCardForDay(day);
  return Array.from({ length: n }, (_, i) => generatePackage(rng, i + 1, card));
};

describe('generatePackage', () => {
  it('is deterministic for a given seed', () => {
    const card = ruleCardForDay(3);
    expect(generatePackage(createRng(5), 1, card)).toEqual(generatePackage(createRng(5), 1, card));
  });

  it('only uses defects from the card that fit the package kind', () => {
    for (let day = 1; day <= 7; day++) {
      const card = ruleCardForDay(day);
      const pool = [...card.rejectDefects, ...card.allowedDefects];
      for (const pkg of sample(day, 150)) {
        for (const d of pkg.defects) {
          expect(pool).toContain(d);
          expect(DEFECTS[d].kinds).toContain(pkg.kind);
        }
      }
    }
  });

  it('never repeats a defect on one package', () => {
    for (const pkg of sample(7)) expect(new Set(pkg.defects).size).toBe(pkg.defects.length);
  });

  it('keeps fantastical defects out of day 1', () => {
    for (const pkg of sample(1)) {
      for (const d of pkg.defects) expect(DEFECTS[d].fantastical).toBe(false);
    }
  });

  it('produces both clean and defective packages', () => {
    const pkgs = sample(2);
    expect(pkgs.some((p) => p.defects.length === 0)).toBe(true);
    expect(pkgs.some((p) => p.defects.length > 0)).toBe(true);
  });

  it('sets weights that match the weight defects', () => {
    for (const pkg of sample(7, 600)) {
      if (pkg.defects.includes('heavier_inside')) {
        expect(pkg.actualWeightKg).toBeGreaterThan(pkg.declaredWeightKg * 5);
      } else if (pkg.defects.includes('wrong_weight')) {
        expect(pkg.actualWeightKg).toBeGreaterThan(pkg.declaredWeightKg);
      } else {
        expect(pkg.actualWeightKg).toBe(pkg.declaredWeightKg);
      }
    }
  });

  it('pays more later in the campaign', () => {
    const avg = (day: number) => {
      const pkgs = sample(day, 200);
      return pkgs.reduce((sum, p) => sum + p.fee, 0) / pkgs.length;
    };
    expect(avg(7)).toBeGreaterThan(avg(1));
  });
});

describe('shapes by day', () => {
  it('uses the five original kinds on days 1 to 3, adds prisms on day 4 and tetrahedrons on day 6', () => {
    for (const day of [1, 2, 3]) expect(kindsForDay(day)).toEqual(['box', 'can', 'parcel', 'jar', 'tube']);
    expect(kindsForDay(4)).toEqual(['box', 'can', 'parcel', 'jar', 'tube', 'prism']);
    expect(kindsForDay(5)).toContain('prism');
    expect(kindsForDay(5)).not.toContain('tetra');
    expect(kindsForDay(6)).toContain('tetra');
    expect(kindsForDay(7)).toContain('tetra');
  });

  it('only generates a shape once it is unlocked, and does generate it afterwards', () => {
    const kinds = (day: number) => new Set(sample(day, 400).map((p) => p.kind));
    expect(kinds(3).has('prism')).toBe(false);
    expect(kinds(5).has('tetra')).toBe(false);
    expect(kinds(4).has('prism')).toBe(true);
    expect(kinds(6).has('tetra')).toBe(true);
  });
});

describe('defect placements', () => {
  it('places nothing on day 1', () => {
    for (const p of sample(1, 300)) expect(p.placements).toBeUndefined();
  });

  it('spreads surface defects over the up faces and underside defects over the down faces from day 2', () => {
    const surface = ['leaking', 'crushed_corner', 'torn_tape', 'bulging', 'missing_label'];
    const under = ['bottomless', 'wet_cardboard'];
    let sawFaceBeyondFirst = false;
    for (const day of [2, 3, 5, 7]) {
      for (const p of sample(day, 400)) {
        for (const id of p.defects) {
          const placed = p.placements?.[id];
          if (surface.includes(id)) {
            expect(placed?.side).toBe('up');
            expect(placed!.face).toBeLessThan(faceCount(p.kind, 'up'));
            if (placed!.face > 0) sawFaceBeyondFirst = true;
          } else if (under.includes(id)) {
            expect(placed?.side).toBe('down');
            expect(placed!.face).toBeLessThan(faceCount(p.kind, 'down'));
          } else {
            expect(placed).toBeUndefined();
          }
        }
      }
    }
    expect(sawFaceBeyondFirst).toBe(true);
  });
});
