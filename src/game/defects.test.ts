import { describe, expect, it } from 'vitest';
import { ALL_DEFECT_IDS, DEFECTS } from './defects';

describe('defect catalog', () => {
  it('keys each entry by its own id', () => {
    for (const id of ALL_DEFECT_IDS) expect(DEFECTS[id].id).toBe(id);
  });

  it('gives every defect at least one clue and one compatible package kind', () => {
    for (const id of ALL_DEFECT_IDS) {
      expect(Object.keys(DEFECTS[id].clues).length).toBeGreaterThan(0);
      expect(DEFECTS[id].kinds.length).toBeGreaterThan(0);
    }
  });

  it('can be fixed with duct tape when bottomless', () => {
    expect(DEFECTS.bottomless.repairedBy).toBe('tape');
  });

  it('has a pebble clue for the bottomless box', () => {
    expect(DEFECTS.bottomless.clues.pebble).toMatch(/never lands/);
  });

  it('leaves some defects unrepairable', () => {
    expect(DEFECTS.future_contents.repairedBy).toBeNull();
    expect(DEFECTS.scorching.repairedBy).toBeNull();
  });

  it('marks the fantastical ones', () => {
    expect(DEFECTS.bottomless.fantastical).toBe(true);
    expect(DEFECTS.leaking.fantastical).toBe(false);
  });
});

describe('repair and inside data', () => {
  it('lets only torn tape and crushed corner be repaired without opening', () => {
    const closedOk = ALL_DEFECT_IDS.filter((id) => !DEFECTS[id].repairNeedsOpen).sort();
    expect(closedOk).toEqual(['crushed_corner', 'torn_tape']);
  });

  it('has inside clues for exactly the defects that show when the box is opened', () => {
    const ids = ALL_DEFECT_IDS.filter((id) => DEFECTS[id].insideClue !== undefined).sort();
    expect(ids).toEqual([
      'bottomless',
      'future_contents',
      'humming',
      'leaking',
      'scorching',
      'ticking',
      'tiny_weather',
      'whispering',
    ]);
  });
});

it('lets the new shapes carry only the defects that fit them', () => {
  const on = (kind: 'prism' | 'tetra' | 'octa') =>
    ALL_DEFECT_IDS.filter((id) => DEFECTS[id].kinds.includes(kind)).sort();
  expect(on('prism')).toContain('torn_tape');
  expect(on('prism')).toContain('crushed_corner');
  expect(on('prism')).toContain('bottomless');
  expect(on('prism')).toContain('wet_cardboard');
  expect(on('octa')).toEqual(on('tetra'));
  expect(on('tetra')).toContain('bottomless');
  expect(on('tetra')).toContain('wet_cardboard');
  expect(on('tetra')).not.toContain('torn_tape');
  expect(on('tetra')).not.toContain('crushed_corner');
  expect(on('tetra')).toContain('missing_label');
});
