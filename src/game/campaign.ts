import { settle } from './economy';
import { LAST_DAY } from './rules';
import { MAX_STRIKES, startShift, type ShiftState } from './shift';
import { newInventory, purchase, type ShopItem } from './shop';
import type { Inventory } from './types';

export type Phase = 'shift' | 'dayEnd' | 'shop' | 'finished';

export interface DaySummary {
  day: number;
  earned: number;
  fines: number;
  payout: number;
  bankAfter: number;
  strikes: number;
  shipped: number;
  rejected: number;
  correct: number;
  stamped: number;
  failed: boolean;
}

export interface Campaign {
  seed: number;
  day: number;
  bank: number;
  inventory: Inventory;
  shift: ShiftState | null;
  phase: Phase;
  summary: DaySummary | null;
}

export function startCampaign(seed: number): Campaign {
  const inventory = newInventory();
  return {
    seed,
    day: 1,
    bank: 0,
    inventory,
    shift: startShift(1, inventory, seed),
    phase: 'shift',
    summary: null,
  };
}

export function endDay(c: Campaign): Campaign {
  if (c.phase !== 'shift') throw new Error('The day has already been settled.');
  const shift = c.shift;
  if (!shift || !shift.done) throw new Error('The shift is not over yet.');
  const { payout, bank } = settle({ earned: shift.earned, fines: shift.fines }, c.bank);
  return {
    ...c,
    bank,
    inventory: shift.inventory,
    phase: 'dayEnd',
    summary: {
      day: c.day,
      earned: shift.earned,
      fines: shift.fines,
      payout,
      bankAfter: bank,
      strikes: shift.strikes,
      shipped: shift.shipped,
      rejected: shift.rejected,
      correct: shift.correct,
      stamped: shift.shipped + shift.rejected,
      failed: shift.strikes >= MAX_STRIKES,
    },
  };
}

export function toShop(c: Campaign): Campaign {
  if (c.phase !== 'dayEnd') throw new Error('The day has not ended yet.');
  return { ...c, phase: c.day >= LAST_DAY ? 'finished' : 'shop' };
}

export function buy(
  c: Campaign,
  item: ShopItem,
  quantity = 1,
): { campaign: Campaign; message: string } {
  if (c.phase !== 'shop') throw new Error('The shop is closed.');
  const result = purchase(c.inventory, c.bank, c.day, item, quantity);
  if (!result.ok) return { campaign: c, message: result.reason };
  return {
    campaign: { ...c, bank: result.bank, inventory: result.inventory },
    message: 'Purchased.',
  };
}

export function nextDay(c: Campaign): Campaign {
  if (c.phase !== 'shop') throw new Error('Visit the shop before starting the next day.');
  const day = c.day + 1;
  return {
    ...c,
    day,
    shift: startShift(day, c.inventory, c.seed),
    phase: 'shift',
    summary: null,
  };
}
