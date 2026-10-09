import { addressIssues, isRepairableAddressIssue } from './address';
import { itemsIn, labelMatches } from './contents';
import { DEFECTS } from './defects';
import { revealedDefects } from './inspection';
import type { DefectId, Handling, Inventory, Package, RepairTool } from './types';

export type RepairTarget =
  | { kind: 'defect'; id: DefectId }
  | { kind: 'shippingLabel' }
  | { kind: 'contentsLabel' }
  | { kind: 'item'; itemId: number }
  | { kind: 'package' };

export type RepairResult =
  | { ok: true; handling: Handling; inventory: Inventory; fixed: string[] }
  | { ok: false; reason: string };

const refuse = (reason: string): RepairResult => ({ ok: false, reason });
const WRONG_TOOL = 'That tool does not fix that.';

const spend = (inventory: Inventory, tool: RepairTool): Inventory => ({
  ...inventory,
  supplies: { ...inventory.supplies, [tool]: inventory.supplies[tool] - 1 },
});

export function applyRepair(
  pkg: Package,
  handling: Handling,
  inventory: Inventory,
  tool: RepairTool,
  target: RepairTarget,
): RepairResult {
  if (inventory.supplies[tool] === undefined) return refuse(WRONG_TOOL);
  if (inventory.supplies[tool] < 1) return refuse('You are out of that supply.');

  const done = (next: Handling, fixed: string[]): RepairResult => ({
    ok: true,
    handling: next,
    inventory: spend(inventory, tool),
    fixed,
  });
  const currentItemIds = (): number[] => itemsIn(pkg, handling).map((i) => i.id);

  const fixDefect = (id: DefectId): RepairResult =>
    done(
      {
        ...handling,
        repaired: [...handling.repaired, id],
        labelItems: id === 'missing_label' ? currentItemIds() : handling.labelItems,
      },
      [DEFECTS[id].label],
    );
  const needsReprint = (): boolean =>
    handling.opened && handling.repaired.includes('missing_label') && !labelMatches(pkg, handling);
  const reprint = (): RepairResult => done({ ...handling, labelItems: currentItemIds() }, ['contents label']);

  switch (target.kind) {
    case 'package': {
      if (!handling.opened) return refuse('Click the thing you want to fix.');
      // Inside the open box these defects have no marker of their own, so the inside is the target.
      const reachable = revealedDefects(pkg, handling).find(
        (id) => DEFECTS[id].repairedBy === tool && DEFECTS[id].repairNeedsOpen,
      );
      if (reachable) return fixDefect(reachable);
      if (tool === 'relabel' && needsReprint()) return reprint();
      return refuse('Nothing to fix there.');
    }

    case 'defect': {
      const def = DEFECTS[target.id];
      if (!revealedDefects(pkg, handling).includes(target.id) || def.repairedBy !== tool) {
        return refuse(WRONG_TOOL);
      }
      if (def.repairNeedsOpen && !handling.opened) return refuse('Open the box first.');
      return fixDefect(target.id);
    }

    case 'shippingLabel':
      if (tool !== 'relabel') return refuse(WRONG_TOOL);
      if (handling.relabeled || !addressIssues(pkg.address).some(isRepairableAddressIssue)) {
        return refuse('Nothing wrong with that label.');
      }
      return done({ ...handling, relabeled: true }, ['address label']);

    case 'contentsLabel':
      if (tool !== 'relabel') return refuse(WRONG_TOOL);
      if (!needsReprint()) return refuse('That label does not need reprinting.');
      return reprint();

    case 'item': {
      if (tool !== 'sealant') return refuse(WRONG_TOOL);
      const leaking = handling.opened
        ? itemsIn(pkg, handling).find((i) => i.id === target.itemId && i.leaking)
        : undefined;
      if (!leaking || handling.sealed.includes(leaking.id)) return refuse('Nothing to fix there.');
      return done({ ...handling, sealed: [...handling.sealed, leaking.id] }, [`the leaking ${leaking.name}`]);
    }
  }
}
