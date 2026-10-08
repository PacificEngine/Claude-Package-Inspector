import { ADDRESS_ISSUE_LABELS } from './address';
import { DEFECTS } from './defects';
import { openingFine } from './economy';
import { newHandling } from './handling';
import { cluesFor, type Clue } from './inspection';
import { generatePackage } from './packages';
import { createRng } from './rng';
import { applyRepair } from './repair';
import {
  isCorrectVerdict,
  needsRepair,
  ruleCardForDay,
  unresolvedProblems,
  type RuleCard,
} from './rules';
import type {
  AddressIssue,
  DefectId,
  Handling,
  InspectionTool,
  Inventory,
  Package,
  RepairTool,
  Verdict,
} from './types';

export const MAX_STRIKES = 3;
export const packagesForDay = (day: number): number => 8 + day * 2;

export interface ShiftState {
  day: number;
  card: RuleCard;
  queue: Package[];
  index: number;
  handling: Handling;
  inventory: Inventory;
  strikes: number;
  earned: number;
  fines: number;
  shipped: number;
  rejected: number;
  correct: number;
  done: boolean;
}

export interface ActionResult {
  state: ShiftState;
  message: string;
}

export function startShift(day: number, inventory: Inventory, seed: number): ShiftState {
  const card = ruleCardForDay(day);
  const rng = createRng(seed * 31 + day);
  const queue = Array.from({ length: packagesForDay(day) }, (_, i) =>
    generatePackage(rng, i + 1, card),
  );
  return {
    day,
    card,
    queue,
    index: 0,
    handling: newHandling(),
    inventory,
    strikes: 0,
    earned: 0,
    fines: 0,
    shipped: 0,
    rejected: 0,
    correct: 0,
    done: false,
  };
}

export function currentPackage(s: ShiftState): Package | null {
  return s.done ? null : (s.queue[s.index] ?? null);
}

export function currentClues(s: ShiftState): Clue[] {
  const pkg = currentPackage(s);
  if (!pkg) return [];
  return s.handling.used.flatMap((tool) => cluesFor(pkg, tool, s.handling.repaired));
}

const idle = (s: ShiftState): ActionResult => ({ state: s, message: 'The shift is over.' });

export function inspect(s: ShiftState, tool: InspectionTool): ActionResult {
  const pkg = currentPackage(s);
  if (!pkg) return idle(s);
  if (!s.inventory.tools.includes(tool)) return { state: s, message: 'You do not own that tool.' };
  if (s.handling.used.includes(tool)) return { state: s, message: 'You already checked that.' };
  return {
    state: { ...s, handling: { ...s.handling, used: [...s.handling.used, tool] } },
    message: cluesFor(pkg, tool, s.handling.repaired)
      .map((c) => c.text)
      .join(' '),
  };
}

export function openBox(s: ShiftState): ActionResult {
  const pkg = currentPackage(s);
  if (!pkg) return idle(s);
  if (s.handling.opened) return { state: s, message: 'Already open.' };
  const fine = needsRepair(pkg, s.card) ? 0 : openingFine(pkg);
  return {
    state: { ...s, handling: { ...s.handling, opened: true }, fines: s.fines + fine },
    message: fine > 0 ? `Fined $${fine}: that box needed no repair.` : 'Box opened.',
  };
}

export function repair(s: ShiftState, tool: RepairTool): ActionResult {
  const pkg = currentPackage(s);
  if (!pkg) return idle(s);
  const result = applyRepair(pkg, s.handling, s.inventory, tool);
  if (!result.ok) return { state: s, message: result.reason };
  return {
    state: { ...s, handling: result.handling, inventory: result.inventory },
    message:
      result.fixed.length > 0
        ? `Fixed: ${result.fixed.join(', ')}.`
        : 'Nothing to fix with that. Supply wasted.',
  };
}

export function stamp(s: ShiftState, verdict: Verdict): ActionResult {
  const pkg = currentPackage(s);
  if (!pkg) return idle(s);
  const correct = isCorrectVerdict(pkg, s.handling, s.card, verdict);
  const strikes = s.strikes + (correct ? 0 : 1);
  const earned = s.earned + (correct && verdict === 'ship' ? pkg.fee : 0);
  const index = s.index + 1;

  let message: string;
  if (correct) {
    message = verdict === 'ship' ? `Shipped. +$${pkg.fee} at day's end.` : 'Rejected.';
  } else if (verdict === 'ship') {
    const why = unresolvedProblems(pkg, s.handling, s.card)
      .map((p) =>
        p.source === 'defect'
          ? DEFECTS[p.id as DefectId].label
          : ADDRESS_ISSUE_LABELS[p.id as AddressIssue],
      )
      .join(', ');
    message = `Shipped a package that broke the rules (${why}). Strike!`;
  } else {
    message = 'That package was fine to ship. Strike!';
  }

  return {
    state: {
      ...s,
      strikes,
      earned,
      index,
      handling: newHandling(),
      shipped: s.shipped + (verdict === 'ship' ? 1 : 0),
      rejected: s.rejected + (verdict === 'reject' ? 1 : 0),
      correct: s.correct + (correct ? 1 : 0),
      done: strikes >= MAX_STRIKES || index >= s.queue.length,
    },
    message,
  };
}
