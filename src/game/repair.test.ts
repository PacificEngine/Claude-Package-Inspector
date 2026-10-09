import { describe, expect, it } from 'vitest';
import { newHandling } from './handling';
import { applyRepair, type RepairTarget } from './repair';
import { goodAddress, inventoryWith, makePackage } from './testing';
import type { DefectId } from './types';

const closed = newHandling();
const opened = { ...closed, opened: true };
const inspected = { ...opened, used: ['look' as const, 'rotate' as const] };
const defect = (id: DefectId): RepairTarget => ({ kind: 'defect', id });
const item = (id: number, over = {}) => ({
  id, name: `t${id}`, art: 'dome' as const, color: '#fff', weightKg: 0.3, ...over,
});

describe('applyRepair on a defect', () => {
  it('fixes only the clicked defect and spends one supply', () => {
    const pkg = makePackage({ defects: ['torn_tape', 'crushed_corner'] });
    const r = applyRepair(pkg, closed, inventoryWith({ tape: 2 }), 'tape', defect('torn_tape'));
    expect(r.ok && r.handling.repaired).toEqual(['torn_tape']);
    expect(r.ok && r.inventory.supplies.tape).toBe(1);
    expect(r.ok && r.fixed).toEqual(['Torn tape']);
  });

  it('fixes torn tape and a crushed corner without opening the box', () => {
    const pkg = makePackage({ defects: ['crushed_corner'] });
    const r = applyRepair(pkg, closed, inventoryWith({ tape: 1 }), 'tape', defect('crushed_corner'));
    expect(r.ok && r.handling.repaired).toEqual(['crushed_corner']);
  });

  it('refuses the wrong tool', () => {
    const pkg = makePackage({ defects: ['torn_tape'] });
    expect(applyRepair(pkg, closed, inventoryWith({ foam: 1 }), 'foam', defect('torn_tape'))).toEqual({
      ok: false,
      reason: 'That tool does not fix that.',
    });
  });

  it('refuses a defect that inspection has not revealed', () => {
    const pkg = makePackage({ defects: ['wrong_weight'] });
    expect(applyRepair(pkg, opened, inventoryWith({ relabel: 1 }), 'relabel', defect('wrong_weight'))).toEqual({
      ok: false,
      reason: 'That tool does not fix that.',
    });
  });

  it('refuses a defect that is already repaired', () => {
    const pkg = makePackage({ defects: ['torn_tape'] });
    const h = { ...opened, repaired: ['torn_tape' as const] };
    expect(applyRepair(pkg, h, inventoryWith({ tape: 1 }), 'tape', defect('torn_tape')).ok).toBe(false);
  });

  it('refuses a repair that needs the box open while it is closed, then fixes it open', () => {
    const pkg = makePackage({ defects: ['humming'] });
    const h = { ...closed, used: ['look' as const, 'stethoscope' as const] };
    expect(applyRepair(pkg, h, inventoryWith({ foam: 1 }), 'foam', defect('humming'))).toEqual({
      ok: false,
      reason: 'Open the box first.',
    });
    const r = applyRepair(pkg, { ...h, opened: true }, inventoryWith({ foam: 1 }), 'foam', defect('humming'));
    expect(r.ok && r.handling.repaired).toEqual(['humming']);
  });

  it('duct tape fixes a bottomless box and uses one roll', () => {
    const pkg = makePackage({ defects: ['bottomless'] });
    const r = applyRepair(pkg, inspected, inventoryWith({ tape: 2 }), 'tape', defect('bottomless'));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.handling.repaired).toEqual(['bottomless']);
    expect(r.inventory.supplies.tape).toBe(1);
    expect(r.fixed).toEqual(['No bottom']);
  });

  it('prints the contents label from what is inside when the missing label is fixed', () => {
    const p = makePackage({ defects: ['missing_label'], contents: [item(1), item(2)] });
    const r = applyRepair(p, opened, inventoryWith({ relabel: 1 }), 'relabel', defect('missing_label'));
    expect(r.ok && r.handling.repaired).toEqual(['missing_label']);
    expect(r.ok && r.handling.labelItems).toEqual([1, 2]);
  });

  it('refuses a missing label while the box is closed', () => {
    const pkg = makePackage({ defects: ['missing_label'] });
    expect(applyRepair(pkg, closed, inventoryWith({ relabel: 1 }), 'relabel', defect('missing_label'))).toEqual({
      ok: false,
      reason: 'Open the box first.',
    });
  });

  it('wet cardboard is sealed on its own, without touching leaking items', () => {
    const wet = makePackage({ defects: ['wet_cardboard'], contents: [item(1, { leaking: true })] });
    const h = { ...opened, used: ['look' as const, 'rotate' as const], visited: ['up:0', 'down:0'] };
    const r = applyRepair(wet, h, inventoryWith({ sealant: 1 }), 'sealant', defect('wet_cardboard'));
    expect(r.ok && r.handling.repaired).toEqual(['wet_cardboard']);
    expect(r.ok && r.handling.sealed).toEqual([]);
  });

  it('relabel no longer fixes wrong weight', () => {
    const p = makePackage({ defects: ['wrong_weight'], contents: [item(1)] });
    const h = { ...opened, used: ['look' as const, 'scale' as const] };
    expect(applyRepair(p, h, inventoryWith({ relabel: 1 }), 'relabel', defect('wrong_weight')).ok).toBe(false);
  });
});

describe('applyRepair on the shipping label', () => {
  const target: RepairTarget = { kind: 'shippingLabel' };
  const badAddress = { ...goodAddress, zip: '' };

  it('relabels a repairable address from the outside', () => {
    const r = applyRepair(makePackage({ address: badAddress }), closed, inventoryWith({ relabel: 1 }), 'relabel', target);
    expect(r.ok && r.handling.relabeled).toBe(true);
    expect(r.ok && r.fixed).toEqual(['address label']);
    expect(r.ok && r.inventory.supplies.relabel).toBe(0);
  });

  it('leaves a missing contents label unfixed', () => {
    const pkg = makePackage({ defects: ['missing_label'], address: badAddress });
    const r = applyRepair(pkg, closed, inventoryWith({ relabel: 1 }), 'relabel', target);
    expect(r.ok && r.handling.repaired).toEqual([]);
  });

  it('refuses a good address, a forbidden destination, and an already relabeled one', () => {
    const nothing = { ok: false, reason: 'Nothing wrong with that label.' };
    const inv = inventoryWith({ relabel: 1 });
    expect(applyRepair(makePackage(), closed, inv, 'relabel', target)).toEqual(nothing);
    const po = makePackage({ address: { ...goodAddress, street: 'PO Box 9' } });
    expect(applyRepair(po, closed, inv, 'relabel', target)).toEqual(nothing);
    const done = { ...closed, relabeled: true };
    expect(applyRepair(makePackage({ address: badAddress }), done, inv, 'relabel', target)).toEqual(nothing);
  });

  it('refuses a non-relabel tool', () => {
    expect(applyRepair(makePackage({ address: badAddress }), closed, inventoryWith({ tape: 1 }), 'tape', target)).toEqual({
      ok: false,
      reason: 'That tool does not fix that.',
    });
  });
});

describe('applyRepair on the contents label', () => {
  const target: RepairTarget = { kind: 'contentsLabel' };
  const p = makePackage({ defects: ['missing_label'], contents: [item(1), item(2)] });
  const printed = { ...opened, repaired: ['missing_label' as const], labelItems: [1, 2] };

  it('reprints when what is inside no longer matches', () => {
    const thrown = { ...printed, discarded: [2] };
    const r = applyRepair(p, thrown, inventoryWith({ relabel: 1 }), 'relabel', target);
    expect(r.ok && r.handling.labelItems).toEqual([1]);
    expect(r.ok && r.fixed).toEqual(['contents label']);
  });

  it('refuses when the label already matches, is not missing, or the box is closed', () => {
    const no = { ok: false, reason: 'That label does not need reprinting.' };
    const inv = inventoryWith({ relabel: 3 });
    expect(applyRepair(p, printed, inv, 'relabel', target)).toEqual(no);
    expect(applyRepair(makePackage({ contents: [item(1)] }), opened, inv, 'relabel', target)).toEqual(no);
    expect(applyRepair(p, { ...printed, opened: false, discarded: [2] }, inv, 'relabel', target)).toEqual(no);
  });

  it('refuses a non-relabel tool', () => {
    expect(applyRepair(p, printed, inventoryWith({ tape: 1 }), 'tape', target)).toEqual({
      ok: false,
      reason: 'That tool does not fix that.',
    });
  });
});

describe('applyRepair on an item', () => {
  const leaker = makePackage({ contents: [item(1, { leaking: true }), item(2)] });
  const target = (itemId: number): RepairTarget => ({ kind: 'item', itemId });

  it('seals one leaking item', () => {
    const r = applyRepair(leaker, opened, inventoryWith({ sealant: 1 }), 'sealant', target(1));
    expect(r.ok && r.handling.sealed).toEqual([1]);
    expect(r.ok && r.fixed).toEqual(['the leaking t1']);
    expect(r.ok && r.inventory.supplies.sealant).toBe(0);
  });

  it('refuses an item that is not leaking, already sealed, or in a closed box', () => {
    const no = { ok: false, reason: 'Nothing to fix there.' };
    const inv = inventoryWith({ sealant: 1 });
    expect(applyRepair(leaker, opened, inv, 'sealant', target(2))).toEqual(no);
    expect(applyRepair(leaker, { ...opened, sealed: [1] }, inv, 'sealant', target(1))).toEqual(no);
    expect(applyRepair(leaker, closed, inv, 'sealant', target(1))).toEqual(no);
  });

  it('refuses a tool other than sealant', () => {
    expect(applyRepair(leaker, opened, inventoryWith({ tape: 1 }), 'tape', target(1))).toEqual({
      ok: false,
      reason: 'That tool does not fix that.',
    });
  });
});

describe('refused repairs', () => {
  it('refuses a tool that is not a real supply', () => {
    const inv = inventoryWith({ tape: 1 });
    const r = applyRepair(makePackage({ defects: ['wrong_weight'] }), opened, inv, 'discard' as never, defect('wrong_weight'));
    expect(r).toEqual({ ok: false, reason: 'That tool does not fix that.' });
    expect(Object.values(inv.supplies).every(Number.isFinite)).toBe(true);
  });

  it('does not touch the inventory when refusing', () => {
    const inv = inventoryWith({ foam: 1 });
    const before = structuredClone(inv);
    applyRepair(makePackage({ defects: ['torn_tape'] }), closed, inv, 'foam', defect('torn_tape'));
    expect(inv).toEqual(before);
  });
});

describe('applyRepair on the package', () => {
  it('asks the player to click the thing to fix', () => {
    expect(applyRepair(makePackage(), closed, inventoryWith({ tape: 1 }), 'tape', { kind: 'package' })).toEqual({
      ok: false,
      reason: 'Click the thing you want to fix.',
    });
  });

  const pkgTarget: RepairTarget = { kind: 'package' };
  const seen = { ...opened, used: ['look' as const, 'rotate' as const], visited: ['up:0', 'down:0'] };

  it('inside the open box, prints a missing contents label like the defect target does', () => {
    const p = makePackage({ defects: ['missing_label'], contents: [item(1), item(2)] });
    const viaPackage = applyRepair(p, seen, inventoryWith({ relabel: 1 }), 'relabel', pkgTarget);
    expect(viaPackage).toEqual(applyRepair(p, seen, inventoryWith({ relabel: 1 }), 'relabel', defect('missing_label')));
    expect(viaPackage.ok && viaPackage.handling.repaired).toEqual(['missing_label']);
    expect(viaPackage.ok && viaPackage.handling.labelItems).toEqual([1, 2]);
    expect(viaPackage.ok && viaPackage.inventory.supplies.relabel).toBe(0);
  });

  it('inside the open box, vents a bulge with the valve', () => {
    const p = makePackage({ kind: 'can', defects: ['bulging'] });
    const r = applyRepair(p, seen, inventoryWith({ valve: 1 }), 'valve', pkgTarget);
    expect(r.ok && r.handling.repaired).toEqual(['bulging']);
    expect(r.ok && r.fixed).toEqual(['Bulging']);
  });

  it('inside the open box, seals wet cardboard with sealant', () => {
    const p = makePackage({ defects: ['wet_cardboard'] });
    const r = applyRepair(p, seen, inventoryWith({ sealant: 1 }), 'sealant', pkgTarget);
    expect(r.ok && r.handling.repaired).toEqual(['wet_cardboard']);
  });

  it('inside the open box, fixes the first revealed defect the supply repairs', () => {
    const p = makePackage({ defects: ['bottomless', 'torn_tape'] });
    const r = applyRepair(p, seen, inventoryWith({ tape: 2 }), 'tape', pkgTarget);
    expect(r.ok && r.handling.repaired).toEqual(['bottomless']);
  });

  it('inside the open box, reprints a contents label that no longer matches', () => {
    const p = makePackage({ defects: ['missing_label'], contents: [item(1), item(2)] });
    const printed = { ...seen, repaired: ['missing_label' as const], labelItems: [1, 2], discarded: [2] };
    const r = applyRepair(p, printed, inventoryWith({ relabel: 1 }), 'relabel', pkgTarget);
    expect(r.ok && r.handling.labelItems).toEqual([1]);
    expect(r.ok && r.fixed).toEqual(['contents label']);
  });

  it('inside the open box, says there is nothing to fix when the supply reaches nothing', () => {
    const no = { ok: false, reason: 'Nothing to fix there.' };
    const p = makePackage({ defects: ['missing_label'], contents: [item(1)] });
    const printed = { ...seen, repaired: ['missing_label' as const], labelItems: [1] };
    expect(applyRepair(p, printed, inventoryWith({ relabel: 1 }), 'relabel', pkgTarget)).toEqual(no);
    expect(applyRepair(makePackage({ defects: ['torn_tape'] }), seen, inventoryWith({ tape: 1 }), 'tape', pkgTarget)).toEqual(no);
    expect(applyRepair(makePackage(), seen, inventoryWith({ foam: 1 }), 'foam', pkgTarget)).toEqual(no);
  });

  it('with the box closed, still asks for the thing to fix', () => {
    const p = makePackage({ defects: ['missing_label'] });
    const h = { ...seen, opened: false };
    expect(applyRepair(p, h, inventoryWith({ relabel: 1 }), 'relabel', pkgTarget)).toEqual({
      ok: false,
      reason: 'Click the thing you want to fix.',
    });
  });

  it('reports out of supplies before anything else', () => {
    const pkg = makePackage({ defects: ['humming'] });
    expect(applyRepair(pkg, closed, inventoryWith(), 'foam', { kind: 'package' })).toEqual({
      ok: false,
      reason: 'You are out of that supply.',
    });
  });
});
