import { ADDRESS_ISSUE_LABELS } from './address';
import { itemsIn } from './contents';
import { DEFECTS } from './defects';
import { openingFine } from './economy';
import { newHandling, viewOf } from './handling';
import { CLUE_CHANNEL, cluesFor, markerClues, notedClues, type Clue } from './inspection';
import { generatePackage } from './packages';
import { applyRepair } from './repair';
import { createRng } from './rng';
import {
  isCorrectVerdict,
  needsOpening,
  ruleCardForDay,
  unresolvedProblems,
  type RuleCard,
} from './rules';
import { faceCount, faceKey } from './shapes';
import type {
  AddressIssue,
  DefectId,
  Handling,
  InspectionTool,
  Inventory,
  Package,
  RepairTool,
  Side,
  Verdict,
  View,
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

const idle = (s: ShiftState): ActionResult => ({ state: s, message: 'The shift is over.' });

const noteKeys = (handling: Handling, keys: string[]): string[] => [
  ...handling.notes,
  ...keys.filter((k) => !handling.notes.includes(k)),
];

export function currentNotes(s: ShiftState): Clue[] {
  const pkg = currentPackage(s);
  return pkg ? notedClues(pkg, s.handling) : [];
}

export function closeBox(s: ShiftState): ActionResult {
  if (!currentPackage(s)) return idle(s);
  if (!s.handling.opened) return { state: s, message: 'The box is already closed.' };
  return { state: { ...s, handling: { ...s.handling, opened: false } }, message: 'Box closed.' };
}

const withVisited = (visited: string[], side: Side, face: number): string[] => {
  const key = faceKey(side, face);
  return visited.includes(key) ? visited : [...visited, key];
};

export function rotateBox(s: ShiftState): ActionResult {
  const pkg = currentPackage(s);
  if (!pkg) return idle(s);
  if (!s.inventory.tools.includes('rotate')) return { state: s, message: 'You do not own that tool.' };
  if (s.handling.opened) return { state: s, message: 'Close the box first.' };
  const side: Side = s.handling.flipped ? 'down' : 'up';
  const count = faceCount(pkg.kind, side);
  if (count <= 1) return { state: s, message: 'This shape has only one side to turn.' };
  const face = (s.handling.face + 1) % count;
  return {
    state: {
      ...s,
      handling: { ...s.handling, face, visited: withVisited(s.handling.visited, side, face) },
    },
    message: `You turn it to ${side === 'down' ? 'underside' : 'side'} ${face + 1} of ${count}.`,
  };
}

export function flipBox(s: ShiftState): ActionResult {
  const pkg = currentPackage(s);
  if (!pkg) return idle(s);
  if (!s.inventory.tools.includes('rotate')) return { state: s, message: 'You do not own that tool.' };
  if (s.handling.opened) return { state: s, message: 'Close the box first.' };
  if (!s.handling.flipped && faceCount(pkg.kind, 'down') === 0) {
    return { state: s, message: 'This shape cannot be flipped.' };
  }
  const flipped = !s.handling.flipped;
  const used = s.handling.used.includes('rotate') ? s.handling.used : [...s.handling.used, 'rotate' as const];
  return {
    state: {
      ...s,
      handling: {
        ...s.handling,
        flipped,
        face: 0,
        used,
        visited: withVisited(s.handling.visited, flipped ? 'down' : 'up', 0),
      },
    },
    message: flipped ? 'You flip the box over.' : 'You turn the box back over.',
  };
}

export function noteDefect(s: ShiftState, defect: DefectId, view: View): ActionResult {
  const pkg = currentPackage(s);
  if (!pkg) return idle(s);
  if (viewOf(s.handling) !== view) return { state: s, message: 'You are not looking at that side.' };
  const clues = markerClues(pkg, s.handling, defect, view);
  if (clues.length === 0) return { state: s, message: 'Nothing to note there.' };
  const fresh = clues.filter((c) => !s.handling.notes.includes(c.key));
  if (fresh.length === 0) return { state: s, message: 'Already noted.' };
  return {
    state: { ...s, handling: { ...s.handling, notes: noteKeys(s.handling, fresh.map((c) => c.key)) } },
    message: fresh.map((c) => c.text).join(' '),
  };
}

export function inspect(s: ShiftState, tool: InspectionTool): ActionResult {
  const pkg = currentPackage(s);
  if (!pkg) return idle(s);
  if (tool === 'rotate') return { state: s, message: 'Use Flip box for that.' };
  if (!s.inventory.tools.includes(tool)) return { state: s, message: 'You do not own that tool.' };
  if (viewOf(s.handling) !== 'front') {
    return { state: s, message: 'Close the box and turn it face up first.' };
  }
  if (s.handling.used.includes(tool)) return { state: s, message: 'You already checked that.' };
  const clues = cluesFor(pkg, tool, s.handling.repaired, s.handling.discarded);
  // Sounds and readings need no marker, so they go straight into the notes.
  const auto = CLUE_CHANNEL[tool] === 'visual' ? [] : clues.map((c) => c.key);
  return {
    state: {
      ...s,
      handling: {
        ...s.handling,
        used: [...s.handling.used, tool],
        notes: noteKeys(s.handling, auto),
      },
    },
    message: clues.map((c) => c.text).join(' '),
  };
}

export function openBox(s: ShiftState): ActionResult {
  const pkg = currentPackage(s);
  if (!pkg) return idle(s);
  if (s.handling.opened) return { state: s, message: 'Already open.' };
  if (s.handling.flipped) return { state: s, message: 'Flip the box back first.' };
  // Opening a box that did not need it is fined, but only once however often it is reopened.
  const fine = needsOpening(pkg, s.card) || s.handling.fined ? 0 : openingFine(pkg);
  return {
    state: {
      ...s,
      handling: { ...s.handling, opened: true, fined: s.handling.fined || fine > 0 },
      fines: s.fines + fine,
    },
    message: fine > 0 ? `Fined $${fine}: that box did not need opening.` : 'Box opened.',
  };
}

const findItem = (s: ShiftState, pkg: Package, itemId: number) =>
  itemsIn(pkg, s.handling).find((i) => i.id === itemId);

export function weighItem(s: ShiftState, itemId: number): ActionResult {
  const pkg = currentPackage(s);
  if (!pkg) return idle(s);
  if (!s.handling.opened) return { state: s, message: 'Open the box first.' };
  if (!s.inventory.tools.includes('scale')) return { state: s, message: 'You do not own that tool.' };
  const item = findItem(s, pkg, itemId);
  if (!item) return { state: s, message: 'There is no such item.' };
  return {
    state: { ...s, handling: { ...s.handling, notes: noteKeys(s.handling, [`item:${item.id}`]) } },
    message: `The ${item.name} weighs ${item.weightKg} kg.`,
  };
}

export function discardItem(s: ShiftState, itemId: number): ActionResult {
  const pkg = currentPackage(s);
  if (!pkg) return idle(s);
  if (!s.handling.opened) return { state: s, message: 'Open the box first.' };
  const item = findItem(s, pkg, itemId);
  if (!item) return { state: s, message: 'There is no such item.' };
  return {
    state: { ...s, handling: { ...s.handling, discarded: [...s.handling.discarded, item.id] } },
    message: `You throw away the ${item.name}.`,
  };
}

export function noteLeak(s: ShiftState, itemId: number): ActionResult {
  const pkg = currentPackage(s);
  if (!pkg) return idle(s);
  if (!s.handling.opened) return { state: s, message: 'Open the box first.' };
  const item = findItem(s, pkg, itemId);
  if (!item || !item.leaking || s.handling.sealed.includes(item.id)) {
    return { state: s, message: 'Nothing to note there.' };
  }
  const key = `leak:${item.id}`;
  if (s.handling.notes.includes(key)) return { state: s, message: 'Already noted.' };
  return {
    state: { ...s, handling: { ...s.handling, notes: noteKeys(s.handling, [key]) } },
    message: `The ${item.name} is leaking.`,
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
  if (verdict === 'ship' && s.handling.opened) {
    return { state: s, message: 'Close the box before shipping.' };
  }
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
