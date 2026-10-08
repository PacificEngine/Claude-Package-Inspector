import { describe, expect, it } from 'vitest';
import { buy, endDay, nextDay, startCampaign, toShop, type Campaign } from './campaign';
import { LAST_DAY, needsRepair, rejectWorthyProblems, isShippable } from './rules';
import { currentPackage, inspect, openBox, repair, stamp, type ShiftState } from './shift';
import { unlockedItems } from './shop';

interface ShiftMetrics {
  opened: number;
  repaired: number;
  skippedForStock: number;
}

function playShiftPerfectly(initial: ShiftState, metrics: ShiftMetrics): ShiftState {
  let s = initial;
  while (!s.done) {
    const pkg = currentPackage(s)!;
    if (needsRepair(pkg, s.card)) {
      const tools = new Set(rejectWorthyProblems(pkg, s.card).map((p) => p.repairTool!));
      const allStocked = [...tools].every((t) => s.inventory.supplies[t] > 0);
      if (allStocked) {
        for (const tool of s.inventory.tools) s = inspect(s, tool).state;
        s = openBox(s).state;
        metrics.opened++;
        for (const t of tools) {
          s = repair(s, t).state;
          metrics.repaired++;
        }
      } else {
        metrics.skippedForStock++;
      }
    }
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
      const metrics: ShiftMetrics = { opened: 0, repaired: 0, skippedForStock: 0 };
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
    });
  }
});
