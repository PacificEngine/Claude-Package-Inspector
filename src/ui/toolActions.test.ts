import { describe, expect, it } from 'vitest';
import { openBox, startShift, type ShiftState } from '../game/shift';
import { inventoryWith, makePackage } from '../game/testing';
import type { Package } from '../game/types';
import {
  animationFor,
  canTarget,
  isOneShot,
  isSupply,
  leakTarget,
  ownedTools,
  putDownAfter,
  toolLabel,
  toggleTool,
  toolName,
  useTool,
  TOOL_ORDER,
  type ToolId,
  type UseTarget,
} from './toolActions';

const shiftWith = (queue: Package[], inv = inventoryWith({}, ['look', 'rotate', 'scale', 'shake'])): ShiftState => ({
  ...startShift(1, inv, 1),
  queue,
  index: 0,
});

const pkg = (target: UseTarget['kind']): UseTarget =>
  target === 'defect' ? { kind: 'defect', id: 'torn_tape' } : target === 'item' ? { kind: 'item', itemId: 1 } : ({ kind: target } as UseTarget);

describe('tool catalogue', () => {
  it('orders and names tools', () => {
    expect(TOOL_ORDER).toEqual([
      'scale', 'shake', 'uv', 'pebble', 'stethoscope', 'rotateTool', 'flipTool',
      'tape', 'sealant', 'relabel', 'valve', 'foam',
    ]);
    expect(TOOL_ORDER.map(toolName)).toEqual([
      'Scale', 'Shake', 'UV light', 'Drop-test pebble', 'Stethoscope', 'Rotate', 'Flip',
      'Duct tape', 'Sealant', 'Relabel kit', 'Pressure valve', 'Soundproof foam',
    ]);
  });

  it('lists owned tools and stocked supplies, never look', () => {
    const inv = inventoryWith({ tape: 2, foam: 0 }, ['look', 'rotate', 'scale']);
    expect(ownedTools(inv)).toEqual(['scale', 'rotateTool', 'flipTool', 'tape']);
  });

  it('classifies tools', () => {
    expect(isSupply('tape')).toBe(true);
    expect(isSupply('scale')).toBe(false);
    for (const t of ['scale', 'shake', 'uv', 'pebble', 'stethoscope'] as ToolId[]) expect(isOneShot(t)).toBe(true);
    expect(isOneShot('rotateTool')).toBe(false);
    expect(isOneShot('tape')).toBe(false);
  });

  it('labels supplies with how many are left', () => {
    const inv = inventoryWith({ tape: 3 }, ['look', 'scale']);
    expect(toolLabel('tape', inv)).toBe('Duct tape, 3 left');
    expect(toolLabel('scale', inv)).toBe('Scale');
    expect(toolLabel('flipTool', inv)).toBe('Flip');
  });

  it('toggles selection', () => {
    expect(toggleTool(null, 'scale')).toBe('scale');
    expect(toggleTool('scale', 'scale')).toBeNull();
    expect(toggleTool('scale', 'shake')).toBe('shake');
  });
});

describe('canTarget', () => {
  const overlays: UseTarget['kind'][] = ['package', 'defect', 'shippingLabel', 'contentsLabel'];
  it('lets inspection and handling tools act on the package and overlays', () => {
    for (const t of ['scale', 'shake', 'uv', 'pebble', 'stethoscope', 'rotateTool', 'flipTool'] as ToolId[])
      for (const k of overlays) expect(canTarget(t, pkg(k))).toBe(true);
  });
  it('lets only the scale act on items', () => {
    expect(canTarget('scale', pkg('item'))).toBe(true);
    expect(canTarget('shake', pkg('item'))).toBe(false);
    expect(canTarget('rotateTool', pkg('item'))).toBe(false);
  });
  it('restricts supplies', () => {
    expect(canTarget('tape', pkg('defect'))).toBe(true);
    expect(canTarget('tape', pkg('package'))).toBe(false);
    expect(canTarget('tape', pkg('shippingLabel'))).toBe(false);
    expect(canTarget('relabel', pkg('shippingLabel'))).toBe(true);
    expect(canTarget('relabel', pkg('contentsLabel'))).toBe(true);
    expect(canTarget('sealant', pkg('item'))).toBe(true);
    expect(canTarget('foam', pkg('item'))).toBe(false);
    expect(canTarget('relabel', pkg('item'))).toBe(false);
  });
  const supplies: ToolId[] = ['tape', 'sealant', 'relabel', 'valve', 'foam'];
  it('lets every supply aim at any defect, only relabel at labels, only sealant at items', () => {
    for (const t of supplies) {
      expect(canTarget(t, pkg('defect'))).toBe(true);
      expect(canTarget(t, pkg('shippingLabel'))).toBe(t === 'relabel');
      expect(canTarget(t, pkg('contentsLabel'))).toBe(t === 'relabel');
      expect(canTarget(t, pkg('item'))).toBe(t === 'sealant');
    }
  });
  it('lets every supply aim at the inside of the open box, not the closed box', () => {
    for (const t of supplies) {
      expect(canTarget(t, pkg('package'), true)).toBe(true);
      expect(canTarget(t, pkg('package'), false)).toBe(false);
    }
  });
});

describe('leakTarget', () => {
  it('keeps the item for the scale and supplies, else acts on the package', () => {
    expect(leakTarget('scale', 3)).toEqual({ kind: 'item', itemId: 3 });
    expect(leakTarget('sealant', 3)).toEqual({ kind: 'item', itemId: 3 });
    expect(leakTarget('tape', 3)).toEqual({ kind: 'item', itemId: 3 });
    for (const t of ['shake', 'uv', 'pebble', 'stethoscope', 'rotateTool', 'flipTool'] as ToolId[])
      expect(leakTarget(t, 3)).toEqual({ kind: 'package' });
  });
});

describe('putDownAfter', () => {
  it('puts an inspection tool down only after it acted on the package', () => {
    expect(putDownAfter('scale', { kind: 'package' }, true)).toBe(true);
    expect(putDownAfter('shake', { kind: 'defect', id: 'torn_tape' }, true)).toBe(true);
    expect(putDownAfter('scale', { kind: 'package' }, false)).toBe(false);
  });
  it('keeps the scale in hand after weighing an item', () => {
    expect(putDownAfter('scale', { kind: 'item', itemId: 1 }, true)).toBe(false);
  });
  it('keeps handling tools and supplies in hand', () => {
    expect(putDownAfter('rotateTool', { kind: 'package' }, true)).toBe(false);
    expect(putDownAfter('tape', { kind: 'defect', id: 'torn_tape' }, true)).toBe(false);
  });
});

describe('useTool', () => {
  it('reads the scale on the package', () => {
    const r = useTool(shiftWith([makePackage()]), 'scale', { kind: 'package' });
    expect(r.state.handling.used).toContain('scale');
  });

  it('treats overlay targets as the package for inspection tools', () => {
    const r = useTool(shiftWith([makePackage()]), 'scale', { kind: 'defect', id: 'torn_tape' });
    expect(r.state.handling.used).toContain('scale');
  });

  it('weighs an item with the box open', () => {
    const brick = { id: 2, name: 'brick', art: 'dome' as const, color: '#fff', weightKg: 0.8 };
    const s = openBox(shiftWith([makePackage({ contents: [brick] })])).state;
    const r = useTool(s, 'scale', { kind: 'item', itemId: 2 });
    expect(r.state.handling.notes).toContain('item:2');
  });

  it('sends a non-scale inspection tool on an item back to the package', () => {
    const s = shiftWith([makePackage()]);
    const r = useTool(s, 'shake', { kind: 'item', itemId: 1 });
    expect(r.message).toBe('Use that on the package.');
    expect(r.state).toBe(s);
    expect(useTool(s, 'rotateTool', { kind: 'item', itemId: 1 }).message).toBe('Use that on the package.');
  });

  it('treats label and defect targets as the package for shake, rotate and flip', () => {
    const s = shiftWith([makePackage()]);
    for (const target of [pkg('shippingLabel'), pkg('contentsLabel'), pkg('defect')]) {
      expect(useTool(s, 'shake', target).state.handling.used).toContain('shake');
      expect(useTool(s, 'rotateTool', target).state.handling.turn).toBe(1);
      expect(useTool(s, 'flipTool', target).state.handling.flipPos).toBe(1);
    }
  });

  it('sends flip on an item back to the package', () => {
    const s = shiftWith([makePackage()]);
    const r = useTool(s, 'flipTool', { kind: 'item', itemId: 1 });
    expect(r.message).toBe('Use that on the package.');
    expect(r.state).toBe(s);
  });

  it('fixes what the supply reaches when the inside of the open box is clicked', () => {
    const p = makePackage({ defects: ['missing_label'] });
    const s = openBox(shiftWith([p], inventoryWith({ relabel: 1 }, ['look']))).state;
    const r = useTool(s, 'relabel', { kind: 'package' });
    expect(r.state.handling.repaired).toEqual(['missing_label']);
  });

  it('rotates and flips', () => {
    const s = shiftWith([makePackage()]);
    expect(useTool(s, 'rotateTool', { kind: 'package' }).state.handling.turn).toBe(1);
    expect(useTool(s, 'flipTool', { kind: 'package' }).state.handling.flipPos).toBe(1);
  });

  it('asks for a target when a supply is used on the package', () => {
    const s = shiftWith([makePackage()], inventoryWith({ tape: 1 }));
    const r = useTool(s, 'tape', { kind: 'package' });
    expect(r.message).toBe('Click the thing you want to fix.');
    expect(r.state).toBe(s);
  });

  it('repairs a revealed defect with a supply', () => {
    const p = makePackage({ defects: ['torn_tape'] });
    const s = openBox(shiftWith([p], inventoryWith({ tape: 1 }, ['look', 'rotate']))).state;
    const r = useTool(s, 'tape', { kind: 'defect', id: 'torn_tape' });
    expect(r.state.handling.repaired).toEqual(['torn_tape']);
    expect(r.state.inventory.supplies.tape).toBe(0);
  });
});

describe('animationFor', () => {
  it('plays the inspection animation when an inspection tool is used on the package', () => {
    expect(animationFor('scale', { kind: 'package' })).toBe('scale');
    expect(animationFor('stethoscope', { kind: 'package' })).toBe('stethoscope');
  });

  it('plays nothing for weighing an item, rotating or flipping', () => {
    expect(animationFor('scale', { kind: 'item', itemId: 1 })).toBeUndefined();
    expect(animationFor('rotateTool', { kind: 'package' })).toBeUndefined();
    expect(animationFor('flipTool', { kind: 'package' })).toBeUndefined();
  });

  it('plays the repair animation for supplies', () => {
    expect(animationFor('tape', { kind: 'defect', id: 'torn_tape' })).toBe('repair');
  });
});
