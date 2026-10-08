import type { InspectionTool, Inventory, RepairTool } from './types';

export type PurchasableTool = Exclude<InspectionTool, 'look'>;
export type ShopItem = PurchasableTool | RepairTool;

export const INSPECTION_ITEMS: readonly PurchasableTool[] = [
  'rotate',
  'scale',
  'shake',
  'uv',
  'pebble',
  'stethoscope',
];
export const REPAIR_ITEMS: readonly RepairTool[] = ['tape', 'sealant', 'relabel', 'valve', 'foam'];

export const PRICES: Record<ShopItem, number> = {
  rotate: 40,
  scale: 60,
  shake: 80,
  uv: 100,
  pebble: 120,
  stethoscope: 150,
  tape: 8,
  sealant: 12,
  relabel: 10,
  valve: 15,
  foam: 20,
};

export const ITEM_NAMES: Record<ShopItem, string> = {
  rotate: 'Rotate / flip',
  scale: 'Scale',
  shake: 'Shake',
  uv: 'UV light',
  pebble: 'Drop-test pebble',
  stethoscope: 'Stethoscope',
  tape: 'Duct tape',
  sealant: 'Sealant',
  relabel: 'Relabel kit',
  valve: 'Pressure valve',
  foam: 'Soundproof foam',
};

// Keys are the day that just ended; those items go on sale that night.
export const UNLOCKS_AFTER_DAY: Record<number, ShopItem[]> = {
  1: ['rotate', 'tape'],
  2: ['scale', 'sealant'],
  3: ['shake', 'uv'],
  4: ['pebble', 'relabel'],
  5: ['stethoscope', 'foam'],
  6: ['valve'],
};

export function unlockedItems(completedDay: number): ShopItem[] {
  return Object.entries(UNLOCKS_AFTER_DAY)
    .filter(([day]) => Number(day) <= completedDay)
    .flatMap(([, items]) => items);
}

export function isInspectionItem(item: ShopItem): item is PurchasableTool {
  return (INSPECTION_ITEMS as readonly string[]).includes(item);
}

export function newInventory(): Inventory {
  return {
    tools: ['look'],
    supplies: { tape: 0, sealant: 0, relabel: 0, valve: 0, foam: 0 },
  };
}

export type PurchaseResult =
  | { ok: true; bank: number; inventory: Inventory }
  | { ok: false; reason: string };

const fail = (reason: string): PurchaseResult => ({ ok: false, reason });

export function purchase(
  inventory: Inventory,
  bank: number,
  completedDay: number,
  item: ShopItem,
  quantity = 1,
): PurchaseResult {
  if (!unlockedItems(completedDay).includes(item)) return fail('That item is not on sale yet.');
  if (!Number.isInteger(quantity) || quantity < 1) return fail('Quantity must be at least 1.');
  if (bank < 0) return fail('You are in debt. The shop will not serve you.');

  if (isInspectionItem(item)) {
    if (inventory.tools.includes(item)) return fail('You already own that.');
    if (PRICES[item] > bank) return fail('You cannot afford that.');
    return {
      ok: true,
      bank: bank - PRICES[item],
      inventory: { ...inventory, tools: [...inventory.tools, item] },
    };
  }

  const cost = PRICES[item] * quantity;
  if (cost > bank) return fail('You cannot afford that.');
  return {
    ok: true,
    bank: bank - cost,
    inventory: {
      ...inventory,
      supplies: { ...inventory.supplies, [item]: inventory.supplies[item] + quantity },
    },
  };
}
