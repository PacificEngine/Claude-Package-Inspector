import { addressIssues, isRepairableAddressIssue } from './address';
import { DEFECTS } from './defects';
import { revealedDefects } from './inspection';
import type { Handling, Inventory, Package, RepairTool } from './types';

export type RepairResult =
  | { ok: true; handling: Handling; inventory: Inventory; fixed: string[] }
  | { ok: false; reason: string };

export function applyRepair(
  pkg: Package,
  handling: Handling,
  inventory: Inventory,
  tool: RepairTool,
): RepairResult {
  if (inventory.supplies[tool] < 1) return { ok: false, reason: 'You are out of that supply.' };

  const matching = revealedDefects(pkg, handling).filter((id) => DEFECTS[id].repairedBy === tool);
  // Only repairs that reach inside need the box open; patching tape or a dent works from outside.
  const fixedDefects = handling.opened ? matching : matching.filter((id) => !DEFECTS[id].repairNeedsOpen);

  const relabelsAddress =
    tool === 'relabel' &&
    !handling.relabeled &&
    addressIssues(pkg.address).some(isRepairableAddressIssue);

  if (fixedDefects.length === 0 && !relabelsAddress && matching.length > 0) {
    return { ok: false, reason: 'Open the box first.' };
  }

  return {
    ok: true,
    handling: {
      ...handling,
      repaired: [...handling.repaired, ...fixedDefects],
      relabeled: handling.relabeled || relabelsAddress,
    },
    inventory: {
      ...inventory,
      supplies: { ...inventory.supplies, [tool]: inventory.supplies[tool] - 1 },
    },
    fixed: [...fixedDefects.map((id) => DEFECTS[id].label), ...(relabelsAddress ? ['address label'] : [])],
  };
}
