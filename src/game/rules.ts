import { addressIssues, isRepairableAddressIssue } from './address';
import { ALL_DEFECT_IDS, DEFECTS } from './defects';
import type { AddressIssue, DefectId, Handling, Package, RepairTool, Verdict } from './types';

export const LAST_DAY = 7;

export interface RuleCard {
  day: number;
  title: string;
  lines: string[];
  rejectDefects: DefectId[];
  allowedDefects: DefectId[];
  rejectAddress: AddressIssue[];
  allowedAddress: AddressIssue[];
}

const DAY7_ALLOWED: DefectId[] = ['crushed_corner', 'rattling'];

const CARDS: RuleCard[] = [
  {
    day: 1,
    title: 'Day 1: The Basics',
    lines: [
      'Reject leaking, bulging, or torn-tape packages.',
      'Crushed corners and missing contents labels are fine today.',
      'Reject any shipping label with a missing field.',
    ],
    rejectDefects: ['leaking', 'bulging', 'torn_tape'],
    allowedDefects: ['crushed_corner', 'missing_label'],
    rejectAddress: ['missing_field'],
    allowedAddress: [],
  },
  {
    day: 2,
    title: 'Day 2: Neat and Dry',
    lines: [
      'Reject leaks, bulges, torn tape, crushed corners and soggy cardboard.',
      'Reject any shipping label with a missing field.',
      'No PO boxes. The ZIP must match the city.',
      'A smudged label is readable enough today.',
    ],
    rejectDefects: ['leaking', 'bulging', 'torn_tape', 'crushed_corner', 'wet_cardboard'],
    allowedDefects: ['missing_label'],
    rejectAddress: ['missing_field', 'po_box', 'zip_mismatch'],
    allowedAddress: ['smudged'],
  },
  {
    day: 3,
    title: 'Day 3: Something Is Off',
    lines: [
      'Reject anything with no bottom, or that weighs wrong in any way.',
      'Reject leaks, bulges, torn tape and soggy cardboard.',
      'Reject any shipping label with a missing field.',
      'Reject restricted-zone, smudged and ZIP-mismatched labels. PO boxes are fine.',
    ],
    rejectDefects: [
      'leaking',
      'bulging',
      'torn_tape',
      'wet_cardboard',
      'bottomless',
      'heavier_inside',
      'wrong_weight',
    ],
    allowedDefects: ['crushed_corner', 'missing_label'],
    rejectAddress: ['missing_field', 'zip_mismatch', 'smudged', 'restricted_zone'],
    allowedAddress: ['po_box'],
  },
  {
    day: 4,
    title: 'Day 4: Mind the Contents',
    lines: [
      'Reject rattlers, scorchers and anything from the future.',
      'Reject leaks, torn tape, bottomless boxes and wrong weights.',
      'Reject any shipping label with a missing field, a ZIP that does not match the city, a restricted zone or "Nowhere Lane".',
      'Bulges, soggy cardboard and tiny weather are fine.',
    ],
    rejectDefects: [
      'leaking',
      'torn_tape',
      'bottomless',
      'wrong_weight',
      'rattling',
      'scorching',
      'future_contents',
    ],
    allowedDefects: [
      'bulging',
      'crushed_corner',
      'wet_cardboard',
      'tiny_weather',
      'heavier_inside',
      'missing_label',
    ],
    rejectAddress: ['missing_field', 'zip_mismatch', 'restricted_zone', 'nowhere'],
    allowedAddress: ['po_box', 'smudged'],
  },
  {
    day: 5,
    title: 'Day 5: Below Sea Level',
    lines: [
      'Reject anything addressed below sea level or to the Moon.',
      'Reject leaks, bulges, bottomless boxes, weather, scorchers and futures.',
      'Reject any shipping label with a missing field, and any smudged label.',
      'Missing contents labels must be fixed. PO boxes and ZIP slips are fine.',
    ],
    rejectDefects: [
      'leaking',
      'bulging',
      'bottomless',
      'missing_label',
      'future_contents',
      'tiny_weather',
      'scorching',
    ],
    allowedDefects: ['crushed_corner', 'torn_tape', 'wet_cardboard', 'rattling', 'wrong_weight'],
    rejectAddress: ['missing_field', 'smudged', 'underwater', 'lunar'],
    allowedAddress: ['po_box', 'zip_mismatch'],
  },
  {
    day: 6,
    title: 'Day 6: Sound Check',
    lines: [
      'Reject anything that hums, whispers or ticks.',
      'Reject leaks, bulges, soggy cardboard, bottomless boxes and futures.',
      'Reject any shipping label with a missing field.',
      'No PO boxes, no Moon, no sea floor, no "Nowhere Lane".',
    ],
    rejectDefects: [
      'leaking',
      'bulging',
      'wet_cardboard',
      'bottomless',
      'future_contents',
      'humming',
      'whispering',
      'ticking',
    ],
    allowedDefects: ['torn_tape', 'crushed_corner', 'rattling', 'scorching', 'missing_label'],
    rejectAddress: ['missing_field', 'po_box', 'underwater', 'lunar', 'nowhere'],
    allowedAddress: ['zip_mismatch', 'smudged', 'restricted_zone'],
  },
  {
    day: 7,
    title: 'Day 7: Inspector General',
    lines: [
      'Everything is rejectable except crushed corners and rattling.',
      'Every address problem is rejectable except a smudge.',
      'You earned this. Do not ship a thing that is not right.',
    ],
    rejectDefects: ALL_DEFECT_IDS.filter((id) => !DAY7_ALLOWED.includes(id)),
    allowedDefects: DAY7_ALLOWED,
    rejectAddress: [
      'missing_field',
      'zip_mismatch',
      'po_box',
      'restricted_zone',
      'nowhere',
      'underwater',
      'lunar',
    ],
    allowedAddress: ['smudged'],
  },
];

export function ruleCardForDay(day: number): RuleCard {
  const card = CARDS[Math.min(Math.max(day, 1), LAST_DAY) - 1];
  return card;
}

export interface Problem {
  source: 'defect' | 'address';
  id: DefectId | AddressIssue;
  repairTool: RepairTool | null;
}

export function rejectWorthyProblems(pkg: Package, card: RuleCard): Problem[] {
  const defects: Problem[] = pkg.defects
    .filter((id) => card.rejectDefects.includes(id))
    .map((id) => ({ source: 'defect', id, repairTool: DEFECTS[id].repairedBy }));
  const addresses: Problem[] = addressIssues(pkg.address)
    .filter((issue) => card.rejectAddress.includes(issue))
    .map((issue) => ({
      source: 'address',
      id: issue,
      repairTool: isRepairableAddressIssue(issue) ? 'relabel' : null,
    }));
  return [...defects, ...addresses];
}

function isResolved(problem: Problem, handling: Handling): boolean {
  if (problem.source === 'defect') return handling.repaired.includes(problem.id as DefectId);
  return problem.repairTool === 'relabel' && handling.relabeled;
}

export function unresolvedProblems(pkg: Package, handling: Handling, card: RuleCard): Problem[] {
  return rejectWorthyProblems(pkg, card).filter((p) => !isResolved(p, handling));
}

export function isShippable(pkg: Package, handling: Handling, card: RuleCard): boolean {
  return unresolvedProblems(pkg, handling, card).length === 0;
}

export function needsRepair(pkg: Package, card: RuleCard): boolean {
  const problems = rejectWorthyProblems(pkg, card);
  return problems.length > 0 && problems.every((p) => p.repairTool !== null);
}

export function isCorrectVerdict(
  pkg: Package,
  handling: Handling,
  card: RuleCard,
  verdict: Verdict,
): boolean {
  const shippable = isShippable(pkg, handling, card);
  return verdict === 'ship' ? shippable : !shippable;
}
