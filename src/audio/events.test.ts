import { describe, expect, it } from 'vitest';
import { buy, endDay, startCampaign, toShop, type Campaign } from '../game/campaign';
import { ruleCardForDay } from '../game/rules';
import { newInventory } from '../game/shop';
import { openBox, repair, stamp, startShift, type ShiftState } from '../game/shift';
import { inventoryWith, makePackage } from '../game/testing';
import type { Package } from '../game/types';
import { soundsFor } from './events';

function campaignWith(queue: Package[], day = 1, inventory = newInventory()): Campaign {
  const shift: ShiftState = {
    ...startShift(day, inventory, 1),
    card: ruleCardForDay(day),
    queue,
    index: 0,
  };
  return { ...startCampaign(1), day, inventory, shift };
}

const withShift = (c: Campaign, shift: ShiftState): Campaign => ({ ...c, shift });
const clean = makePackage({ fee: 20 });
const torn = makePackage({ id: 2, defects: ['torn_tape'], fee: 20 });

describe('soundsFor', () => {
  it('is silent when nothing changed', () => {
    const c = campaignWith([clean, clean]);
    expect(soundsFor(c, c)).toEqual([]);
  });

  it('plays ship for a correct ship', () => {
    const c = campaignWith([clean, clean]);
    expect(soundsFor(c, withShift(c, stamp(c.shift!, 'ship').state))).toEqual(['ship']);
  });

  it('plays reject for a correct reject', () => {
    const c = campaignWith([torn, clean]);
    expect(soundsFor(c, withShift(c, stamp(c.shift!, 'reject').state))).toEqual(['reject']);
  });

  it('plays strike, not ship, for a wrong call', () => {
    const c = campaignWith([torn, clean]);
    expect(soundsFor(c, withShift(c, stamp(c.shift!, 'ship').state))).toEqual(['strike']);
    const d = campaignWith([clean, clean]);
    expect(soundsFor(d, withShift(d, stamp(d.shift!, 'reject').state))).toEqual(['strike']);
  });

  it('plays fine when opening a box that needs no repair', () => {
    const c = campaignWith([clean]);
    expect(soundsFor(c, withShift(c, openBox(c.shift!).state))).toEqual(['fine']);
  });

  it('is silent when opening a box that needs repair', () => {
    const c = campaignWith([torn]);
    expect(soundsFor(c, withShift(c, openBox(c.shift!).state))).toEqual([]);
  });

  it('plays repair when a supply is used', () => {
    const c = campaignWith([torn], 2, inventoryWith({ tape: 2 }));
    const opened = withShift(c, openBox(c.shift!).state);
    expect(soundsFor(opened, withShift(opened, repair(opened.shift!, 'tape').state))).toEqual([
      'repair',
    ]);
  });

  it('plays dayEnd when the day settles', () => {
    const c0 = startCampaign(1);
    const done = { ...c0, shift: { ...c0.shift!, done: true } };
    expect(soundsFor(done, endDay(done))).toEqual(['dayEnd']);
  });

  it('plays buy when a purchase lowers the bank, and is silent on a refusal', () => {
    const c0 = startCampaign(1);
    const done = { ...c0, shift: { ...c0.shift!, done: true } };
    const shop = toShop(endDay(done));
    const rich = { ...shop, bank: 100 };
    expect(soundsFor(rich, buy(rich, 'rotate').campaign)).toEqual(['buy']);
    expect(soundsFor(rich, buy(rich, 'scale').campaign)).toEqual([]);
  });
});
