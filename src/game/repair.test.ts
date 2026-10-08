import { describe, expect, it } from 'vitest';
import { newHandling } from './handling';
import { applyRepair } from './repair';
import { goodAddress, inventoryWith, makePackage } from './testing';

const opened = { ...newHandling(), opened: true };
const inspected = { ...opened, used: ['look' as const, 'rotate' as const] };
const closed = newHandling();

describe('applyRepair', () => {
  it('refuses a repair that needs the box open while it is closed', () => {
    const pkg = makePackage({ defects: ['humming'] });
    const stethoscoped = { ...closed, used: ['look' as const, 'stethoscope' as const] };
    expect(applyRepair(pkg, stethoscoped, inventoryWith({ foam: 1 }), 'foam')).toEqual({
      ok: false,
      reason: 'Open the box first.',
    });
  });

  it('fixes torn tape without opening the box', () => {
    const pkg = makePackage({ defects: ['torn_tape'] });
    const r = applyRepair(pkg, closed, inventoryWith({ tape: 1 }), 'tape');
    expect(r.ok && r.handling.repaired).toEqual(['torn_tape']);
    expect(r.ok && r.inventory.supplies.tape).toBe(0);
  });

  it('fixes a crushed corner without opening the box', () => {
    const pkg = makePackage({ defects: ['crushed_corner'] });
    const r = applyRepair(pkg, closed, inventoryWith({ tape: 1 }), 'tape');
    expect(r.ok && r.handling.repaired).toEqual(['crushed_corner']);
  });

  it('relabels an address from the outside but leaves a missing contents label unfixed', () => {
    const badAddress = { ...goodAddress, zip: '' };
    const addressOnly = applyRepair(makePackage({ address: badAddress }), closed, inventoryWith({ relabel: 1 }), 'relabel');
    expect(addressOnly.ok && addressOnly.handling.relabeled).toBe(true);
    const labelToo = applyRepair(
      makePackage({ defects: ['missing_label'], address: badAddress }),
      closed,
      inventoryWith({ relabel: 1 }),
      'relabel',
    );
    expect(labelToo.ok && labelToo.handling.relabeled).toBe(true);
    expect(labelToo.ok && labelToo.handling.repaired).toEqual([]);
    expect(labelToo.ok && labelToo.fixed).toEqual(['address label']);
  });

  it('relabels a bad address on a closed box even when a revealed allowed defect needs opening', () => {
    const pkg = makePackage({
      defects: ['wrong_weight'],
      address: { ...goodAddress, street: '???? Elm Street' },
    });
    const scaled = { ...closed, used: ['look' as const, 'scale' as const] };
    const r = applyRepair(pkg, scaled, inventoryWith({ relabel: 1 }), 'relabel');
    expect(r.ok && r.handling.relabeled).toBe(true);
    expect(r.ok && r.handling.repaired).not.toContain('wrong_weight');
  });

  it('refuses a closed tool that fixes nothing outside while a revealed defect needs opening, spending nothing', () => {
    const pkg = makePackage({ defects: ['wrong_weight'] });
    const scaled = { ...closed, used: ['look' as const, 'scale' as const] };
    expect(applyRepair(pkg, scaled, inventoryWith({ relabel: 1 }), 'relabel')).toEqual({
      ok: false,
      reason: 'Open the box first.',
    });
  });

  it('still wastes a supply on a tool that would fix nothing, open or closed', () => {
    const r = applyRepair(makePackage(), closed, inventoryWith({ foam: 1 }), 'foam');
    expect(r.ok && r.fixed).toEqual([]);
    expect(r.ok && r.inventory.supplies.foam).toBe(0);
  });

  it('reports out of supplies before anything else', () => {
    const pkg = makePackage({ defects: ['humming'] });
    expect(applyRepair(pkg, closed, inventoryWith(), 'foam')).toEqual({
      ok: false,
      reason: 'You are out of that supply.',
    });
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
    const pkg = makePackage({ defects: ['wrong_weight'] });
    const r = applyRepair(pkg, opened, inventoryWith({ relabel: 1 }), 'relabel');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.handling.repaired).toEqual([]);
    expect(r.inventory.supplies.relabel).toBe(0);
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
