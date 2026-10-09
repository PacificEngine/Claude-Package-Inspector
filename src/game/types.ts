import type { Item } from './contents';
export type PackageKind = 'box' | 'can' | 'parcel' | 'jar' | 'tube' | 'prism' | 'tetra';

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

export type Side = 'up' | 'down';

// Which face of the package a defect sits on.
export interface Placement {
  side: Side;
  face: number;
}

export interface Package {
  contents: Item[];
  packagingKg: number;
  labelFace: number; // index of the up face carrying the contents label
  id: number;
  kind: PackageKind;
  placements?: Partial<Record<DefectId, Placement>>;
  defects: DefectId[];
  address: Address;
  declaredWeightKg: number;
  actualWeightKg: number;
  fee: number;
}

// What the player has done to the package currently on the desk.
export interface Handling {
  opened: boolean; // the box is open: the inside view
  flipped: boolean; // derived by orient(): the other side is showing: the back view
  fined: boolean; // the opening fine was already charged for this package
  flipPos: number; // where the package is in its flip cycle (the source of truth)
  turn: number; // running count of rotations (the source of truth)
  upsideDown: boolean; // derived by orient(): the side on show is upside-down
  spin: number; // derived by orient(): quarter turns the top or bottom picture is spun by
  face: number; // derived by orient(): index of the face showing on the current side
  visited: string[]; // face keys the player has shown (e.g. 'up:0')
  used: InspectionTool[];
  repaired: DefectId[];
  addressRead: boolean; // the shipping label has been read
  contentsRead: boolean; // the contents label has been read
  relabeled: boolean;
  notes: string[]; // keys of the clues the player has recorded, in order
  discarded: number[]; // ids of items the player has thrown away
  sealed: number[]; // ids of leaking items the player has sealed
  labelItems: number[] | null; // ids of the items the contents label was last printed for
}

export interface Inventory {
  tools: InspectionTool[];
  supplies: Record<RepairTool, number>;
}

export type View = 'front' | 'back' | 'inside';
