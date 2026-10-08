import { describe, expect, it } from 'vitest';
import { newInventory } from './shop';
import { ruleCardForDay } from './rules';
import {
  MAX_STRIKES,
  closeBox,
  currentNotes,
  flipBox,
  currentPackage,
  inspect,
  noteDefect,
  openBox,
  packagesForDay,
  repair,
  stamp,
  startShift,
  type ShiftState,
} from './shift';
import { goodAddress, inventoryWith, makePackage } from './testing';
import type { InspectionTool, Package } from './types';

function shiftWith(queue: Package[], day = 1, inventory = newInventory()): ShiftState {
  return { ...startShift(day, inventory, 1), card: ruleCardForDay(day), queue, index: 0 };
}

const clean = makePackage({ fee: 20 });
const tornBox = makePackage({ id: 2, defects: ['torn_tape'], fee: 20 });
const bottomlessBox = makePackage({ id: 3, defects: ['bottomless'], fee: 20 });

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
    const r = flipBox(shiftWith([bottomless], 3, inv));
    expect(r.state.handling.used).toEqual(['look', 'rotate']);
    const noted = noteDefect(r.state, 'bottomless', 'back').state;
    expect(currentNotes(noted).map((c) => c.text).join(' ')).toMatch(/no bottom/);
  });

  it('does not reuse a tool on the same package', () => {
    const once = inspect(shiftWith([clean], 3, tools('scale')), 'scale').state;
    expect(inspect(once, 'scale').message).toBe('You already checked that.');
  });
});

describe('openBox', () => {
  it('fines opening a box that does not need opening', () => {
    const r = openBox(shiftWith([clean]));
    expect(r.state.handling.opened).toBe(true);
    expect(r.state.fines).toBe(40);
    expect(r.message).toBe('Fined $40: that box did not need opening.');
  });

  it('fines opening a box that only needs a repair from outside', () => {
    expect(openBox(shiftWith([tornBox])).state.fines).toBe(40);
  });

  it('is free for a box that needs opening', () => {
    const bottomless = makePackage({ id: 3, defects: ['bottomless'], fee: 20 });
    const r = openBox(shiftWith([bottomless], 5));
    expect(r.state.fines).toBe(0);
    expect(r.message).toBe('Box opened.');
  });

  it('only fines once per box', () => {
    const once = openBox(shiftWith([clean])).state;
    expect(openBox(once).state.fines).toBe(40);
  });
});

describe('repair', () => {
  it('needs the box opened first', () => {
    const inv = inventoryWith({ tape: 1 }, ['look', 'rotate']);
    let s = shiftWith([bottomlessBox], 2, inv);
    s = flipBox(s).state;
    const r = repair(s, 'tape');
    expect(r.message).toBe('Open the box first.');
  });

  it('repairs, spends a supply, and then the package ships for pay', () => {
    const inv = inventoryWith({ tape: 1 });
    let s = shiftWith([tornBox], 2, inv);
    s = openBox(s).state;
    const r = repair(s, 'tape');
    expect(r.message).toBe('Fixed: Torn tape.');
    expect(r.state.inventory.supplies.tape).toBe(0);
    const shipped = stamp(closeBox(r.state).state, 'ship').state;
    expect(shipped.earned).toBe(20);
    expect(shipped.strikes).toBe(0);
  });

  it('says so when a supply was wasted', () => {
    const inv = inventoryWith({ foam: 1 });
    const s = openBox(shiftWith([tornBox], 2, inv)).state;
    expect(repair(s, 'foam').message).toBe('Nothing to fix with that. Supply wasted.');
  });
});

const tools = (...t: InspectionTool[]) => inventoryWith({}, ['look', ...t]);

describe('closeBox', () => {
  it('closes an open box', () => {
    const opened = openBox(shiftWith([clean])).state;
    const r = closeBox(opened);
    expect(r.state.handling.opened).toBe(false);
    expect(r.message).toBe('Box closed.');
  });

  it('refuses when the box is already closed', () => {
    expect(closeBox(shiftWith([clean])).message).toBe('The box is already closed.');
  });

  it('does not charge the fine again when the box is reopened', () => {
    let s = openBox(shiftWith([clean])).state;
    s = closeBox(s).state;
    s = openBox(s).state;
    expect(s.fines).toBe(40);
  });
});

describe('flipBox', () => {
  it('needs the rotate tool', () => {
    expect(flipBox(shiftWith([clean])).message).toBe('You do not own that tool.');
  });

  it('shows the back, counts as using the tool, and flips back again', () => {
    const s0 = shiftWith([clean], 3, tools('rotate'));
    const back = flipBox(s0).state;
    expect(back.handling.flipped).toBe(true);
    expect(back.handling.used).toEqual(['look', 'rotate']);
    const front = flipBox(back).state;
    expect(front.handling.flipped).toBe(false);
    expect(front.handling.used).toEqual(['look', 'rotate']);
  });

  it('is refused while the box is open, and opening is refused while flipped', () => {
    const s0 = shiftWith([clean], 3, tools('rotate'));
    expect(flipBox(openBox(s0).state).message).toBe('Close the box first.');
    expect(openBox(flipBox(s0).state).message).toBe('Flip the box back first.');
  });
});

describe('inspect with views and notes', () => {
  it('sends flipping to the flip button', () => {
    const s0 = shiftWith([clean], 3, tools('rotate'));
    expect(inspect(s0, 'rotate').message).toBe('Use Flip box for that.');
  });

  it('only works face up and closed', () => {
    const s0 = shiftWith([clean], 3, tools('rotate', 'scale'));
    const msg = 'Close the box and turn it face up first.';
    expect(inspect(flipBox(s0).state, 'scale').message).toBe(msg);
    expect(inspect(openBox(s0).state, 'scale').message).toBe(msg);
  });

  it('records scale readings and sound clues automatically, even a quiet result', () => {
    const rattler = makePackage({ defects: ['rattling'] });
    const s0 = shiftWith([rattler], 4, tools('scale', 'shake', 'stethoscope'));
    let s = inspect(s0, 'scale').state;
    s = inspect(s, 'shake').state;
    s = inspect(s, 'stethoscope').state;
    expect(currentNotes(s).map((c) => c.key)).toEqual([
      'scale:none',
      'shake:rattling',
      'stethoscope:none',
    ]);
  });

  it('does not record visual clues until a marker is clicked', () => {
    const leaker = makePackage({ kind: 'can', defects: ['leaking'] });
    const s = inspect(shiftWith([leaker], 3, tools('uv')), 'uv').state;
    expect(currentNotes(s)).toEqual([]);
  });
});

describe('noteDefect', () => {
  const leaker = makePackage({ kind: 'can', defects: ['leaking'] });

  it('records a visible defect from its front marker', () => {
    const r = noteDefect(shiftWith([leaker]), 'leaking', 'front');
    expect(currentNotes(r.state).map((c) => c.key)).toEqual(['look:leaking']);
    expect(r.message).toBe('A dark drip trails down the side.');
  });

  it('does not record the same clue twice', () => {
    const once = noteDefect(shiftWith([leaker]), 'leaking', 'front').state;
    const twice = noteDefect(once, 'leaking', 'front');
    expect(twice.message).toBe('Already noted.');
    expect(currentNotes(twice.state)).toHaveLength(1);
  });

  it('records the inside clue from the inside view', () => {
    const opened = openBox(shiftWith([leaker], 1)).state;
    const r = noteDefect(opened, 'leaking', 'inside');
    expect(currentNotes(r.state).map((c) => c.key)).toEqual(['inside:leaking']);
  });

  it('refuses a marker from a view that is not showing', () => {
    expect(noteDefect(shiftWith([leaker]), 'leaking', 'inside').message).toBe(
      'You are not looking at that side.',
    );
  });

  it('has nothing to note where nothing is visible', () => {
    expect(noteDefect(shiftWith([clean]), 'leaking', 'front').message).toBe('Nothing to note there.');
  });
});

describe('shipping needs a closed box', () => {
  it('refuses to ship an open box, without a strike', () => {
    const opened = openBox(shiftWith([clean, clean])).state;
    const r = stamp(opened, 'ship');
    expect(r.message).toBe('Close the box before shipping.');
    expect(r.state).toBe(opened);
  });

  it('ships once the box is closed', () => {
    const closed = closeBox(openBox(shiftWith([clean, clean])).state).state;
    expect(stamp(closed, 'ship').state.earned).toBe(20);
  });

  it('lets you reject an open box', () => {
    const opened = openBox(shiftWith([tornBox, clean])).state;
    const r = stamp(opened, 'reject');
    expect(r.state.rejected).toBe(1);
    expect(r.state.strikes).toBe(0);
  });
});
