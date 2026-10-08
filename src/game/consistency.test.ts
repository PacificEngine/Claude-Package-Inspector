import { describe, expect, it } from 'vitest';
import { ADDRESS_ISSUE_MIN_DAY } from './address';
import { DEFECTS } from './defects';
import { LAST_DAY, ruleCardForDay } from './rules';
import { isInspectionItem, unlockedItems } from './shop';
import type { InspectionTool } from './types';

// A defect may only appear on a day when the player can plausibly detect it:
// either the free base kit shows it, or the tool that shows it could have been bought.
function toolsPossiblyOwned(day: number): InspectionTool[] {
  return ['look', ...unlockedItems(day - 1).filter(isInspectionItem)];
}

describe('rule cards stay in step with the shop', () => {
  for (let day = 1; day <= LAST_DAY; day++) {
    it(`day ${day}: every defect is introduced late enough and is detectable`, () => {
      const card = ruleCardForDay(day);
      const tools = toolsPossiblyOwned(day);
      for (const id of [...card.rejectDefects, ...card.allowedDefects]) {
        const def = DEFECTS[id];
        expect(def.minDay, `${id} minDay`).toBeLessThanOrEqual(day);
        const detectable = (Object.keys(def.clues) as InspectionTool[]).some((t) => tools.includes(t));
        expect(detectable, `${id} detectable on day ${day}`).toBe(true);
      }
    });

    it(`day ${day}: address issues are introduced late enough`, () => {
      const card = ruleCardForDay(day);
      for (const issue of [...card.rejectAddress, ...card.allowedAddress]) {
        expect(ADDRESS_ISSUE_MIN_DAY[issue], issue).toBeLessThanOrEqual(day);
      }
    });
  }

  it('lists every address issue as rejectable or allowed on day 7', () => {
    const card = ruleCardForDay(LAST_DAY);
    expect([...card.rejectAddress, ...card.allowedAddress]).toHaveLength(8);
  });
});
