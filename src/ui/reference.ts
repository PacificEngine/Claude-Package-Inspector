import { EVERYDAY_ZIPS } from '../game/address';
import { kindsForDay } from '../game/packages';
import type { RuleCard } from '../game/rules';
import { SHAPE_OF_KIND, type Shape } from '../game/shapes';
import type { AddressIssue } from '../game/types';

export type TabId = 'rules' | 'shapes' | 'addresses' | 'restrictions';

export const TAB_LABELS: Record<TabId, string> = {
  rules: 'Rules',
  shapes: 'Shapes',
  addresses: 'Addresses',
  restrictions: 'Restrictions',
};

const FORMAT_RULES: AddressIssue[] = ['missing_field', 'zip_mismatch', 'smudged'];
const DESTINATIONS: AddressIssue[] = ['po_box', 'restricted_zone', 'nowhere', 'underwater', 'lunar'];

const mentioned = (card: RuleCard, issues: AddressIssue[]): AddressIssue[] =>
  issues.filter((i) => card.rejectAddress.includes(i) || card.allowedAddress.includes(i));

export function tabsFor(card: RuleCard): TabId[] {
  const tabs: TabId[] = ['rules', 'shapes'];
  if (mentioned(card, FORMAT_RULES).length > 0) tabs.push('addresses');
  const rejectedDestinations = DESTINATIONS.filter((i) => card.rejectAddress.includes(i));
  if (rejectedDestinations.length > 0 || card.restrictedItems.length > 0) tabs.push('restrictions');
  return tabs;
}

const SHAPE_TEXT: Record<Shape, { name: string; kinds: string; description: string }> = {
  cuboid: {
    name: 'Cuboid',
    kinds: 'Boxes and parcels',
    description: 'Four sides to rotate. Flip tumbles it: side, top, the opposite side upside-down, bottom. Rotating on the top or bottom changes which side comes next, and the bottom turns the other way.',
  },
  cylinder: {
    name: 'Cylinder',
    kinds: 'Cans, jars and tubes',
    description: 'One round side. Flip tumbles it: side, top, the side upside-down, bottom.',
  },
  prism: {
    name: 'Triangular prism',
    kinds: 'Prisms',
    description: 'Three sides to rotate; it cannot be flipped.',
  },
  tetra: {
    name: 'Tetrahedron',
    kinds: 'Tetrahedrons',
    description: 'Four faces to rotate; flip it for four more.',
  },
};

const SHAPE_ORDER: Shape[] = ['cuboid', 'cylinder', 'prism', 'tetra'];

export function shapeGuide(day: number): Array<{ name: string; kinds: string; description: string }> {
  const today = new Set(kindsForDay(day).map((k) => SHAPE_OF_KIND[k]));
  return SHAPE_ORDER.filter((s) => today.has(s)).map((s) => SHAPE_TEXT[s]);
}

const FORMAT_TEXT: Record<'missing_field' | 'zip_mismatch' | 'smudged', string> = {
  missing_field: 'A label missing a recipient, street, city or ZIP',
  zip_mismatch: 'A ZIP that does not match the city',
  smudged: 'A smudged label',
};

export function addressGuide(card: RuleCard): {
  rules: Array<{ text: string; rejected: boolean }>;
  cityZips: Array<{ city: string; zip: string }>;
} {
  const rules = mentioned(card, FORMAT_RULES).map((issue) => ({
    text: FORMAT_TEXT[issue as keyof typeof FORMAT_TEXT],
    rejected: card.rejectAddress.includes(issue),
  }));
  const hasZipRule = mentioned(card, ['zip_mismatch']).length > 0;
  return { rules, cityZips: hasZipRule ? EVERYDAY_ZIPS.map((c) => ({ ...c })) : [] };
}

const DESTINATION_TEXT: Record<'po_box' | 'restricted_zone' | 'nowhere' | 'underwater' | 'lunar', string> = {
  po_box: 'PO boxes',
  restricted_zone: 'Fort Hush (ZIP 99001)',
  nowhere: "'Nowhere Lane'",
  underwater: 'Atlantis (below sea level)',
  lunar: 'Moon Base',
};

export function restrictionGuide(card: RuleCard): { destinations: string[]; items: string[] } {
  return {
    destinations: DESTINATIONS.filter((i) => card.rejectAddress.includes(i)).map(
      (i) => DESTINATION_TEXT[i as keyof typeof DESTINATION_TEXT],
    ),
    items: [...card.restrictedItems],
  };
}
