import { addressIssues, isRepairableAddressIssue } from './address';
import { itemsIn, labelMatches } from './contents';
import { DEFECTS } from './defects';
import { revealedDefects } from './inspection';
import type { Handling, Inventory, Package, RepairTool } from './types';

export type RepairResult =
  | { ok: true; handling: Handling; inventory: Inventory; fixed: string[] }
  | { ok: false; reason: string };

const spend = (inventory: Inventory, tool: RepairTool): Inventory => ({
  ...inventory,
  supplies: { ...inventory.supplies, [tool]: inventory.supplies[tool] - 1 },
});

export function applyRepair(
  pkg: Package,
  handling: Handling,
  inventory: Inventory,
  tool: RepairTool,
): RepairResult {
  if (inventory.supplies[tool] < 1) return { ok: false, reason: 'You are out of that supply.' };

  // With the box open, sealant goes to the cause first: one leaking item per use.
  if (tool === 'sealant' && handling.opened) {
    const leaking = itemsIn(pkg, handling).find((i) => i.leaking && !handling.sealed.includes(i.id));
    if (leaking) {
      return {
        ok: true,
        handling: { ...handling, sealed: [...handling.sealed, leaking.id] },
        inventory: spend(inventory, tool),
        fixed: [`the leaking ${leaking.name}`],
      };
    }
  }

  const matching = revealedDefects(pkg, handling).filter((id) => DEFECTS[id].repairedBy === tool);
  // Only repairs that reach inside need the box open; patching tape or a dent works from outside.
  const fixedDefects = handling.opened ? matching : matching.filter((id) => !DEFECTS[id].repairNeedsOpen);

  const relabelsAddress =
    tool === 'relabel' &&
    !handling.relabeled &&
    addressIssues(pkg.address).some(isRepairableAddressIssue);

  const reprints =
    tool === 'relabel' &&
    handling.opened &&
    !fixedDefects.includes('missing_label') &&
    handling.repaired.includes('missing_label') &&
    !labelMatches(pkg, handling);
  const printsLabel = fixedDefects.includes('missing_label') || reprints;

  if (fixedDefects.length === 0 && !relabelsAddress && !reprints && matching.length > 0) {
    return { ok: false, reason: 'Open the box first.' };
  }

  return {
    ok: true,
    handling: {
      ...handling,
      repaired: [...handling.repaired, ...fixedDefects],
      relabeled: handling.relabeled || relabelsAddress,
      labelItems: printsLabel ? itemsIn(pkg, handling).map((i) => i.id) : handling.labelItems,
    },
    inventory: spend(inventory, tool),
    fixed: [
      ...fixedDefects.map((id) => DEFECTS[id].label),
      ...(relabelsAddress ? ['address label'] : []),
      ...(reprints ? ['contents label'] : []),
    ],
  };
}
