import { describe, expect, it } from 'vitest';
import { newHandling } from './handling';
import {
  LAST_DAY,
  isCorrectVerdict,
  isShippable,
  needsOpening,
  rejectWorthyProblems,
  ruleCardForDay,
  unresolvedProblems,
} from './rules';
import { goodAddress, makePackage } from './testing';
import type { AddressIssue, DefectId } from './types';

const day1 = ruleCardForDay(1);
const day2 = ruleCardForDay(2);
const day5 = ruleCardForDay(5);

describe('rule cards', () => {
  it('has a card for every day', () => {
    for (let d = 1; d <= LAST_DAY; d++) expect(ruleCardForDay(d).day).toBe(d);
  });

  it('never lists a defect as both rejected and allowed', () => {
    for (let d = 1; d <= LAST_DAY; d++) {
      const c = ruleCardForDay(d);
      for (const id of c.rejectDefects) expect(c.allowedDefects).not.toContain(id);
      for (const id of c.rejectAddress) expect(c.allowedAddress).not.toContain(id);
    }
  });
});

describe('shippability', () => {
  it('ships a clean package with a good address', () => {
    expect(isShippable(makePackage(), newHandling(), day1)).toBe(true);
  });

  it('does not ship a leaking can on day 1', () => {
    const pkg = makePackage({ kind: 'can', defects: ['leaking'] });
    expect(isShippable(pkg, newHandling(), day1)).toBe(false);
  });

  it('tolerates defects the card allows', () => {
    const pkg = makePackage({ defects: ['crushed_corner'] });
    expect(isShippable(pkg, newHandling(), day1)).toBe(true);
  });

  it('becomes shippable once the rejectable defect is repaired', () => {
    const pkg = makePackage({ defects: ['torn_tape'] });
    const repaired = { ...newHandling(), repaired: ['torn_tape' as const] };
    expect(isShippable(pkg, repaired, day1)).toBe(true);
  });

  it('rejects a bad address even on a perfect box', () => {
    const pkg = makePackage({ address: { ...goodAddress, zip: '' } });
    expect(isShippable(pkg, newHandling(), day1)).toBe(false);
  });

  it('a relabel resolves a malformed address', () => {
    const pkg = makePackage({ address: { ...goodAddress, zip: '' } });
    expect(isShippable(pkg, { ...newHandling(), relabeled: true }, day1)).toBe(true);
  });

  it('a relabel cannot resolve a forbidden destination', () => {
    const pkg = makePackage({ address: { ...goodAddress, street: 'PO Box 12' } });
    expect(isShippable(pkg, { ...newHandling(), relabeled: true }, day2)).toBe(false);
  });
});

describe('needsOpening', () => {
  it('is true when a rejectable problem needs the box open and all are repairable', () => {
    expect(needsOpening(makePackage({ defects: ['bottomless'] }), day5)).toBe(true);
  });

  it('is false when every rejectable problem can be fixed from outside', () => {
    expect(needsOpening(makePackage({ defects: ['torn_tape'] }), day1)).toBe(false);
    expect(needsOpening(makePackage({ defects: ['crushed_corner'] }), day2)).toBe(false);
  });

  it('is false for an address-only problem', () => {
    const pkg = makePackage({ address: { ...goodAddress, zip: '' } });
    expect(needsOpening(pkg, day1)).toBe(false);
  });

  it('is true when outside and inside problems are mixed', () => {
    expect(needsOpening(makePackage({ kind: 'can', defects: ['leaking', 'bulging'] }), day1)).toBe(true);
  });

  it('is false for a clean package', () => {
    expect(needsOpening(makePackage(), day1)).toBe(false);
  });

  it('is false when a rejectable problem cannot be repaired', () => {
    expect(needsOpening(makePackage({ defects: ['future_contents'] }), day5)).toBe(false);
  });

  it('is false when repairable and unrepairable problems are mixed', () => {
    expect(needsOpening(makePackage({ defects: ['bottomless', 'future_contents'] }), day5)).toBe(false);
  });

  it('ignores allowed defects', () => {
    expect(needsOpening(makePackage({ defects: ['crushed_corner'] }), day1)).toBe(false);
  });
});

describe('problems', () => {
  it('lists the repair tool for each problem', () => {
    const pkg = makePackage({ defects: ['torn_tape'], address: { ...goodAddress, zip: '' } });
    expect(rejectWorthyProblems(pkg, day1)).toEqual([
      { source: 'defect', id: 'torn_tape', repairTool: 'tape', requiresOpen: false },
      { source: 'address', id: 'missing_field', repairTool: 'relabel', requiresOpen: false },
    ]);
  });

  it('drops resolved problems', () => {
    const pkg = makePackage({ defects: ['torn_tape'] });
    const h = { ...newHandling(), repaired: ['torn_tape' as const] };
    expect(unresolvedProblems(pkg, h, day1)).toEqual([]);
  });
});

describe('isCorrectVerdict', () => {
  it('ship is correct only for shippable packages', () => {
    const good = makePackage();
    const bad = makePackage({ defects: ['torn_tape'] });
    expect(isCorrectVerdict(good, newHandling(), day1, 'ship')).toBe(true);
    expect(isCorrectVerdict(bad, newHandling(), day1, 'ship')).toBe(false);
  });

  it('reject is correct only for unshippable packages', () => {
    const good = makePackage();
    const bad = makePackage({ defects: ['torn_tape'] });
    expect(isCorrectVerdict(good, newHandling(), day1, 'reject')).toBe(false);
    expect(isCorrectVerdict(bad, newHandling(), day1, 'reject')).toBe(true);
  });
});

const DEFECT_WORDS: Record<DefectId, RegExp> = {
  leaking: /leak/,
  crushed_corner: /crush/,
  torn_tape: /torn|tape/,
  bulging: /bulg/,
  wet_cardboard: /soggy|wet/,
  wrong_weight: /weigh/,
  rattling: /rattl/,
  missing_label: /contents label/,
  bottomless: /bottom/,
  humming: /hum/,
  whispering: /whisper/,
  ticking: /tick/,
  scorching: /scorch|hot|sun/,
  future_contents: /future/,
  heavier_inside: /weigh|heav/,
  tiny_weather: /weather/,
};

const ADDRESS_WORDS: Record<AddressIssue, RegExp> = {
  missing_field: /label with a missing field|missing field|missing/,
  smudged: /smudg/,
  zip_mismatch: /zip/,
  po_box: /po box/,
  restricted_zone: /restricted/,
  nowhere: /nowhere/,
  underwater: /sea|water/,
  lunar: /moon/,
};

describe('rule card text', () => {
  it('names every rejectable thing, so a card lists exactly what is checked', () => {
    for (let d = 1; d <= LAST_DAY; d++) {
      const card = ruleCardForDay(d);
      const text = card.lines.join(' ').toLowerCase();
      const blanketDefects = text.includes('everything is rejectable');
      const blanketAddress = text.includes('every address problem is rejectable');
      const defectsToName = blanketDefects ? card.allowedDefects : card.rejectDefects;
      const addressToName = blanketAddress ? card.allowedAddress : card.rejectAddress;
      for (const id of defectsToName) {
        expect(text, `day ${d} defect ${id}`).toMatch(DEFECT_WORDS[id]);
      }
      for (const id of addressToName) {
        expect(text, `day ${d} address ${id}`).toMatch(ADDRESS_WORDS[id]);
      }
    }
  });
});
