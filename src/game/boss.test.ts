import { describe, expect, it } from 'vitest';
import { bossNote } from './boss';
import { LAST_DAY } from './rules';

describe('bossNote', () => {
  it('has a line for every day', () => {
    for (let d = 1; d <= LAST_DAY; d++) expect(bossNote(d, 80, false).length).toBeGreaterThan(0);
  });

  it('has a different line for each day', () => {
    const notes = new Set(Array.from({ length: LAST_DAY }, (_, i) => bossNote(i + 1, 80, false)));
    expect(notes.size).toBe(LAST_DAY);
  });

  it('has its own line for a failed shift', () => {
    const failed = bossNote(3, 50, true);
    expect(failed).not.toBe(bossNote(3, 50, false));
    expect(bossNote(5, 10, true)).toBe(failed);
  });

  it('praises perfect accuracy differently', () => {
    for (let d = 1; d <= LAST_DAY; d++) expect(bossNote(d, 100, false)).not.toBe(bossNote(d, 99, false));
  });
});
