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
    // The missing label is seen from outside with the look tool, but only fixed with the box open.
    const pkg = makePackage({ defects: ['missing_label'] });
    expect(applyRepair(pkg, closed, inventoryWith({ relabel: 1 }), 'relabel')).toEqual({
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

describe('items and labels', () => {
  const open = { ...newHandling(), opened: true };
  const item = (id: number, over = {}) => ({
    id, name: `t${id}`, art: 'dome' as const, color: '#fff', weightKg: 0.3, ...over,
  });

  it('seals one leaking item per sealant, then fixes the cardboard', () => {
    const wet = makePackage({
      defects: ['wet_cardboard'],
      contents: [item(1, { leaking: true }), item(2, { leaking: true })],
    });
    const h = { ...open, used: ['look' as const, 'rotate' as const], visited: ['up:0', 'down:0'] };
    const inv = inventoryWith({ sealant: 3 });
    const first = applyRepair(wet, h, inv, 'sealant');
    expect(first.ok && first.handling.sealed).toEqual([1]);
    expect(first.ok && first.handling.repaired).toEqual([]);
    expect(first.ok && first.fixed).toEqual(['the leaking t1']);
    const second = applyRepair(wet, first.ok ? first.handling : h, first.ok ? first.inventory : inv, 'sealant');
    expect(second.ok && second.handling.sealed).toEqual([1, 2]);
    const third = applyRepair(wet, second.ok ? second.handling : h, second.ok ? second.inventory : inv, 'sealant');
    expect(third.ok && third.handling.repaired).toEqual(['wet_cardboard']);
    expect(third.ok && third.inventory.supplies.sealant).toBe(0);
  });

  it('fixes soggy cardboard with a single sealant when nothing inside leaks', () => {
    const wet = makePackage({ defects: ['wet_cardboard'], contents: [item(1)] });
    const h = { ...open, used: ['look' as const, 'rotate' as const], visited: ['up:0', 'down:0'] };
    const r = applyRepair(wet, h, inventoryWith({ sealant: 1 }), 'sealant');
    expect(r.ok && r.handling.repaired).toEqual(['wet_cardboard']);
  });

  it('prints the contents label from what is inside, and reprints it when it no longer matches', () => {
    const p = makePackage({ defects: ['missing_label'], contents: [item(1), item(2)] });
    const inv = inventoryWith({ relabel: 2 });
    const first = applyRepair(p, open, inv, 'relabel');
    expect(first.ok && first.handling.repaired).toEqual(['missing_label']);
    expect(first.ok && first.handling.labelItems).toEqual([1, 2]);
    const thrown = { ...(first.ok ? first.handling : open), discarded: [2] };
    const again = applyRepair(p, thrown, first.ok ? first.inventory : inv, 'relabel');
    expect(again.ok && again.handling.labelItems).toEqual([1]);
    expect(again.ok && again.fixed).toEqual(['contents label']);
  });

  it('no longer fixes wrong weight with the relabel kit', () => {
    const p = makePackage({ defects: ['wrong_weight'], contents: [item(1)] });
    const h = { ...open, used: ['look' as const, 'scale' as const] };
    const r = applyRepair(p, h, inventoryWith({ relabel: 1 }), 'relabel');
    expect(r.ok && r.fixed).toEqual([]);
  });

  it('refuses sealant on a closed box with a leaking item and wet cardboard, spending nothing', () => {
    const wet = makePackage({ defects: ['wet_cardboard'], contents: [item(1, { leaking: true })] });
    const h = { ...closed, used: ['look' as const, 'rotate' as const], visited: ['up:0', 'down:0'] };
    expect(applyRepair(wet, h, inventoryWith({ sealant: 1 }), 'sealant')).toEqual({
      ok: false,
      reason: 'Open the box first.',
    });
  });

  it('seals a leaking item in an open box even without wet cardboard', () => {
    const p = makePackage({ contents: [item(1, { leaking: true })] });
    const r = applyRepair(p, open, inventoryWith({ sealant: 1 }), 'sealant');
    expect(r.ok && r.handling.sealed).toEqual([1]);
    expect(r.ok && r.inventory.supplies.sealant).toBe(0);
  });

  it('reports nothing fixed when relabeling a contents label that already matches', () => {
    const p = makePackage({ defects: ['missing_label'], contents: [item(1)] });
    const printed = { ...open, repaired: ['missing_label' as const], labelItems: [1] };
    const r = applyRepair(p, printed, inventoryWith({ relabel: 1 }), 'relabel');
    expect(r.ok && r.fixed).toEqual([]);
    expect(r.ok && r.handling).toEqual(printed);
  });
});
