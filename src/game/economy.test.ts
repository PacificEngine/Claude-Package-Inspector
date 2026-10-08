import { describe, expect, it } from 'vitest';
import { openingFine, settle } from './economy';
import { makePackage } from './testing';

describe('economy', () => {
  it('fines twice the shipping fee so needless opening never pays', () => {
    expect(openingFine(makePackage({ fee: 25 }))).toBe(50);
  });

  it('settles earnings minus fines into the bank', () => {
    expect(settle({ earned: 120, fines: 30 }, 10)).toEqual({ payout: 90, bank: 100 });
  });

  it('can settle into debt', () => {
    expect(settle({ earned: 10, fines: 80 }, 20)).toEqual({ payout: -70, bank: -50 });
  });
});
