import { describe, expect, it } from 'vitest';
import { newHandling } from './handling';
import {
  CLUE_CHANNEL,
  cluesFor,
  insideCluesFor,
  itemCluesFor,
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
    expect(revealedDefects(pkg, { ...newHandling(), visited: ['up:0', 'down:0'], used: ['look', 'rotate'] })).toEqual([
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

  it('a UV-only glow shows on every up face, since it has no face', () => {
    const glowing = makePackage({ kind: 'box', defects: ['scorching'] });
    for (const face of [0, 1, 2]) {
      const h = { ...newHandling(), face, used: ['look' as const, 'uv' as const] };
      expect(visibleDefects(glowing, h, 'front')).toEqual(['scorching']);
    }
  });

  it('a surface defect on another face is still hidden', () => {
    const torn = makePackage({
      kind: 'box',
      defects: ['torn_tape'],
      placements: { torn_tape: { side: 'up', face: 2 } },
    });
    expect(visibleDefects(torn, { ...newHandling(), face: 2 }, 'front')).toEqual(['torn_tape']);
    expect(visibleDefects(torn, { ...newHandling(), face: 0 }, 'front')).toEqual([]);
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

describe('faces', () => {
  const torn = makePackage({
    defects: ['torn_tape'],
    placements: { torn_tape: { side: 'up', face: 2 } },
  });

  it('shows a defect only on the face it sits on', () => {
    expect(visibleDefects(torn, newHandling(), 'front')).toEqual([]);
    expect(visibleDefects(torn, { ...newHandling(), face: 2 }, 'front')).toEqual(['torn_tape']);
    expect(visibleDefects(torn, { ...newHandling(), face: 1 }, 'front')).toEqual([]);
  });

  it('treats a defect as revealed only once its face has been shown', () => {
    expect(revealedDefects(torn, newHandling())).toEqual([]);
    expect(revealedDefects(torn, { ...newHandling(), visited: ['up:0', 'up:2'] })).toEqual(['torn_tape']);
  });

  it('shows an underside defect on the down side face it sits on', () => {
    const wet = makePackage({
      kind: 'tetra',
      defects: ['wet_cardboard'],
      placements: { wet_cardboard: { side: 'down', face: 3 } },
    });
    const flipped = { ...newHandling(), flipped: true, used: ['look' as const, 'rotate' as const] };
    expect(visibleDefects(wet, { ...flipped, face: 0 }, 'back')).toEqual([]);
    expect(visibleDefects(wet, { ...flipped, face: 3 }, 'back')).toEqual(['wet_cardboard']);
    expect(revealedDefects(wet, flipped)).toEqual([]);
    expect(revealedDefects(wet, { ...flipped, visited: ['up:0', 'down:3'] })).toEqual(['wet_cardboard']);
  });

  it('lets the pebble show a bottomless defect on any up face', () => {
    const pkg = makePackage({ defects: ['bottomless'] });
    const h = { ...newHandling(), used: ['look' as const, 'pebble' as const], face: 3 };
    expect(visibleDefects(pkg, h, 'front')).toEqual(['bottomless']);
  });

  it('does not let markers record a defect that is not on the showing face', () => {
    expect(markerClues(torn, newHandling(), 'torn_tape', 'front')).toEqual([]);
    expect(markerClues(torn, { ...newHandling(), face: 2 }, 'torn_tape', 'front').map((c) => c.key)).toEqual([
      'look:torn_tape',
    ]);
  });

  it('records the shape as the first note', () => {
    const notes = notedClues(makePackage({ kind: 'prism' }), newHandling());
    expect(notes).toEqual([
      {
        key: 'shape',
        source: 'shape',
        defect: null,
        channel: 'reading',
        text: 'Shape: triangular prism. Three sides to rotate; it cannot be flipped.',
      },
    ]);
  });
});

describe('item clues', () => {
  const p = makePackage({
    packagingKg: 0.5,
    declaredWeightKg: 0.9,
    actualWeightKg: 0.9,
    contents: [
      { id: 1, name: 'teapot', art: 'teapot', color: '#c05a5a', weightKg: 0.4, leaking: true },
      { id: 2, name: 'brick', art: 'book', color: '#9b6a5a', weightKg: 0, extra: true },
    ],
  });

  it('describes each remaining item and each unsealed leak', () => {
    expect(itemCluesFor(p, newHandling()).map((c) => [c.key, c.text])).toEqual([
      ['item:1', 'The teapot weighs 0.4 kg.'],
      ['leak:1', 'The teapot is leaking.'],
      ['item:2', 'The brick weighs 0 kg.'],
    ]);
  });

  it('drops thrown-away items and sealed leaks', () => {
    const h = { ...newHandling(), discarded: [2], sealed: [1] };
    expect(itemCluesFor(p, h).map((c) => c.key)).toEqual(['item:1']);
  });

  it('keeps recorded item notes in the notes list and drops them when the item is thrown away', () => {
    const h = { ...newHandling(), notes: ['shape', 'item:2', 'leak:1'] };
    expect(notedClues(p, h).map((c) => c.key)).toEqual(['shape', 'item:2', 'leak:1']);
    expect(notedClues(p, { ...h, discarded: [2] }).map((c) => c.key)).toEqual(['shape', 'leak:1']);
  });

  it('reads the scale after what has been thrown away', () => {
    const heavy = makePackage({ declaredWeightKg: 1, actualWeightKg: 2, contents: [
      { id: 1, name: 'a', art: 'dome', color: '#fff', weightKg: 1 },
      { id: 2, name: 'b', art: 'dome', color: '#fff', weightKg: 1, extra: true },
    ] });
    expect(cluesFor(heavy, 'scale', [], [2])[0].text).toBe('Scale reads 1 kg (label says 1 kg).');
  });

  it('stops reporting the scale disagreement once the stowaway is thrown away', () => {
    const pkg = makePackage({ declaredWeightKg: 1, actualWeightKg: 2, defects: ['wrong_weight'], contents: [
      { id: 1, name: 'a', art: 'dome', color: '#fff', weightKg: 1 },
      { id: 2, name: 'b', art: 'dome', color: '#fff', weightKg: 1, extra: true },
    ] });
    const texts = (discarded: number[]) => cluesFor(pkg, 'scale', [], discarded).map((c) => c.text);
    expect(texts([])).toContain('The scale disagrees with the label.');
    expect(texts([2])).not.toContain('The scale disagrees with the label.');
  });
});
