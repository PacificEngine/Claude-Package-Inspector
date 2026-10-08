import { describe, expect, it } from 'vitest';
import { newHandling } from './handling';
import { applyRepair } from './repair';
import { goodAddress, inventoryWith, makePackage } from './testing';

const opened = { ...newHandling(), opened: true };
const inspected = { ...opened, used: ['look' as const, 'rotate' as const] };

describe('applyRepair', () => {
  it('requires the box to be opened first', () => {
    const r = applyRepair(makePackage({ defects: ['torn_tape'] }), newHandling(), inventoryWith({ tape: 1 }), 'tape');
    expect(r).toEqual({ ok: false, reason: 'Open the box first.' });
  });

  it('requires supplies', () => {
    const r = applyRepair(makePackage({ defects: ['torn_tape'] }), opened, inventoryWith(), 'tape');
    expect(r).toEqual({ ok: false, reason: 'You are out of that supply.' });
  });

  it('duct tape fixes a bottomless box and uses one roll', () => {
    const pkg = makePackage({ defects: ['bottomless'] });
    const r = applyRepair(pkg, inspected, inventoryWith({ tape: 2 }), 'tape');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.handling.repaired).toEqual(['bottomless']);
    expect(r.inventory.supplies.tape).toBe(1);
    expect(r.fixed).toEqual(['No bottom']);
  });

  it('does not fix a defect that inspection has not revealed, but still uses the supply', () => {
    const pkg = makePackage({ defects: ['bottomless'] });
    const r = applyRepair(pkg, opened, inventoryWith({ tape: 1 }), 'tape');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.handling.repaired).toEqual([]);
    expect(r.inventory.supplies.tape).toBe(0);
    expect(r.fixed).toEqual([]);
  });

  it('wasting the wrong tool fixes nothing but still uses the supply', () => {
    const pkg = makePackage({ defects: ['bottomless'] });
    const r = applyRepair(pkg, opened, inventoryWith({ foam: 1 }), 'foam');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.handling.repaired).toEqual([]);
    expect(r.inventory.supplies.foam).toBe(0);
    expect(r.fixed).toEqual([]);
  });

  it('does not repeat a defect that is already repaired', () => {
    const pkg = makePackage({ defects: ['torn_tape'] });
    const h = { ...opened, repaired: ['torn_tape' as const] };
    const r = applyRepair(pkg, h, inventoryWith({ tape: 1 }), 'tape');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.handling.repaired).toEqual(['torn_tape']);
  });

  it('relabel fixes a missing label and a malformed address together', () => {
    const pkg = makePackage({ defects: ['missing_label'], address: { ...goodAddress, zip: '' } });
    const r = applyRepair(pkg, opened, inventoryWith({ relabel: 1 }), 'relabel');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.handling.repaired).toEqual(['missing_label']);
    expect(r.handling.relabeled).toBe(true);
    expect(r.fixed).toEqual(['Missing contents label', 'address label']);
  });

  it('relabel does not mark a good address as relabeled', () => {
    const r = applyRepair(makePackage(), opened, inventoryWith({ relabel: 1 }), 'relabel');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.handling.relabeled).toBe(false);
  });

  it('relabel does not make a forbidden destination relabeled', () => {
    const pkg = makePackage({ address: { ...goodAddress, street: 'PO Box 9' } });
    const r = applyRepair(pkg, opened, inventoryWith({ relabel: 1 }), 'relabel');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.handling.relabeled).toBe(false);
  });
});
