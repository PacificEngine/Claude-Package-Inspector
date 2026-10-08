import { describe, expect, it } from 'vitest';
import { newInventory } from './shop';
import { ruleCardForDay } from './rules';
import {
  MAX_STRIKES,
  currentClues,
  currentPackage,
  inspect,
  openBox,
  packagesForDay,
  repair,
  stamp,
  startShift,
  type ShiftState,
} from './shift';
import { goodAddress, inventoryWith, makePackage } from './testing';
import type { Package } from './types';

function shiftWith(queue: Package[], day = 1, inventory = newInventory()): ShiftState {
  return { ...startShift(day, inventory, 1), card: ruleCardForDay(day), queue, index: 0 };
}

const clean = makePackage({ fee: 20 });
const tornBox = makePackage({ id: 2, defects: ['torn_tape'], fee: 20 });

describe('startShift', () => {
  it('builds a queue sized for the day', () => {
    const s = startShift(2, newInventory(), 1);
    expect(s.queue).toHaveLength(packagesForDay(2));
    expect(s.strikes).toBe(0);
    expect(s.done).toBe(false);
  });

  it('is deterministic for the same seed', () => {
    expect(startShift(3, newInventory(), 9).queue).toEqual(startShift(3, newInventory(), 9).queue);
  });
});

describe('stamp', () => {
  it('pays the fee for shipping a good package', () => {
    const r = stamp(shiftWith([clean, clean]), 'ship');
    expect(r.state.earned).toBe(20);
    expect(r.state.strikes).toBe(0);
    expect(r.state.shipped).toBe(1);
    expect(r.state.index).toBe(1);
  });

  it('pays nothing for rejecting a bad package', () => {
    const r = stamp(shiftWith([tornBox, clean]), 'reject');
    expect(r.state.earned).toBe(0);
    expect(r.state.strikes).toBe(0);
    expect(r.state.rejected).toBe(1);
  });

  it('counts correct stamps', () => {
    const good = stamp(shiftWith([clean, clean]), 'ship').state;
    expect(good.correct).toBe(1);
    expect(stamp(good, 'reject').state.correct).toBe(1);
    expect(startShift(1, newInventory(), 1).correct).toBe(0);
  });

  it('gives a strike and no pay for shipping a bad package', () => {
    const r = stamp(shiftWith([tornBox, clean]), 'ship');
    expect(r.state.earned).toBe(0);
    expect(r.state.strikes).toBe(1);
  });

  it('names broken rules in plain words, not ids', () => {
    const noField = makePackage({ address: { ...goodAddress, zip: '' } });
    const msg = stamp(shiftWith([noField, clean]), 'ship').message;
    expect(msg).toContain('Missing label field');
    expect(msg).not.toContain('missing_field');
    const msg2 = stamp(shiftWith([tornBox, clean]), 'ship').message;
    expect(msg2).toContain('Torn tape');
    expect(msg2).not.toContain('torn_tape');
  });

  it('gives a strike for rejecting a good package', () => {
    expect(stamp(shiftWith([clean, clean]), 'reject').state.strikes).toBe(1);
  });

  it('resets handling for the next package', () => {
    const opened = openBox(shiftWith([tornBox, clean])).state;
    const next = stamp(opened, 'reject').state;
    expect(next.handling.opened).toBe(false);
    expect(next.handling.used).toEqual(['look']);
  });

  it('ends the shift on the last package', () => {
    const r = stamp(shiftWith([clean]), 'ship');
    expect(r.state.done).toBe(true);
    expect(currentPackage(r.state)).toBeNull();
  });

  it('ends the shift at the strike limit', () => {
    let s = shiftWith([clean, clean, clean, clean, clean]);
    for (let i = 0; i < MAX_STRIKES; i++) s = stamp(s, 'reject').state;
    expect(s.strikes).toBe(MAX_STRIKES);
    expect(s.done).toBe(true);
  });
});

describe('inspect', () => {
  it('refuses a tool the player does not own', () => {
    const r = inspect(shiftWith([clean]), 'scale');
    expect(r.message).toBe('You do not own that tool.');
    expect(r.state.handling.used).toEqual(['look']);
  });

  it('uses an owned tool and surfaces its clues', () => {
    const inv = inventoryWith({}, ['look', 'rotate']);
    const bottomless = makePackage({ defects: ['bottomless'] });
    const r = inspect(shiftWith([bottomless], 3, inv), 'rotate');
    expect(r.state.handling.used).toEqual(['look', 'rotate']);
    expect(currentClues(r.state).map((c) => c.text).join(' ')).toMatch(/no bottom/);
  });

  it('does not reuse a tool on the same package', () => {
    const inv = inventoryWith({}, ['look', 'rotate']);
    const once = inspect(shiftWith([clean], 3, inv), 'rotate').state;
    expect(inspect(once, 'rotate').message).toBe('You already checked that.');
  });
});

describe('openBox', () => {
  it('fines opening a box that needs no repair', () => {
    const r = openBox(shiftWith([clean]));
    expect(r.state.handling.opened).toBe(true);
    expect(r.state.fines).toBe(40);
    expect(r.message).toBe('Fined $40: that box needed no repair.');
  });

  it('is free for a box that needs repair', () => {
    const r = openBox(shiftWith([tornBox]));
    expect(r.state.fines).toBe(0);
  });

  it('only fines once per box', () => {
    const once = openBox(shiftWith([clean])).state;
    expect(openBox(once).state.fines).toBe(40);
  });
});

describe('repair', () => {
  it('needs the box opened first', () => {
    const inv = inventoryWith({ tape: 1 });
    const r = repair(shiftWith([tornBox], 2, inv), 'tape');
    expect(r.message).toBe('Open the box first.');
  });

  it('repairs, spends a supply, and then the package ships for pay', () => {
    const inv = inventoryWith({ tape: 1 });
    let s = shiftWith([tornBox], 2, inv);
    s = openBox(s).state;
    const r = repair(s, 'tape');
    expect(r.message).toBe('Fixed: Torn tape.');
    expect(r.state.inventory.supplies.tape).toBe(0);
    const shipped = stamp(r.state, 'ship').state;
    expect(shipped.earned).toBe(20);
    expect(shipped.strikes).toBe(0);
  });

  it('says so when a supply was wasted', () => {
    const inv = inventoryWith({ foam: 1 });
    const s = openBox(shiftWith([tornBox], 2, inv)).state;
    expect(repair(s, 'foam').message).toBe('Nothing to fix with that. Supply wasted.');
  });
});
