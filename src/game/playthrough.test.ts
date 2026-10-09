import { describe, expect, it } from 'vitest';
import { buy, endDay, nextDay, startCampaign, toShop, type Campaign } from './campaign';
import { itemsIn } from './contents';
import { LAST_DAY, needsOpening, rejectWorthyProblems, isShippable, unresolvedProblems } from './rules';
import {
  closeBox,
  currentPackage,
  discardItem,
  flipBox,
  inspect,
  openBox,
  repair,
  rotateBox,
  stamp,
  type ShiftState,
} from './shift';
import type { RepairTool } from './types';
import { faceCount } from './shapes';
import { unlockedItems } from './shop';

interface ShiftMetrics {
  opened: number;
  repaired: number;
  refused: number;
  skippedForStock: number;
  wasted: number;
  discarded: number;
  discardedRestricted: number;
  sealed: number;
  labelsPrinted: number;
}

function playShiftPerfectly(initial: ShiftState, metrics: ShiftMetrics): ShiftState {
  let s = initial;
  while (!s.done) {
    const pkg = currentPackage(s)!;
    const problems = rejectWorthyProblems(pkg, s.card);
    const repairable = problems.length > 0 && problems.every((p) => p.repairTool !== null);
    if (repairable) {
      const hasDiscard = problems.some((p) => p.repairTool === 'discard');
      const tools = new Set(
        problems.map((p) => p.repairTool!).filter((t): t is RepairTool => t !== 'discard'),
      );
      // An open box spends sealant on each leaking item before the cardboard itself.
      const leaks = itemsIn(pkg, s.handling).filter((i) => i.leaking).length;
      const allStocked = [...tools].every(
        (t) => s.inventory.supplies[t] >= (t === 'sealant' ? 1 + leaks : 1),
      );
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
        // Throw the stowaways and restricted items out first, so the label is printed for what is really inside.
        if (hasDiscard) {
          const restricted = new Set(problems.filter((p) => p.source === 'item').map((p) => p.itemId));
          const stowaways = problems.some((p) => p.id === 'wrong_weight');
          for (const item of itemsIn(pkg, s.handling)) {
            const isRestricted = restricted.has(item.id);
            if (!isRestricted && !(stowaways && item.extra)) continue;
            s = discardItem(s, item.id).state;
            if (isRestricted) metrics.discardedRestricted++;
            else metrics.discarded++;
          }
        }
        const ordered = [...tools].sort((a, b) => Number(a === 'relabel') - Number(b === 'relabel'));
        for (const t of ordered) {
          // Sealant may need several uses: one per leaking item, then the cardboard.
          const stillNeeded = (): boolean =>
            t === 'sealant' &&
            unresolvedProblems(pkg, s.handling, s.card).some((p) => p.repairTool === 'sealant');
          let again = true;
          while (again) {
            const result = repair(s, t);
            s = result.state;
            if (result.message.startsWith('Fixed:')) metrics.repaired++;
            if (result.message.startsWith('Fixed: the leaking')) metrics.sealed++;
            if (result.message.includes('contents label') || result.message.includes('Missing contents label')) {
              metrics.labelsPrinted++;
            }
            if (result.message === 'Open the box first.') metrics.refused++;
            if (result.message.includes('Supply wasted')) metrics.wasted++;
            again = result.message.startsWith('Fixed:') && stillNeeded();
          }
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

const SEEDS = [1, 2, 3];

const freshMetrics = (): ShiftMetrics => ({
  opened: 0,
  repaired: 0,
  refused: 0,
  skippedForStock: 0,
  wasted: 0,
  discarded: 0,
  discardedRestricted: 0,
  sealed: 0,
  labelsPrinted: 0,
});

function playCampaign(seed: number): ShiftMetrics {
  const metrics = freshMetrics();
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
  return metrics;
}

describe('a perfect inspector playing all seven days', () => {
  for (const seed of SEEDS) {
    it(`finishes the campaign with no strikes (seed ${seed})`, () => {
      const metrics = playCampaign(seed);
      expect(metrics.opened).toBeGreaterThan(0);
      expect(metrics.repaired).toBeGreaterThan(0);
      expect(metrics.refused).toBe(0);
      expect(metrics.wasted).toBe(0);
    });
  }

  it('threw away stowaways, sealed leaking items and printed labels along the way', () => {
    const metrics = SEEDS.map(playCampaign);
    const total = (key: keyof ShiftMetrics): number => metrics.reduce((sum, m) => sum + m[key], 0);
    expect(total('discarded')).toBeGreaterThan(0);
    expect(total('discardedRestricted')).toBeGreaterThan(0);
    expect(total('sealed')).toBeGreaterThan(0);
    expect(total('labelsPrinted')).toBeGreaterThan(0);
  });
});
