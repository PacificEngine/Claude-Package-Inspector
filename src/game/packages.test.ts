import { describe, expect, it } from 'vitest';
import { DEFECTS } from './defects';
import { generatePackage } from './packages';
import { createRng } from './rng';
import { ruleCardForDay } from './rules';

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
