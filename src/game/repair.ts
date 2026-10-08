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
  if (!handling.opened) return { ok: false, reason: 'Open the box first.' };
  if (inventory.supplies[tool] < 1) return { ok: false, reason: 'You are out of that supply.' };

  const fixedDefects = revealedDefects(pkg, handling).filter(
    (id) => DEFECTS[id].repairedBy === tool,
  );
  const relabelsAddress =
    tool === 'relabel' &&
    !handling.relabeled &&
    addressIssues(pkg.address).some(isRepairableAddressIssue);

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
