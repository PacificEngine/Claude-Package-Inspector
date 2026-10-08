import type { Address, InspectionTool, Inventory, Package, RepairTool } from './types';

export const goodAddress: Address = {
  recipient: 'A. Pemberton',
  street: '12 Elm Street',
  city: 'Maplewood',
  zip: '10001',
  returnAddress: '9 Oak Road, Riverton',
};

export function makePackage(over: Partial<Package> = {}): Package {
  return {
    id: 1,
    kind: 'box',
    defects: [],
    address: goodAddress,
    declaredWeightKg: 2,
    actualWeightKg: 2,
    fee: 20,
    ...over,
  };
}

export function inventoryWith(
  supplies: Partial<Record<RepairTool, number>> = {},
  tools: InspectionTool[] = ['look'],
): Inventory {
  return {
    tools,
    supplies: { tape: 0, sealant: 0, relabel: 0, valve: 0, foam: 0, ...supplies },
  };
}
