import type { Package } from './types';

export const FINE_MULTIPLIER = 2;

export function openingFine(pkg: Package): number {
  return pkg.fee * FINE_MULTIPLIER;
}

export interface DayLedger {
  earned: number;
  fines: number;
}

export function settle(ledger: DayLedger, bank: number): { payout: number; bank: number } {
  const payout = ledger.earned - ledger.fines;
  return { payout, bank: bank + payout };
}
