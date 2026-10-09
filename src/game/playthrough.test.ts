import { describe, expect, it } from 'vitest';
import { buy, endDay, nextDay, startCampaign, toShop, type Campaign } from './campaign';
import { LAST_DAY, needsOpening, rejectWorthyProblems, isShippable } from './rules';
import { closeBox, currentPackage, flipBox, inspect, openBox, repair, rotateBox, stamp, type ShiftState } from './shift';
import { faceCount } from './shapes';
import { unlockedItems } from './shop';

interface ShiftMetrics {
  opened: number;
  repaired: number;
  refused: number;
  skippedForStock: number;
  wasted: number;
}

function playShiftPerfectly(initial: ShiftState, metrics: ShiftMetrics): ShiftState {
  let s = initial;
  while (!s.done) {
    const pkg = currentPackage(s)!;
    const problems = rejectWorthyProblems(pkg, s.card);
    const repairable = problems.length > 0 && problems.every((p) => p.repairTool !== null);
    if (repairable) {
      const tools = new Set(problems.map((p) => p.repairTool!));
      const allStocked = [...tools].every((t) => s.inventory.supplies[t] > 0);
      if (allStocked) {
        for (const tool of s.inventory.tools) {
          if (tool !== 'look' && tool !== 'rotate') s = inspect(s, tool).state;
        }
        // Reveal the back, then return the box face up.
        if (s.inventory.tools.includes('rotate')) {
          const sweep = (): void => {
            // Show every face on the side that is showing; a full turn returns to the face we started on.
            const side = s.handling.flipped ? 'down' : 'up';
            for (let i = 0; i < faceCount(pkg.kind, side); i++) s = rotateBox(s).state;
          };
          sweep(); // up faces (a full turn returns to face 1)
          const flipped = flipBox(s);
          if (flipped.state.handling.flipped) {
            s = flipped.state;
            sweep(); // down faces
            s = flipBox(s).state; // back face up
          }
        }
        // Exterior-only repairs (tape on tape or a dent) are done with the box closed.
        if (needsOpening(pkg, s.card)) {
          s = openBox(s).state;
          metrics.opened++;
        }
        for (const t of tools) {
          const result = repair(s, t);
          s = result.state;
          if (result.message.startsWith('Fixed:')) metrics.repaired++;
          if (result.message === 'Open the box first.') metrics.refused++;
          if (result.message.includes('Supply wasted')) metrics.wasted++;
        }
      } else {
        metrics.skippedForStock++;
      }
    }
    if (s.handling.opened) s = closeBox(s).state;
    s = stamp(s, isShippable(pkg, s.handling, s.card) ? 'ship' : 'reject').state;
  }
  return s;
}

function stockUp(c: Campaign): Campaign {
  for (const item of unlockedItems(c.day)) {
    c = buy(c, item, 5).campaign;
  }
  return c;
}

describe('a perfect inspector playing all seven days', () => {
  for (const seed of [1, 2, 3]) {
    it(`finishes the campaign with no strikes (seed ${seed})`, () => {
      const metrics: ShiftMetrics = { opened: 0, repaired: 0, refused: 0, skippedForStock: 0, wasted: 0 };
      let c = startCampaign(seed);
      while (c.phase !== 'finished') {
        c = { ...c, shift: playShiftPerfectly(c.shift!, metrics) };
        c = endDay(c);
        expect(c.summary!.strikes).toBe(0);
        expect(c.summary!.fines).toBe(0);
        c = toShop(c);
        if (c.phase === 'shop') c = nextDay(stockUp(c));
      }
      expect(c.day).toBe(LAST_DAY);
      expect(c.bank).toBeGreaterThan(0);
      expect(metrics.opened).toBeGreaterThan(0);
      expect(metrics.repaired).toBeGreaterThan(0);
      expect(metrics.refused).toBe(0);
      expect(metrics.wasted).toBe(0);
    });
  }
});
