import { describe, expect, it } from 'vitest';
import {
  ADDRESS_ISSUE_LABELS,
  ADDRESS_ISSUE_MIN_DAY,
  ALL_ADDRESS_ISSUES,
  EVERYDAY_ZIPS,
  RESTRICTED_PEOPLE,
  addressIssues,
  addressLines,
  generateAddress,
  isRepairableAddressIssue,
} from './address';
import { createRng } from './rng';
import { goodAddress } from './testing';

describe('addresses', () => {
  it('a good address has no issues', () => {
    expect(addressIssues(goodAddress)).toEqual([]);
  });

  it('generateAddress(null) is always clean', () => {
    for (let seed = 1; seed <= 50; seed++) {
      expect(addressIssues(generateAddress(createRng(seed), null))).toEqual([]);
    }
  });

  it.each(ALL_ADDRESS_ISSUES)('generateAddress(%s) yields exactly that issue', (issue) => {
    for (let seed = 1; seed <= 50; seed++) {
      expect(addressIssues(generateAddress(createRng(seed), issue))).toEqual([issue]);
    }
  });

  it('only malformed issues are repairable with a relabel', () => {
    expect(isRepairableAddressIssue('missing_field')).toBe(true);
    expect(isRepairableAddressIssue('smudged')).toBe(true);
    expect(isRepairableAddressIssue('zip_mismatch')).toBe(true);
    expect(isRepairableAddressIssue('po_box')).toBe(false);
    expect(isRepairableAddressIssue('lunar')).toBe(false);
    expect(isRepairableAddressIssue('restricted_person')).toBe(false);
  });

  describe('restricted people', () => {
    it('is an address issue from day 3', () => {
      expect(ALL_ADDRESS_ISSUES).toContain('restricted_person');
      expect(ADDRESS_ISSUE_LABELS.restricted_person).toBe('Restricted recipient');
      expect(ADDRESS_ISSUE_MIN_DAY.restricted_person).toBe(3);
      expect(RESTRICTED_PEOPLE).toEqual(['Z. Blackwood', 'K. Mortimer']);
    });

    it('addresses the package to a restricted person, and is otherwise a valid address', () => {
      const seen = new Set<string>();
      for (let seed = 1; seed <= 50; seed++) {
        const a = generateAddress(createRng(seed), 'restricted_person');
        expect(RESTRICTED_PEOPLE).toContain(a.recipient);
        expect(addressIssues(a)).toEqual(['restricted_person']);
        seen.add(a.recipient);
      }
      expect([...seen].sort()).toEqual(['K. Mortimer', 'Z. Blackwood']);
    });

    it('never flags an everyday recipient', () => {
      for (let seed = 1; seed <= 50; seed++) {
        expect(addressIssues(generateAddress(createRng(seed), null))).not.toContain('restricted_person');
      }
      expect(addressIssues({ ...goodAddress, recipient: 'Z. Blackwood' })).toEqual(['restricted_person']);
    });
  });

  it('formats the label as lines', () => {
    expect(addressLines(goodAddress)).toEqual([
      'A. Pemberton',
      '12 Elm Street',
      'Maplewood 10001',
      'Return: 9 Oak Road, Riverton',
    ]);
  });

  it('lists the everyday cities with the ZIP codes that match them', () => {
    expect(EVERYDAY_ZIPS).toEqual([
      { city: 'Maplewood', zip: '10001' },
      { city: 'Riverton', zip: '20002' },
      { city: 'Port Calloway', zip: '30003' },
      { city: 'Dunmere', zip: '40004' },
    ]);
  });
});
