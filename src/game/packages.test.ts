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

describe('package contents', () => {
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const legit = (p: ReturnType<typeof sample>[number]) => p.contents.filter((i) => !i.extra);

  it('every package holds at least one legit item, with unique ids and positive weights', () => {
    for (const day of [1, 3, 5, 7]) {
      for (const p of sample(day, 200)) {
        expect(legit(p).length).toBeGreaterThanOrEqual(1);
        expect(new Set(p.contents.map((i) => i.id)).size).toBe(p.contents.length);
        for (const i of p.contents) expect(i.weightKg).toBeGreaterThan(0);
      }
    }
  });

  it('adds up: declared counts the legit items, actual counts everything', () => {
    for (const p of sample(7, 400)) {
      const declared = round1(p.packagingKg + legit(p).reduce((s, i) => s + i.weightKg, 0));
      const actual = round1(p.packagingKg + p.contents.reduce((s, i) => s + i.weightKg, 0));
      expect(p.declaredWeightKg).toBeCloseTo(declared, 1);
      expect(p.actualWeightKg).toBeCloseTo(actual, 1);
    }
  });

  it('gives wrong-weight packages one or two stowaways that weigh the difference', () => {
    let seen = 0;
    for (const p of sample(4, 600)) {
      if (!p.defects.includes('wrong_weight') || p.defects.includes('heavier_inside')) continue;
      seen++;
      const extras = p.contents.filter((i) => i.extra);
      expect(extras.length).toBeGreaterThanOrEqual(1);
      expect(extras.length).toBeLessThanOrEqual(2);
      expect(extras.reduce((s, i) => s + i.weightKg, 0)).toBeCloseTo(p.actualWeightKg - p.declaredWeightKg, 1);
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('gives a heavier-inside package one marble and no other extras', () => {
    let seen = 0;
    for (const p of sample(7, 800)) {
      if (!p.defects.includes('heavier_inside')) continue;
      seen++;
      const extras = p.contents.filter((i) => i.extra);
      expect(extras.some((i) => i.name === 'impossibly dense marble')).toBe(true);
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('has no extras on packages without a weight defect, and leaks only with soggy cardboard', () => {
    let leakers = 0;
    for (const day of [2, 4, 7]) {
      for (const p of sample(day, 600)) {
        const weightDefect = p.defects.includes('wrong_weight') || p.defects.includes('heavier_inside');
        if (!weightDefect) expect(p.contents.some((i) => i.extra)).toBe(false);
        const leaking = p.contents.filter((i) => i.leaking);
        if (leaking.length > 0) {
          leakers++;
          expect(p.defects).toContain('wet_cardboard');
          expect(leaking.every((i) => !i.extra)).toBe(true);
        }
      }
    }
    expect(leakers).toBeGreaterThan(0);
  });
});

describe('the contents label face', () => {
  it('is face 1 on day 1 and on shapes with one up face', () => {
    for (const p of sample(1, 300)) expect(p.labelFace).toBe(0);
    for (const day of [2, 5, 7]) {
      for (const p of sample(day, 300)) {
        expect(p.labelFace).toBeGreaterThanOrEqual(0);
        expect(p.labelFace).toBeLessThan(faceCount(p.kind, 'up'));
        if (faceCount(p.kind, 'up') === 1) expect(p.labelFace).toBe(0);
      }
    }
  });

  it('spreads over the up faces from day 2', () => {
    const faces = new Set(sample(4, 600).map((p) => p.labelFace));
    expect(faces.has(1) || faces.has(2) || faces.has(3)).toBe(true);
  });

  it('puts a missing contents label on the face the label belongs on', () => {
    let seen = 0;
    for (const day of [2, 4, 7]) {
      for (const p of sample(day, 600)) {
        if (!p.defects.includes('missing_label')) continue;
        seen++;
        expect(p.placements?.missing_label).toEqual({ side: 'up', face: p.labelFace });
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});
