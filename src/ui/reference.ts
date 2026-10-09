import { EVERYDAY_ZIPS, NOWHERE_STREET, RESTRICTED_PEOPLE } from '../game/address';
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

const mentioned = (card: RuleCard, issues: AddressIssue[]): AddressIssue[] =>
  issues.filter((i) => card.rejectAddress.includes(i) || card.allowedAddress.includes(i));

export function tabsFor(card: RuleCard): TabId[] {
  const tabs: TabId[] = ['rules', 'shapes'];
  if (mentioned(card, FORMAT_RULES).length > 0) tabs.push('addresses');
  const g = restrictionGuide(card);
  if (g.people.length + g.towns.length + g.addresses.length + g.items.length > 0) tabs.push('restrictions');
  return tabs;
}

const SHAPE_TEXT: Record<Shape, { name: string; description: string }> = {
  cuboid: {
    name: 'Boxes and parcels',
    description: 'Four sides to rotate. Flip tumbles it: side, top, the opposite side upside-down, bottom. Rotating on the top or bottom changes which side comes next, and the bottom turns the other way.',
  },
  cylinder: {
    name: 'Cans, jars and tubes',
    description: 'Two faces, front and back, to rotate between. Flip tumbles it: side, top, the same side upside-down, bottom.',
  },
  prism: {
    name: 'Tents and wedges',
    description: 'Three sides to rotate. Flip tumbles it: side, top, the opposite side upside-down, bottom.',
  },
  tetra: {
    name: 'Pyraminxes and caltrops',
    description: 'Four faces to rotate. Flip it to see the bottom.',
  },
  octa: {
    name: 'Diamonds and pyrites',
    description: 'Four faces to rotate; flip it for four more.',
  },
};

const SHAPE_ORDER: Shape[] = ['cuboid', 'cylinder', 'prism', 'tetra', 'octa'];

export function shapeGuide(day: number): Array<{ name: string; description: string }> {
  const today = new Set(kindsForDay(day).map((k) => SHAPE_OF_KIND[k]));
  return SHAPE_ORDER.filter((s) => today.has(s)).map((s) => SHAPE_TEXT[s]);
}

const EXAMPLE_LABEL = [
  { line: 'A. Pemberton', meaning: 'Recipient: an initial and a surname.' },
  { line: '12 Elm Street', meaning: 'Street: a house number and a street name.' },
  { line: 'Maplewood 10001', meaning: 'City and ZIP: the ZIP must belong to the city.' },
  { line: 'Return: 40 Oak Road, Riverton', meaning: 'Return address: where the package came from.' },
];

export function addressGuide(card: RuleCard): {
  example: Array<{ line: string; meaning: string }>;
  cityZips: Array<{ city: string; zip: string }>;
} {
  const hasZipRule = mentioned(card, ['zip_mismatch']).length > 0;
  return {
    example: EXAMPLE_LABEL.map((row) => ({ ...row })),
    cityZips: hasZipRule ? EVERYDAY_ZIPS.map((c) => ({ ...c })) : [],
  };
}

const TOWN_TEXT: Array<[AddressIssue, string]> = [
  ['restricted_zone', 'Fort Hush (ZIP 99001)'],
  ['underwater', 'Atlantis (below sea level)'],
  ['lunar', 'Moon Base'],
];

export function restrictionGuide(card: RuleCard): {
  people: string[];
  towns: string[];
  addresses: string[];
  items: string[];
} {
  const rejected = (issue: AddressIssue): boolean => card.rejectAddress.includes(issue);
  return {
    people: rejected('restricted_person') ? [...RESTRICTED_PEOPLE] : [],
    towns: TOWN_TEXT.filter(([issue]) => rejected(issue)).map(([, text]) => text),
    addresses: rejected('nowhere') ? [NOWHERE_STREET] : [],
    items: [...card.restrictedItems],
  };
}
