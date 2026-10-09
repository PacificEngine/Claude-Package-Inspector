import { describe, expect, it } from 'vitest';
import { ruleCardForDay } from '../game/rules';
import { addressGuide, restrictionGuide, shapeGuide, tabsFor } from './reference';

describe('tabsFor', () => {
  it('always has Rules and Shapes, and adds the others when the card has such rules', () => {
    expect(tabsFor(ruleCardForDay(1))).toEqual(['rules', 'shapes', 'addresses']);
    expect(tabsFor(ruleCardForDay(2))).toEqual(['rules', 'shapes', 'addresses', 'restrictions']);
    for (let d = 3; d <= 7; d++) {
      expect(tabsFor(ruleCardForDay(d)).slice(0, 2)).toEqual(['rules', 'shapes']);
    }
  });

  it('shows Restrictions whenever a destination or an item is restricted', () => {
    for (let d = 2; d <= 7; d++) expect(tabsFor(ruleCardForDay(d))).toContain('restrictions');
  });
});

describe('shapeGuide', () => {
  it('lists the shapes that can appear that day, with how they turn', () => {
    expect(shapeGuide(1).map((s) => s.name)).toEqual(['Cuboid', 'Cylinder']);
    expect(shapeGuide(4).map((s) => s.name)).toEqual(['Cuboid', 'Cylinder', 'Triangular prism']);
    expect(shapeGuide(6).map((s) => s.name)).toEqual(['Cuboid', 'Cylinder', 'Triangular prism', 'Tetrahedron']);
    const cuboid = shapeGuide(1)[0];
    expect(cuboid.kinds).toBe('Boxes and parcels');
    expect(cuboid.description).toBe('Four sides to rotate; flip it for the underside.');
    expect(shapeGuide(4)[2].description).toBe('Three sides to rotate; it cannot be flipped.');
    expect(shapeGuide(6)[3].description).toBe('Four faces to rotate; flip it for four more.');
    expect(shapeGuide(1)[1].description).toBe('One round side; flip it for the base.');
  });
});

describe('addressGuide', () => {
  it('describes each address-format rule and whether it is rejected or tolerated today', () => {
    const day2 = addressGuide(ruleCardForDay(2));
    expect(day2.rules).toEqual([
      { text: 'A label missing a recipient, street, city or ZIP', rejected: true },
      { text: 'A ZIP that does not match the city', rejected: true },
      { text: 'A smudged label', rejected: false },
    ]);
  });

  it('words every rule so it reads correctly as either rejected or tolerated', () => {
    for (let d = 1; d <= 7; d++) {
      for (const rule of addressGuide(ruleCardForDay(d)).rules) {
        expect(rule.text).not.toMatch(/\b(must|needs|enough)\b/i);
      }
    }
  });

  it('shows the city and ZIP table only when a ZIP rule is on the card', () => {
    expect(addressGuide(ruleCardForDay(1)).cityZips).toEqual([]);
    expect(addressGuide(ruleCardForDay(2)).cityZips).toHaveLength(4);
    expect(addressGuide(ruleCardForDay(5)).cityZips).toHaveLength(4); // tolerated today, still worth knowing
  });
});

describe('restrictionGuide', () => {
  it('lists rejected destinations and restricted items', () => {
    expect(restrictionGuide(ruleCardForDay(2))).toEqual({ destinations: ['PO boxes'], items: [] });
    expect(restrictionGuide(ruleCardForDay(4))).toEqual({
      destinations: ['Fort Hush (ZIP 99001)', "'Nowhere Lane'"],
      items: ['candles'],
    });
    expect(restrictionGuide(ruleCardForDay(7)).destinations).toEqual([
      'PO boxes',
      'Fort Hush (ZIP 99001)',
      "'Nowhere Lane'",
      'Atlantis (below sea level)',
      'Moon Base',
    ]);
  });

  it('does not list a destination the day tolerates', () => {
    expect(restrictionGuide(ruleCardForDay(3)).destinations).toEqual(['Fort Hush (ZIP 99001)']);
  });
});
