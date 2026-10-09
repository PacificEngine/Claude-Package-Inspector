import { describe, expect, it } from 'vitest';
import { newInventory } from './shop';
import { ruleCardForDay } from './rules';
import {
  MAX_STRIKES,
  closeBox,
  discardItem,
  noteLeak,
  weighItem,
  currentNotes,
  flipBox,
  currentPackage,
  inspect,
  noteDefect,
  openBox,
  readLabel,
  packagesForDay,
  repair,
  rotateBox,
  stamp,
  startShift,
  type ShiftState,
} from './shift';
import { goodAddress, inventoryWith, makePackage } from './testing';
import type { InspectionTool, Package, PackageKind } from './types';

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
    const r = flipBox(flipBox(flipBox(shiftWith([bottomless], 3, inv)).state).state);
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
    for (let i = 0; i < 3; i++) s = flipBox(s).state; // to the bottom
    const r = repair(s, 'tape', { kind: 'defect', id: 'bottomless' });
    expect(r.message).toBe('Open the box first.');
    expect(r.state).toBe(s);
  });

  it('repairs, spends a supply, and then the package ships for pay', () => {
    const inv = inventoryWith({ tape: 1 });
    let s = shiftWith([tornBox], 2, inv);
    s = openBox(s).state;
    const r = repair(s, 'tape', { kind: 'defect', id: 'torn_tape' });
    expect(r.message).toBe('Fixed: Torn tape.');
    expect(r.state.inventory.supplies.tape).toBe(0);
    const shipped = stamp(closeBox(r.state).state, 'ship').state;
    expect(shipped.earned).toBe(20);
    expect(shipped.strikes).toBe(0);
  });

  it('refuses a tool that does not fix the target, leaving the state untouched', () => {
    const inv = inventoryWith({ foam: 1 });
    const s = openBox(shiftWith([tornBox], 2, inv)).state;
    const r = repair(s, 'foam', { kind: 'defect', id: 'torn_tape' });
    expect(r.message).toBe('That tool does not fix that.');
    expect(r.state).toBe(s);
  });

  it('leaves the state identical when a label or item repair is refused', () => {
    const s = openBox(shiftWith([tornBox], 2, inventoryWith({ relabel: 1, sealant: 1 }))).state;
    expect(repair(s, 'relabel', { kind: 'shippingLabel' }).state).toBe(s);
    expect(repair(s, 'sealant', { kind: 'item', itemId: 1 }).state).toBe(s);
  });

  it('fixes a defect inside the open box when the inside is clicked with a supply', () => {
    const p = makePackage({ id: 4, defects: ['missing_label'], fee: 20 });
    let s = shiftWith([p], 2, inventoryWith({ relabel: 1 }));
    s = inspect(s, 'look').state;
    s = openBox(s).state;
    const r = repair(s, 'relabel', { kind: 'package' });
    expect(r.message).toBe('Fixed: Missing contents label.');
    expect(r.state.handling.repaired).toEqual(['missing_label']);
    expect(r.state.inventory.supplies.relabel).toBe(0);
  });

  it('asks for a target when none is chosen', () => {
    const s = shiftWith([tornBox], 2, inventoryWith({ tape: 1 }));
    const r = repair(s, 'tape', { kind: 'package' });
    expect(r.message).toBe('Click the thing you want to fix.');
    expect(r.state).toBe(s);
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

describe('inspect with views and notes', () => {
  it('sends rotating and flipping to their tools', () => {
    const s0 = shiftWith([clean], 3, tools('rotate'));
    expect(inspect(s0, 'rotate').message).toBe('Use the Rotate or Flip tool for that.');
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
      'shape',
      'scale:none',
      'shake:rattling',
      'stethoscope:none',
    ]);
  });

  it('does not record visual clues until a marker is clicked', () => {
    const leaker = makePackage({ kind: 'can', defects: ['leaking'] });
    const s = inspect(shiftWith([leaker], 3, tools('uv')), 'uv').state;
    expect(currentNotes(s).map((c) => c.key)).toEqual(['shape']);
  });
});

describe('noteDefect', () => {
  const leaker = makePackage({ kind: 'can', defects: ['leaking'] });

  it('records a visible defect from its front marker', () => {
    const r = noteDefect(shiftWith([leaker]), 'leaking', 'front');
    expect(currentNotes(r.state).map((c) => c.key)).toEqual(['shape', 'look:leaking']);
    expect(r.message).toBe('A dark drip trails down the side.');
  });

  it('does not record the same clue twice', () => {
    const once = noteDefect(shiftWith([leaker]), 'leaking', 'front').state;
    const twice = noteDefect(once, 'leaking', 'front');
    expect(twice.message).toBe('Already noted.');
    expect(currentNotes(twice.state)).toHaveLength(2);
  });

  it('records the inside clue from the inside view', () => {
    const opened = openBox(shiftWith([leaker], 1)).state;
    const r = noteDefect(opened, 'leaking', 'inside');
    expect(currentNotes(r.state).map((c) => c.key)).toEqual(['shape', 'inside:leaking']);
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

describe('flip and rotate follow the orientation rules', () => {
  const start = (kind: PackageKind = 'box') => shiftWith([makePackage({ kind })], 3, tools('rotate'));
  const faceOf = (s: ShiftState) =>
    `${s.handling.flipped ? 'down' : 'up'}:${s.handling.face}${s.handling.upsideDown ? ' upside-down' : ''}`;
  const press = (s: ShiftState, ...moves: Array<'flip' | 'rotate'>) =>
    moves.reduce((st, m) => (m === 'flip' ? flipBox(st) : rotateBox(st)).state, s);

  it('needs the rotate tool, and the box closed', () => {
    expect(rotateBox(shiftWith([makePackage()])).message).toBe('You do not own that tool.');
    expect(flipBox(shiftWith([makePackage()])).message).toBe('You do not own that tool.');
    expect(rotateBox(openBox(start()).state).message).toBe('Close the box first.');
    expect(flipBox(openBox(start()).state).message).toBe('Close the box first.');
  });

  it('flips a box: face 1, top, upside-down face 3, bottom, face 1', () => {
    const s0 = start();
    const seen = [s0, press(s0, 'flip'), press(s0, 'flip', 'flip'), press(s0, 'flip', 'flip', 'flip'), press(s0, 'flip', 'flip', 'flip', 'flip')].map(faceOf);
    expect(seen).toEqual(['up:0', 'up:4', 'up:2 upside-down', 'down:0', 'up:0']);
  });

  it('flips a box from face 2 the same way', () => {
    const s0 = press(start(), 'rotate');
    expect(faceOf(s0)).toBe('up:1');
    expect(faceOf(press(s0, 'flip', 'flip'))).toBe('up:3 upside-down');
  });

  it('flips a cylinder: side, top, upside-down side, bottom, side', () => {
    const s0 = start('can');
    expect([s0, press(s0, 'flip'), press(s0, 'flip', 'flip'), press(s0, 'flip', 'flip', 'flip'), press(s0, 'flip', 'flip', 'flip', 'flip')].map(faceOf)).toEqual([
      'up:0',
      'up:1',
      'up:0 upside-down',
      'down:0',
      'up:0',
    ]);
  });

  it('rotating on the top changes which side comes next, and on the bottom it is reversed', () => {
    // face 1, top, rotate, flip -> upside-down face 4, flip -> bottom, rotate, flip -> face 1
    let s = start();
    s = press(s, 'flip', 'rotate');
    expect(faceOf(s)).toBe('up:4'); // still the top
    s = press(s, 'flip');
    expect(faceOf(s)).toBe('up:3 upside-down');
    s = press(s, 'flip', 'rotate');
    expect(faceOf(s)).toBe('down:0'); // still the bottom
    s = press(s, 'flip');
    expect(faceOf(s)).toBe('up:0');
  });

  it('rotating upside-down stays upside-down and shows another side', () => {
    const upside = press(start(), 'flip', 'flip');
    expect(faceOf(upside)).toBe('up:2 upside-down');
    expect(faceOf(press(upside, 'rotate'))).toBe('up:1 upside-down');
    expect(faceOf(press(upside, 'rotate', 'rotate'))).toBe('up:0 upside-down');
  });

  it('rotating on a side steps through the sides and wraps', () => {
    const s0 = start();
    expect([1, 2, 3, 4, 5].map((n) => faceOf(press(s0, ...Array<'rotate'>(n).fill('rotate'))))).toEqual([
      'up:1',
      'up:2',
      'up:3',
      'up:0',
      'up:1',
    ]);
  });

  it('records every face shown as seen', () => {
    const s = press(start(), 'flip', 'flip', 'flip');
    expect(s.handling.visited).toEqual(['up:0', 'up:4', 'up:2', 'down:0']);
  });

  it('never refuses a rotate that has nowhere new to show, and gives away no numbers', () => {
    const can = press(start('can'), 'rotate');
    expect(rotateBox(start('can')).message).toBe('You turn the package.');
    expect(flipBox(start('can')).message).toBe('You flip the package over.');
    expect(faceOf(can)).toBe('up:0');
    expect(can.handling.turn).toBe(1);
  });

  it('keeps the tetrahedron and the prism as they were', () => {
    const tetra = start('tetra');
    expect(faceOf(press(tetra, 'rotate', 'rotate'))).toBe('up:2');
    expect(faceOf(press(tetra, 'rotate', 'rotate', 'flip'))).toBe('down:2');
    expect(faceOf(press(tetra, 'flip', 'flip'))).toBe('up:0');
    const prism = start('prism');
    expect(flipBox(prism).message).toBe('This shape cannot be flipped.');
    expect(faceOf(press(prism, 'rotate', 'rotate', 'rotate'))).toBe('up:0');
  });

  it('opens and uses the tools only upright on a side', () => {
    const s0 = shiftWith([makePackage()], 3, tools('rotate', 'scale'));
    const top = press(s0, 'flip');
    expect(openBox(top).message).toBe('Turn the box upright first.');
    expect(inspect(top, 'scale').message).toBe('Close the box and turn it face up first.');
    expect(openBox(press(s0, 'flip', 'flip', 'flip', 'flip')).state.handling.opened).toBe(true);
  });

  it('reads a label whenever its side is showing, even upside-down', () => {
    const p = makePackage({ kind: 'box', labelFace: 2 });
    const s0 = shiftWith([p], 3, tools('rotate'));
    expect(readLabel(s0, 'shipping').state.handling.addressRead).toBe(true);
    expect(readLabel(press(s0, 'rotate'), 'shipping').message).toBe('That label is not on this side.');
    const upside = press(s0, 'flip', 'flip'); // side 3 (index 2) upside-down
    expect(readLabel(upside, 'contents').state.handling.contentsRead).toBe(true);
    expect(readLabel(press(s0, 'flip'), 'shipping').message).toBe('That label is not on this side.');
  });
});

describe('weighing, throwing away and leaks', () => {
  const it1 = { id: 1, name: 'teapot', art: 'teapot' as const, color: '#c05a5a', weightKg: 0.6 };
  const it2 = { id: 2, name: 'brick', art: 'book' as const, color: '#9b6a5a', weightKg: 0.8, extra: true };
  const leaky = { id: 3, name: 'jar of honey', art: 'dome' as const, color: '#e0a020', weightKg: 0.5, leaking: true };
  const pkg = makePackage({
    defects: ['wrong_weight'],
    packagingKg: 0.5,
    declaredWeightKg: 1.1,
    actualWeightKg: 1.9,
    contents: [it1, it2],
  });
  const opened = (p = pkg, inv = tools('scale')) => openBox(shiftWith([p], 4, inv)).state;

  it('weighs an item with the scale and records the reading', () => {
    const r = weighItem(opened(), 2);
    expect(r.message).toBe('The brick weighs 0.8 kg.');
    expect(currentNotes(r.state).map((c) => c.key)).toEqual(['shape', 'item:2']);
  });

  it('needs the box open, the scale, and a real item to weigh', () => {
    expect(weighItem(shiftWith([pkg], 4, tools('scale')), 1).message).toBe('Open the box first.');
    expect(weighItem(opened(pkg, tools()), 1).message).toBe('You do not own that tool.');
    expect(weighItem(opened(), 99).message).toBe('There is no such item.');
  });

  it('throws an item away for good and fixes the weight', () => {
    const r = discardItem(opened(), 2);
    expect(r.message).toBe('You throw away the brick.');
    expect(r.state.handling.discarded).toEqual([2]);
    expect(discardItem(r.state, 2).message).toBe('There is no such item.');
    expect(discardItem(shiftWith([pkg], 4, tools('scale')), 2).message).toBe('Open the box first.');
  });

  it('notes a leaking item once, and not one that is sealed or fine', () => {
    const wet = makePackage({ defects: ['wet_cardboard'], contents: [it1, leaky] });
    const s = opened(wet);
    const noted = noteLeak(s, 3);
    expect(noted.message).toBe('The jar of honey is leaking.');
    expect(currentNotes(noted.state).map((c) => c.key)).toEqual(['shape', 'leak:3']);
    expect(noteLeak(noted.state, 3).message).toBe('Already noted.');
    expect(noteLeak(s, 1).message).toBe('Nothing to note there.');
    const sealed = { ...s, handling: { ...s.handling, sealed: [3] } };
    expect(noteLeak(sealed, 3).message).toBe('Nothing to note there.');
  });

  it('updates the noted scale clues once the stowaway is thrown away', () => {
    let s = inspect(shiftWith([pkg], 4, tools('scale')), 'scale').state;
    const before = currentNotes(s);
    expect(before.map((c) => c.key)).toContain('scale:wrong_weight');
    expect(before.find((c) => c.key === 'scale:none')?.text).toBe('Scale reads 1.9 kg (label says 1.1 kg).');
    s = openBox(s).state;
    s = discardItem(s, 2).state;
    const after = currentNotes(s);
    expect(after.map((c) => c.key)).not.toContain('scale:wrong_weight');
    expect(after.find((c) => c.key === 'scale:none')?.text).toBe('Scale reads 1.1 kg (label says 1.1 kg).');
  });

  it('lets the player ship a wrong-weight package once the stowaway is gone', () => {
    let s = opened(pkg);
    s = discardItem(s, 2).state;
    s = closeBox(s).state;
    const r = stamp(s, 'ship');
    expect(r.state.strikes).toBe(0);
    expect(r.state.earned).toBe(pkg.fee);
  });
});

describe('restricted item strikes', () => {
  it('names the restricted item when a package that holds one is shipped', () => {
    const p = makePackage({
      kind: 'prism',
      packagingKg: 0.4,
      declaredWeightKg: 1,
      actualWeightKg: 1,
      contents: [{ id: 1, name: 'candles', art: 'sticks' as const, color: '#f2e2b0', weightKg: 0.6 }],
    });
    const r = stamp(shiftWith([p, p], 4), 'ship');
    expect(r.state.strikes).toBe(1);
    expect(r.message).toContain('restricted candles');
  });
});

describe('readLabel', () => {
  const box = makePackage({ kind: 'box', labelFace: 2 });
  const withRotate = (p = box) => shiftWith([p], 3, tools('rotate'));

  it('reads the shipping label face up on face 1', () => {
    const r = readLabel(withRotate(), 'shipping');
    expect(r.state.handling.addressRead).toBe(true);
    expect(r.message).toBe('You read the shipping label.');
  });

  it('cannot read the shipping label from another side', () => {
    const turned = rotateBox(withRotate()).state;
    const r = readLabel(turned, 'shipping');
    expect(r.message).toBe('That label is not on this side.');
    expect(r.state.handling.addressRead).toBe(false);
  });

  it('reads the contents label only on the face it sits on', () => {
    let s = withRotate();
    expect(readLabel(s, 'contents').message).toBe('That label is not on this side.');
    s = rotateBox(rotateBox(s).state).state; // face 3 (index 2)
    const r = readLabel(s, 'contents');
    expect(r.state.handling.contentsRead).toBe(true);
    expect(r.message).toBe('You read the contents label.');
  });

  it('finds no contents label when it is missing, and reads a reprinted one', () => {
    const unlabeled = makePackage({ kind: 'box', defects: ['missing_label'], labelFace: 0 });
    const s = shiftWith([unlabeled], 5);
    expect(readLabel(s, 'contents').message).toBe('There is no contents label.');
    const printed = { ...s, handling: { ...s.handling, repaired: ['missing_label' as const] } };
    expect(readLabel(printed, 'contents').state.handling.contentsRead).toBe(true);
  });

  it('needs the box closed', () => {
    const open = openBox(shiftWith([box, box], 3)).state;
    expect(readLabel(open, 'shipping').message).toBe('Close the box first.');
  });
});
