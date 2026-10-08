import { describe, expect, it } from 'vitest';
import { newHandling } from './handling';
import {
  CLUE_CHANNEL,
  cluesFor,
  insideCluesFor,
  markerClues,
  notedClues,
  revealedDefects,
  visibleDefects,
} from './inspection';
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

describe('clue channels and keys', () => {
  it('tags clues with a key, source and channel', () => {
    const torn = cluesFor(makePackage({ defects: ['torn_tape'] }), 'look')[0];
    expect(torn).toMatchObject({ key: 'look:torn_tape', source: 'look', channel: 'visual' });
    expect(cluesFor(makePackage({ defects: ['rattling'] }), 'shake')[0]).toMatchObject({
      key: 'shake:rattling',
      channel: 'sound',
    });
    expect(cluesFor(makePackage(), 'scale')[0]).toMatchObject({ key: 'scale:none', channel: 'reading' });
  });

  it('assigns each tool to a channel', () => {
    expect(CLUE_CHANNEL).toEqual({
      look: 'visual',
      rotate: 'visual',
      uv: 'visual',
      pebble: 'visual',
      scale: 'reading',
      shake: 'sound',
      stethoscope: 'sound',
    });
  });
});

describe('inside clues', () => {
  it('lists a clue for each unrepaired defect that shows inside', () => {
    const pkg = makePackage({ defects: ['bottomless', 'torn_tape'] });
    expect(insideCluesFor(pkg)).toEqual([
      {
        key: 'inside:bottomless',
        source: 'inside',
        defect: 'bottomless',
        channel: 'visual',
        text: 'Inside there is only a black void where the floor should be.',
      },
    ]);
    expect(insideCluesFor(pkg, ['bottomless'])).toEqual([]);
  });

  it('reveals inside defects only while the box is open', () => {
    const pkg = makePackage({ defects: ['humming'] });
    expect(revealedDefects(pkg, newHandling())).toEqual([]);
    expect(revealedDefects(pkg, { ...newHandling(), opened: true })).toEqual(['humming']);
  });
});

describe('visibleDefects', () => {
  const pkg = makePackage({ defects: ['torn_tape', 'bottomless', 'tiny_weather'] });

  it('front shows what look, UV and the pebble reveal', () => {
    expect(visibleDefects(pkg, newHandling(), 'front')).toEqual(['torn_tape']);
    expect(visibleDefects(pkg, { ...newHandling(), used: ['look', 'uv'] }, 'front')).toEqual([
      'torn_tape',
      'tiny_weather',
    ]);
    expect(visibleDefects(pkg, { ...newHandling(), used: ['look', 'pebble'] }, 'front')).toEqual([
      'torn_tape',
      'bottomless',
    ]);
  });

  it('back shows what flipping revealed', () => {
    expect(visibleDefects(pkg, newHandling(), 'back')).toEqual([]);
    expect(visibleDefects(pkg, { ...newHandling(), used: ['look', 'rotate'] }, 'back')).toEqual([
      'bottomless',
    ]);
  });

  it('inside shows every unrepaired inside defect, and hides repaired ones', () => {
    expect(visibleDefects(pkg, newHandling(), 'inside')).toEqual(['bottomless', 'tiny_weather']);
    expect(
      visibleDefects(pkg, { ...newHandling(), repaired: ['bottomless'] }, 'inside'),
    ).toEqual(['tiny_weather']);
  });
});

describe('markerClues and notedClues', () => {
  const pkg = makePackage({ kind: 'can', defects: ['leaking', 'rattling'] });

  it('a front marker yields the visual clues of its defect from the tools used', () => {
    const h = { ...newHandling(), used: ['look' as const, 'uv' as const] };
    expect(markerClues(pkg, h, 'leaking', 'front').map((c) => c.key)).toEqual([
      'look:leaking',
      'uv:leaking',
    ]);
  });

  it('an inside marker yields the inside clue', () => {
    expect(markerClues(pkg, newHandling(), 'leaking', 'inside').map((c) => c.key)).toEqual([
      'inside:leaking',
    ]);
  });

  it('lists only the noted clues, in the order they were noted', () => {
    const h = {
      ...newHandling(),
      used: ['look' as const, 'shake' as const],
      notes: ['shake:rattling', 'look:leaking'],
    };
    expect(notedClues(pkg, h).map((c) => c.key)).toEqual(['shake:rattling', 'look:leaking']);
  });

  it('drops notes for repaired defects and for unknown keys', () => {
    const h = {
      ...newHandling(),
      notes: ['look:leaking', 'bogus:key'],
      repaired: ['leaking' as const],
    };
    expect(notedClues(pkg, h)).toEqual([]);
  });
});
