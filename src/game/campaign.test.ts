import { describe, expect, it } from 'vitest';
import { buy, endDay, nextDay, startCampaign, toShop, type Campaign } from './campaign';
import { LAST_DAY, isShippable } from './rules';
import { currentPackage, stamp } from './shift';

// Plays the whole shift perfectly using the true verdict.
function playShift(c: Campaign): Campaign {
  let s = c.shift!;
  while (!s.done) {
    const pkg = currentPackage(s)!;
    s = stamp(s, isShippable(pkg, s.handling, s.card) ? 'ship' : 'reject').state;
  }
  return { ...c, shift: s };
}

describe('campaign', () => {
  it('starts on day 1 with an empty bank and the base kit', () => {
    const c = startCampaign(1);
    expect(c.phase).toBe('shift');
    expect(c.day).toBe(1);
    expect(c.bank).toBe(0);
    expect(c.inventory.tools).toEqual(['look']);
  });

  it('cannot end the day before the shift is over', () => {
    expect(() => endDay(startCampaign(1))).toThrow('The shift is not over yet.');
  });

  it('settles pay into the bank only when the day ends', () => {
    let c = playShift(startCampaign(1));
    expect(c.bank).toBe(0);
    c = endDay(c);
    expect(c.phase).toBe('dayEnd');
    expect(c.bank).toBe(c.shift!.earned - c.shift!.fines);
    expect(c.summary).toMatchObject({ day: 1, bankAfter: c.bank, strikes: 0, failed: false });
  });

  it('reports accuracy inputs in the day summary', () => {
    const c0 = startCampaign(1);
    const s = { ...c0.shift!, shipped: 5, rejected: 3, correct: 7, done: true };
    const c = endDay({ ...c0, shift: s });
    expect(c.summary).toMatchObject({ correct: 7, stamped: 8 });
  });

  it('opens the shop after day end with the first unlocks on sale', () => {
    const c = toShop(endDay(playShift(startCampaign(1))));
    expect(c.phase).toBe('shop');
    const bought = buy({ ...c, bank: 100 }, 'rotate');
    expect(bought.campaign.inventory.tools).toContain('rotate');
    expect(bought.campaign.bank).toBe(60);
  });

  it('reports shop refusals without changing state', () => {
    const c = toShop(endDay(playShift(startCampaign(1))));
    const r = buy({ ...c, bank: 100 }, 'scale');
    expect(r.message).toBe('That item is not on sale yet.');
    expect(r.campaign.bank).toBe(100);
  });

  it('only allows buying while the shop is open', () => {
    expect(() => buy(startCampaign(1), 'rotate')).toThrow('The shop is closed.');
  });

  it('carries the inventory into the next day', () => {
    let c = toShop(endDay(playShift(startCampaign(1))));
    c = buy({ ...c, bank: 100 }, 'tape', 3).campaign;
    c = nextDay(c);
    expect(c.phase).toBe('shift');
    expect(c.day).toBe(2);
    expect(c.inventory.supplies.tape).toBe(3);
    expect(c.shift!.inventory.supplies.tape).toBe(3);
  });

  it('finishes after the last day instead of opening a shop', () => {
    let c: Campaign = { ...startCampaign(1), day: LAST_DAY };
    c = { ...c, shift: { ...c.shift!, day: LAST_DAY } };
    c = toShop(endDay(playShift(c)));
    expect(c.phase).toBe('finished');
  });

  it('marks a shift ended by strikes as failed but still settles', () => {
    const c0 = startCampaign(1);
    const s = { ...c0.shift!, strikes: 3, done: true, earned: 10, fines: 5 };
    const c = endDay({ ...c0, shift: s });
    expect(c.summary).toMatchObject({ failed: true, payout: 5, bankAfter: 5 });
  });

  it('prevents double settlement by rejecting endDay when already settled', () => {
    const c = endDay(playShift(startCampaign(1)));
    expect(() => endDay(c)).toThrow('The day has already been settled.');
  });

  it('prevents endDay from shop phase to avoid losing purchases', () => {
    const c = toShop(endDay(playShift(startCampaign(1))));
    expect(c.phase).toBe('shop');
    expect(() => endDay(c)).toThrow('The day has already been settled.');
  });

  it('applies repair-consumed supplies from shift to campaign inventory at endDay', () => {
    let c = startCampaign(1);
    c = playShift(c);
    // Simulate repair consuming tape: campaign has 3, shift now has 1
    c = {
      ...c,
      inventory: { ...c.inventory, supplies: { ...c.inventory.supplies, tape: 3 } },
      shift: { ...c.shift!, inventory: { ...c.shift!.inventory, supplies: { ...c.shift!.inventory.supplies, tape: 1 } } },
    };
    c = endDay(c);
    expect(c.inventory.supplies.tape).toBe(1);
  });
});
