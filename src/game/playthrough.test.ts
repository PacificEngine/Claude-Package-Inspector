import { describe, expect, it } from 'vitest';
import { buy, endDay, nextDay, startCampaign, toShop, type Campaign } from './campaign';
import { itemsIn, labelMatches } from './contents';
import { DEFECTS } from './defects';
import { revealedDefects } from './inspection';
import { LAST_DAY, needsOpening, rejectWorthyProblems, isShippable } from './rules';
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
import type { RepairTarget } from './repair';
import type { RepairTool } from './types';
import { ringLength, sideCount } from './shapes';
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

const isRepairTool = (t: RepairTool | 'discard' | null): t is RepairTool => t !== null && t !== 'discard';

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
        // Show every face, then finish a full circuit so the box is upright and closed.
        if (s.inventory.tools.includes('rotate')) {
          const ring = ringLength(pkg.kind);
          const turns = sideCount(pkg.kind);
          for (let pos = 0; pos < ring; pos++) {
            for (let i = 0; i < turns; i++) s = rotateBox(s).state; // each side, or a harmless spin on the top and bottom
            if (ring > 1) s = flipBox(s).state;
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
        const tally = (result: { message: string }): void => {
          if (result.message.startsWith('Fixed:')) metrics.repaired++;
          if (result.message.startsWith('Fixed: the leaking')) metrics.sealed++;
          if (result.message.includes('contents label') || result.message.includes('Missing contents label')) {
            metrics.labelsPrinted++;
          }
          if (result.message === 'Open the box first.') metrics.refused++;
          if (result.message.includes('Supply wasted')) metrics.wasted++;
        };
        const fix = (tool: RepairTool, target: RepairTarget): void => {
          const result = repair(s, tool, target);
          s = result.state;
          tally(result);
        };
        // Defects first (the missing label prints last, once the contents are settled), then the leaking items.
        const toFix = revealedDefects(pkg, s.handling)
          .filter((id) => problems.some((p) => p.source === 'defect' && p.id === id))
          .filter((id) => isRepairTool(DEFECTS[id].repairedBy))
          .sort((a, b) => Number(a === 'missing_label') - Number(b === 'missing_label'));
        for (const id of toFix) fix(DEFECTS[id].repairedBy as RepairTool, { kind: 'defect', id });
        if (s.handling.opened) {
          for (const leaking of itemsIn(pkg, s.handling).filter((i) => i.leaking)) {
            if (!s.handling.sealed.includes(leaking.id)) fix('sealant', { kind: 'item', itemId: leaking.id });
          }
        }
        if (problems.some((p) => p.source === 'address' && p.repairTool === 'relabel')) {
          fix('relabel', { kind: 'shippingLabel' });
        }
        if (s.handling.opened && s.handling.repaired.includes('missing_label') && !labelMatches(pkg, s.handling)) {
          fix('relabel', { kind: 'contentsLabel' });
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
