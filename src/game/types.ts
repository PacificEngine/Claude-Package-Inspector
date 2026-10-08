export type PackageKind = 'box' | 'can' | 'parcel' | 'jar' | 'tube';

export type InspectionTool =
  | 'look'
  | 'rotate'
  | 'scale'
  | 'shake'
  | 'uv'
  | 'pebble'
  | 'stethoscope';

export type RepairTool = 'tape' | 'sealant' | 'relabel' | 'valve' | 'foam';

export type DefectId =
  | 'leaking'
  | 'crushed_corner'
  | 'torn_tape'
  | 'bulging'
  | 'wet_cardboard'
  | 'wrong_weight'
  | 'rattling'
  | 'missing_label'
  | 'bottomless'
  | 'humming'
  | 'whispering'
  | 'ticking'
  | 'scorching'
  | 'future_contents'
  | 'heavier_inside'
  | 'tiny_weather';

export type AddressIssue =
  | 'missing_field'
  | 'smudged'
  | 'zip_mismatch'
  | 'po_box'
  | 'restricted_zone'
  | 'nowhere'
  | 'underwater'
  | 'lunar';

export type Verdict = 'ship' | 'reject';

export interface Address {
  recipient: string;
  street: string;
  city: string;
  zip: string;
  returnAddress: string;
}

export interface Package {
  id: number;
  kind: PackageKind;
  defects: DefectId[];
  address: Address;
  declaredWeightKg: number;
  actualWeightKg: number;
  fee: number;
}

// What the player has done to the package currently on the desk.
export interface Handling {
  opened: boolean;
  used: InspectionTool[];
  repaired: DefectId[];
  relabeled: boolean;
}

export interface Inventory {
  tools: InspectionTool[];
  supplies: Record<RepairTool, number>;
}
