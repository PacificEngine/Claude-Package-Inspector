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
