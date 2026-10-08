import { describe, expect, it } from 'vitest';
import { newHandling } from './handling';
import { cluesFor, revealedDefects } from './inspection';
import { makePackage } from './testing';

describe('cluesFor', () => {
  it('shows a bottomless box failing the pebble test', () => {
    const clues = cluesFor(makePackage({ defects: ['bottomless'] }), 'pebble');
    expect(clues.map((c) => c.text).join(' ')).toMatch(/never lands/);
    expect(clues[0].defect).toBe('bottomless');
  });

  it('reports a quiet result on a clean package', () => {
    const clues = cluesFor(makePackage(), 'pebble');
    expect(clues).toHaveLength(1);
    expect(clues[0].defect).toBeNull();
    expect(clues[0].text).toMatch(/plink/);
  });

  it('always reports the scale numbers', () => {
    const pkg = makePackage({ declaredWeightKg: 2, actualWeightKg: 2.9, defects: ['wrong_weight'] });
    const text = cluesFor(pkg, 'scale').map((c) => c.text);
    expect(text[0]).toBe('Scale reads 2.9 kg (label says 2 kg).');
    expect(text).toContain('The scale disagrees with the label.');
  });

  it('only reports what that tool can reveal', () => {
    const pkg = makePackage({ kind: 'can', defects: ['leaking'] });
    expect(cluesFor(pkg, 'look')[0].defect).toBe('leaking');
    expect(cluesFor(pkg, 'shake')[0].defect).toBeNull();
  });

  it('stops reporting a defect once it is repaired', () => {
    const pkg = makePackage({ kind: 'can', defects: ['leaking'] });
    const clues = cluesFor(pkg, 'look', ['leaking']);
    expect(clues).toHaveLength(1);
    expect(clues[0].defect).toBeNull();
  });
});

describe('revealedDefects', () => {
  it('reveals defects visible to tools already used', () => {
    const pkg = makePackage({ defects: ['torn_tape', 'bottomless'] });
    expect(revealedDefects(pkg, newHandling())).toEqual(['torn_tape']);
    expect(revealedDefects(pkg, { ...newHandling(), used: ['look', 'rotate'] })).toEqual([
      'torn_tape',
      'bottomless',
    ]);
  });

  it('hides repaired defects', () => {
    const pkg = makePackage({ defects: ['torn_tape'] });
    expect(revealedDefects(pkg, { ...newHandling(), repaired: ['torn_tape'] })).toEqual([]);
  });
});
