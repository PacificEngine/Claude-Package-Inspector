import type { Rng } from './rng';
import type { Address, AddressIssue } from './types';

export const ALL_ADDRESS_ISSUES: AddressIssue[] = [
  'missing_field',
  'smudged',
  'zip_mismatch',
  'po_box',
  'restricted_zone',
  'nowhere',
  'underwater',
  'lunar',
];

export const ADDRESS_ISSUE_LABELS: Record<AddressIssue, string> = {
  missing_field: 'Missing label field',
  smudged: 'Smudged label',
  zip_mismatch: 'ZIP does not match city',
  po_box: 'PO box',
  restricted_zone: 'Restricted zone',
  nowhere: "'Nowhere Lane'",
  underwater: 'Below sea level',
  lunar: 'The Moon',
};

export const ADDRESS_ISSUE_MIN_DAY: Record<AddressIssue, number> = {
  missing_field: 1,
  smudged: 2,
  zip_mismatch: 2,
  po_box: 2,
  restricted_zone: 3,
  nowhere: 4,
  underwater: 5,
  lunar: 5,
};

const CITY_ZIP: Record<string, string> = {
  Maplewood: '10001',
  Riverton: '20002',
  'Port Calloway': '30003',
  Dunmere: '40004',
  'Fort Hush': '99001',
  Atlantis: '00000',
  'Moon Base': 'M0001',
};
const EVERYDAY_CITIES = ['Maplewood', 'Riverton', 'Port Calloway', 'Dunmere'];
const RECIPIENTS = ['A. Pemberton', 'R. Okafor', 'M. Lindqvist', 'T. Navarro', 'J. Whitlock', 'S. Duarte'];
const STREETS = ['Elm Street', 'Oak Road', 'Harbor Lane', 'Mill Court', 'Birch Avenue', 'Quarry Way'];

const REPAIRABLE: readonly AddressIssue[] = ['missing_field', 'smudged', 'zip_mismatch'];

export function isRepairableAddressIssue(issue: AddressIssue): boolean {
  return REPAIRABLE.includes(issue);
}

export function addressIssues(a: Address): AddressIssue[] {
  const issues: AddressIssue[] = [];
  const fields = [a.recipient, a.street, a.city, a.zip];
  if (fields.some((f) => f.trim() === '')) issues.push('missing_field');
  const smudged = fields.some((f) => f.includes('?'));
  if (smudged) issues.push('smudged');
  if (a.city && a.zip && !smudged && CITY_ZIP[a.city] !== a.zip) issues.push('zip_mismatch');
  if (a.street.startsWith('PO Box')) issues.push('po_box');
  if (a.city === 'Fort Hush') issues.push('restricted_zone');
  if (a.street.includes('Nowhere Lane')) issues.push('nowhere');
  if (a.city === 'Atlantis') issues.push('underwater');
  if (a.city === 'Moon Base') issues.push('lunar');
  return issues;
}

function validAddress(rng: Rng): Address {
  const city = rng.pick(EVERYDAY_CITIES);
  return {
    recipient: rng.pick(RECIPIENTS),
    street: `${1 + rng.int(998)} ${rng.pick(STREETS)}`,
    city,
    zip: CITY_ZIP[city],
    returnAddress: `${1 + rng.int(998)} ${rng.pick(STREETS)}, ${rng.pick(EVERYDAY_CITIES)}`,
  };
}

export function generateAddress(rng: Rng, issue: AddressIssue | null): Address {
  const a = validAddress(rng);
  switch (issue) {
    case null:
      return a;
    case 'missing_field': {
      const field = rng.pick(['recipient', 'street', 'zip'] as const);
      return { ...a, [field]: '' };
    }
    case 'smudged':
      return { ...a, street: `???? ${a.street.replace(/^\d+ /, '')}` };
    case 'zip_mismatch': {
      const other = rng.pick(EVERYDAY_CITIES.filter((c) => c !== a.city));
      return { ...a, zip: CITY_ZIP[other] };
    }
    case 'po_box':
      return { ...a, street: `PO Box ${1 + rng.int(9000)}` };
    case 'restricted_zone':
      return { ...a, city: 'Fort Hush', zip: CITY_ZIP['Fort Hush'] };
    case 'nowhere':
      return { ...a, street: '1 Nowhere Lane' };
    case 'underwater':
      return { ...a, city: 'Atlantis', zip: CITY_ZIP['Atlantis'] };
    case 'lunar':
      return { ...a, city: 'Moon Base', zip: CITY_ZIP['Moon Base'] };
  }
}

export function addressLines(a: Address): string[] {
  return [a.recipient, a.street, `${a.city} ${a.zip}`.trim(), `Return: ${a.returnAddress}`];
}
