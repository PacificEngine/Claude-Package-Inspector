import { describe, expect, it } from 'vitest';
import { RESTRICTED_PEOPLE } from '../game/address';
import { ruleCardForDay } from '../game/rules';
import { addressGuide, restrictionGuide, shapeGuide, tabsFor } from './reference';

const FORT = 'Fort Hush (ZIP 99001)';
const ATLANTIS = 'Atlantis (below sea level)';
const NOWHERE = '1 Nowhere Lane';
const PEOPLE = [...RESTRICTED_PEOPLE];

describe('tabsFor', () => {
  it('always has Rules and Shapes, and adds Addresses when a format rule is on the card', () => {
    expect(tabsFor(ruleCardForDay(1))).toEqual(['rules', 'shapes', 'addresses']);
    expect(tabsFor(ruleCardForDay(2))).toEqual(['rules', 'shapes', 'addresses']);
    for (let d = 3; d <= 7; d++) {
      expect(tabsFor(ruleCardForDay(d)).slice(0, 2)).toEqual(['rules', 'shapes']);
    }
  });

  it('shows Restrictions exactly when a person, town, address or item is restricted', () => {
    for (let d = 1; d <= 7; d++) {
      const g = restrictionGuide(ruleCardForDay(d));
      const any = g.people.length + g.towns.length + g.addresses.length + g.items.length > 0;
      expect(tabsFor(ruleCardForDay(d)).includes('restrictions')).toBe(any);
    }
    expect(tabsFor(ruleCardForDay(2))).not.toContain('restrictions');
    for (let d = 3; d <= 7; d++) expect(tabsFor(ruleCardForDay(d))).toContain('restrictions');
  });
});

describe('shapeGuide', () => {
  it('lists the package types that can appear that day, with how they turn', () => {
    expect(shapeGuide(1).map((s) => s.name)).toEqual(['Boxes and parcels', 'Cans, jars and tubes']);
    expect(shapeGuide(3).map((s) => s.name)).toEqual(['Boxes and parcels', 'Cans, jars and tubes']);
    expect(shapeGuide(4).map((s) => s.name)).toEqual([
      'Boxes and parcels',
      'Cans, jars and tubes',
      'Tents and wedges',
    ]);
    expect(shapeGuide(6).map((s) => s.name)).toEqual([
      'Boxes and parcels',
      'Cans, jars and tubes',
      'Tents and wedges',
      'Pyraminxes and caltrops',
    ]);
    expect(shapeGuide(7).map((s) => s.name)).toEqual([
      'Boxes and parcels',
      'Cans, jars and tubes',
      'Tents and wedges',
      'Pyraminxes and caltrops',
      'Diamonds and pyrites',
    ]);
    expect(shapeGuide(1)[0].description).toBe('Four sides to rotate. Flip tumbles it: side, top, the opposite side upside-down, bottom. Rotating on the top or bottom changes which side comes next, and the bottom turns the other way.');
    expect(shapeGuide(1)[1].description).toBe('Two faces, front and back, to rotate between. Flip tumbles it: side, top, the same side upside-down, bottom.');
    expect(shapeGuide(7)[2].description).toBe('Three sides to rotate. Flip tumbles it: side, top, the opposite side upside-down, bottom.');
    expect(shapeGuide(7)[3].description).toBe('Four faces to rotate. Flip it to see the bottom.');
    expect(shapeGuide(7)[4].description).toBe('Four faces to rotate; flip it for four more.');
  });

  it('has only name and description, and no geometry jargon', () => {
    for (let d = 1; d <= 7; d++) {
      for (const entry of shapeGuide(d)) {
        expect(Object.keys(entry).sort()).toEqual(['description', 'name']);
        expect(JSON.stringify(entry)).not.toMatch(/cuboid|cylinder|prism|tetrahedron|octahedron|triangular/i);
        expect(JSON.stringify(entry)).not.toMatch(/pyramid|cheese wedge/i);
      }
    }
  });
});

describe('addressGuide', () => {
  it('shows an annotated example label', () => {
    expect(addressGuide(ruleCardForDay(1)).example).toEqual([
      { line: 'A. Pemberton', meaning: 'Recipient: an initial and a surname.' },
      { line: '12 Elm Street', meaning: 'Street: a house number and a street name.' },
      { line: 'Maplewood 10001', meaning: 'City and ZIP: the ZIP must belong to the city.' },
      { line: 'Return: 40 Oak Road, Riverton', meaning: 'Return address: where the package came from.' },
    ]);
    expect(addressGuide(ruleCardForDay(1))).not.toHaveProperty('rules');
  });

  it('shows the city and ZIP table only when a ZIP rule is on the card', () => {
    expect(addressGuide(ruleCardForDay(1)).cityZips).toEqual([]);
    expect(addressGuide(ruleCardForDay(2)).cityZips).toHaveLength(4);
    expect(addressGuide(ruleCardForDay(5)).cityZips).toHaveLength(4); // tolerated today, still worth knowing
  });
});

describe('restrictionGuide', () => {
  const expected: Record<number, { people: string[]; towns: string[]; addresses: string[] }> = {
    1: { people: [], towns: [], addresses: [] },
    2: { people: [], towns: [], addresses: [] },
    3: { people: PEOPLE, towns: [FORT], addresses: [] },
    4: { people: PEOPLE, towns: [FORT], addresses: [NOWHERE] },
    5: { people: [], towns: [ATLANTIS, 'Moon Base'], addresses: [] },
    6: { people: [], towns: [ATLANTIS, 'Moon Base'], addresses: [NOWHERE] },
    7: { people: PEOPLE, towns: [FORT, ATLANTIS, 'Moon Base'], addresses: [NOWHERE] },
  };

  it('lists the restricted people, towns, addresses and items for each day', () => {
    for (let d = 1; d <= 7; d++) {
      const g = restrictionGuide(ruleCardForDay(d));
      expect({ people: g.people, towns: g.towns, addresses: g.addresses }).toEqual(expected[d]);
      expect(g.items).toEqual(ruleCardForDay(d).restrictedItems);
    }
    expect(restrictionGuide(ruleCardForDay(4)).items).toEqual(['candles']);
  });

  it('never lists PO boxes', () => {
    for (let d = 1; d <= 7; d++) {
      expect(JSON.stringify(restrictionGuide(ruleCardForDay(d)))).not.toMatch(/PO box/i);
    }
  });
});
