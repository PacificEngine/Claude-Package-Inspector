import { describe, expect, it } from 'vitest';
import {
  ALL_ADDRESS_ISSUES,
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
  });

  it('formats the label as lines', () => {
    expect(addressLines(goodAddress)).toEqual([
      'A. Pemberton',
      '12 Elm Street',
      'Maplewood 10001',
      'Return: 9 Oak Road, Riverton',
    ]);
  });
});
