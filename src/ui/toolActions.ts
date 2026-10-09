import type { RepairTarget } from '../game/repair';
import type { PackageAction } from './animation';
import {
  flipBox,
  inspect,
  repair,
  rotateBox,
  weighItem,
  type ActionResult,
  type ShiftState,
} from '../game/shift';
import { ITEM_NAMES, isInspectionItem, type ShopItem } from '../game/shop';
import type { Inventory, InspectionTool, RepairTool } from '../game/types';

type InspectToolId = 'scale' | 'shake' | 'uv' | 'pebble' | 'stethoscope';
type HandlingToolId = 'rotateTool' | 'flipTool';
export type ToolId = InspectToolId | HandlingToolId | RepairTool;
export type UseTarget = RepairTarget; // 'package' means the package itself

export const TOOL_ORDER: readonly ToolId[] = [
  'scale', 'shake', 'uv', 'pebble', 'stethoscope', 'rotateTool', 'flipTool',
  'tape', 'sealant', 'relabel', 'valve', 'foam',
];

// Rotate and flip are two tools in the hand but one purchase in the shop, so they have their own names.
const HANDLING_NAMES: Record<HandlingToolId, string> = { rotateTool: 'Rotate', flipTool: 'Flip' };

const isShopItem = (t: ToolId): t is ToolId & ShopItem => t in ITEM_NAMES;

export const toolName = (t: ToolId): string => (isShopItem(t) ? ITEM_NAMES[t] : HANDLING_NAMES[t as HandlingToolId]);

const SUPPLIES: readonly ToolId[] = TOOL_ORDER.filter((t) => isShopItem(t) && !isInspectionItem(t));
const INSPECT_TOOLS: readonly ToolId[] = TOOL_ORDER.filter((t) => isShopItem(t) && isInspectionItem(t));

export const isSupply = (t: ToolId): t is RepairTool => SUPPLIES.includes(t);
export const isOneShot = (t: ToolId): boolean => INSPECT_TOOLS.includes(t);
const isInspect = (t: ToolId): t is InspectToolId => isOneShot(t);

// The tray button's name: supplies say how many are left.
export const toolLabel = (t: ToolId, inv: Inventory): string =>
  isSupply(t) ? `${toolName(t)}, ${inv.supplies[t]} left` : toolName(t);

export function ownedTools(inv: Inventory): ToolId[] {
  const owns = (t: InspectionTool) => inv.tools.includes(t);
  return TOOL_ORDER.filter((t) => {
    if (isSupply(t)) return inv.supplies[t] > 0;
    if (t === 'rotateTool' || t === 'flipTool') return owns('rotate');
    return owns(t);
  });
}

export const toggleTool = (selected: ToolId | null, tool: ToolId): ToolId | null =>
  selected === tool ? null : tool;

// `opened`: with the box open, the inside (the package target) is where a supply reaches what has no marker.
export function canTarget(tool: ToolId, target: UseTarget, opened = false): boolean {
  if (isSupply(tool)) {
    switch (target.kind) {
      case 'defect': return true;
      case 'shippingLabel':
      case 'contentsLabel': return tool === 'relabel';
      case 'item': return tool === 'sealant';
      case 'package': return opened;
    }
  }
  if (target.kind === 'item') return tool === 'scale';
  return true;
}

// A leak marker is on the package: only the scale and supplies act on the item itself.
export const leakTarget = (tool: ToolId, itemId: number): UseTarget =>
  isSupply(tool) || tool === 'scale' ? { kind: 'item', itemId } : { kind: 'package' };

// An inspection tool is put down once it has checked the package; weighing an item or a refused use keeps it.
export const putDownAfter = (tool: ToolId, target: UseTarget, acted: boolean): boolean =>
  acted && isOneShot(tool) && target.kind !== 'item';

const WRONG_PLACE = 'Use that on the package.';

export function useTool(s: ShiftState, tool: ToolId, target: UseTarget): ActionResult {
  if (isSupply(tool)) return repair(s, tool, target);
  if (target.kind === 'item') {
    return tool === 'scale' ? weighItem(s, target.itemId) : { state: s, message: WRONG_PLACE };
  }
  switch (tool) {
    case 'rotateTool': return rotateBox(s);
    case 'flipTool': return flipBox(s);
    default: {
      const inspectionTool: InspectToolId = tool;
      return inspect(s, inspectionTool);
    }
  }
}

// What the package does on screen when a tool is used: inspections play their own animation on the
// package, supplies the repair patch; weighing an item, rotating and flipping play nothing.
export function animationFor(tool: ToolId, target: UseTarget): PackageAction | undefined {
  if (isSupply(tool)) return 'repair';
  if (target.kind === 'item' || !isInspect(tool)) return undefined;
  return tool;
}
