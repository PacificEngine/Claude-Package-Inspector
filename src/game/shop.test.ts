import { describe, expect, it } from 'vitest';
import { inventoryWith } from './testing';
import { PRICES, newInventory, purchase, unlockedItems } from './shop';

describe('unlocks', () => {
  it('has nothing for sale before day 1 is complete', () => {
    expect(unlockedItems(0)).toEqual([]);
  });

  it('unlocks rotate and tape after day 1, and keeps them afterwards', () => {
    expect(unlockedItems(1)).toEqual(['rotate', 'tape']);
    expect(unlockedItems(2)).toEqual(['rotate', 'tape', 'scale', 'sealant']);
  });

  it('has every item unlocked after day 6', () => {
    expect(unlockedItems(6)).toHaveLength(11);
  });
});

describe('newInventory', () => {
  it('starts with only the base kit', () => {
    expect(newInventory()).toEqual(inventoryWith());
  });
});

describe('purchase', () => {
  it('refuses items that are not unlocked yet', () => {
    expect(purchase(newInventory(), 500, 1, 'scale')).toEqual({
      ok: false,
      reason: 'That item is not on sale yet.',
    });
  });

  it('buys an inspection tool once', () => {
    const r = purchase(newInventory(), 500, 1, 'rotate');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.bank).toBe(500 - PRICES.rotate);
    expect(r.inventory.tools).toEqual(['look', 'rotate']);
    expect(purchase(r.inventory, r.bank, 1, 'rotate')).toEqual({
      ok: false,
      reason: 'You already own that.',
    });
  });

  it('buys repair supplies by the unit', () => {
    const r = purchase(newInventory(), 500, 1, 'tape', 5);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.bank).toBe(500 - 5 * PRICES.tape);
    expect(r.inventory.supplies.tape).toBe(5);
  });

  it('refuses when the player cannot afford it', () => {
    expect(purchase(newInventory(), 1, 1, 'rotate')).toEqual({
      ok: false,
      reason: 'You cannot afford that.',
    });
  });

  it('refuses everything while in debt', () => {
    expect(purchase(newInventory(), -5, 1, 'tape')).toEqual({
      ok: false,
      reason: 'You are in debt. The shop will not serve you.',
    });
  });

  it('refuses a quantity below one', () => {
    expect(purchase(newInventory(), 500, 1, 'tape', 0)).toEqual({
      ok: false,
      reason: 'Quantity must be at least 1.',
    });
  });
});
