# Reference Tabs, Labels and Restricted Items Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reference tabs (Rules, Shapes, Addresses, Restrictions) under the rule card, hide the address and the contents list until the matching label on the package is clicked, put a separate contents label on the package, add restricted items, and shorten the shape note to just the shape's name.

**Architecture:** Rules and label state live in the tested core (restricted items as a new problem kind, `readLabel`, `labelFace`, the tightened weight rule). A pure `reference.ts` decides which tabs exist and what they contain; the screen renders them and the labels from those helpers.

**Tech Stack:** TypeScript (strict), Vite, Vitest, yarn. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-08-reference-and-labels-design.md`

## Global Constraints

- `yarn` only. TDD: failing test first, watch it fail, minimal code.
- Branch `feature/reference-and-labels` (already created from `main`). Never commit to `main`.
- Commit messages explain *why*. NO `Co-Authored-By`, no "Generated with", no signature or trailer. Never stage `.superpowers/`.
- No new dependencies. `src/game/` must not import `src/ui/` or `src/audio/` or touch the DOM. UI text via DOM APIs only, never `innerHTML`.
- Snyk is not required; do not run it.
- Every task ends with `yarn test && yarn tsc --noEmit && yarn build` green.
- Restricted items by day: 4 candles; 5 honey, cheese wedges; 6 peaches, dice; 7 candles, rubber ducks, strawberry jam; days 1-3 none. Names match the catalog in `src/game/contents.ts`.
- The shape note is exactly `Shape: <name>` with names `cuboid`, `cylinder`, `triangular prism`, `tetrahedron`.

## File Structure

```
src/game/shapes.ts       shapeNote -> 'Shape: <name>' only; shapeName
src/game/rules.ts        RuleCard.restrictedItems; Problem source 'item'; card text days 4-7
src/game/contents.ts     declaredAfter; weightMatches against it
src/game/inspection.ts   scale defect clue filter uses the adjusted comparison
src/game/shift.ts        strike message for restricted items; readLabel
src/game/types.ts        Package.labelFace; Handling.addressRead/contentsRead
src/game/handling.ts     new fields
src/game/packages.ts     labelFace; missing_label placed on it
src/game/testing.ts      makePackage default labelFace 0
src/game/address.ts      EVERYDAY_ZIPS
src/ui/reference.ts      tabsFor, shapeGuide, addressGuide, restrictionGuide (new)
src/ui/geometry.ts       shippingLabelRect
src/ui/markers.ts        labelMarkersFor
src/ui/packageArt.ts     draw the two labels
src/ui/app.ts            tabs, label panels, label markers
```

---

### Task 1: Restricted items, the tighter weight rule and the short shape note

**Files:**
- Modify: `src/game/shapes.ts`, `src/game/rules.ts`, `src/game/contents.ts`, `src/game/inspection.ts`, `src/game/shift.ts`, `src/game/playthrough.test.ts`, `docs/superpowers/specs/2026-10-08-contents-design.md`
- Test: `src/game/shapes.test.ts`, `src/game/rules.test.ts`, `src/game/contents.test.ts`, `src/game/inspection.test.ts`, `src/game/shift.test.ts`

**Interfaces:**
- Produces:
  - `shapeName(kind: PackageKind): string` (`'cuboid'`, `'cylinder'`, `'triangular prism'`, `'tetrahedron'`); `shapeNote(kind)` returns `Shape: ${shapeName(kind)}`.
  - `RuleCard.restrictedItems: string[]` on all seven cards.
  - `Problem.source: 'defect' | 'address' | 'item'`; `Problem.id` also `'restricted_item'`; `Problem.itemId?: number`. A restricted item is `{ source: 'item', id: 'restricted_item', repairTool: 'discard', requiresOpen: true, itemId }`.
  - `declaredAfter(pkg, discarded: readonly number[]): number` in contents.ts; `weightMatches` compares the current weight with it.

- [ ] **Step 1: Write the failing tests**

Update `src/game/shapes.test.ts` `describes each shape in the first note`:

```ts
  it('names only the shape in the first note', () => {
    expect(shapeNote('box')).toBe('Shape: cuboid');
    expect(shapeNote('parcel')).toBe('Shape: cuboid');
    expect(shapeNote('can')).toBe('Shape: cylinder');
    expect(shapeNote('prism')).toBe('Shape: triangular prism');
    expect(shapeNote('tetra')).toBe('Shape: tetrahedron');
    expect(shapeName('jar')).toBe('cylinder');
  });
```
(import `shapeName`.) Update the `inspection.test.ts` test `records the shape as the first note` to expect `text: 'Shape: triangular prism.'`-free wording: `'Shape: triangular prism'`.

Append to `src/game/rules.test.ts`:

```ts
describe('restricted items', () => {
  const item = (id: number, name: string, weightKg = 0.3) => ({
    id, name, art: 'dome' as const, color: '#fff', weightKg,
  });
  const day4 = ruleCardForDay(4);
  const candlePackage = makePackage({
    kind: 'prism',
    contents: [item(1, 'candles'), item(2, 'toy tent')],
    packagingKg: 0.4,
    declaredWeightKg: 1,
    actualWeightKg: 1,
  });

  it('lists restricted items by day', () => {
    expect([1, 2, 3].map((d) => ruleCardForDay(d).restrictedItems)).toEqual([[], [], []]);
    expect(ruleCardForDay(4).restrictedItems).toEqual(['candles']);
    expect(ruleCardForDay(5).restrictedItems).toEqual(['honey', 'cheese wedges']);
    expect(ruleCardForDay(6).restrictedItems).toEqual(['peaches', 'dice']);
    expect(ruleCardForDay(7).restrictedItems).toEqual(['candles', 'rubber ducks', 'strawberry jam']);
  });

  it('makes a restricted item a problem that throwing it away fixes, needing the box open', () => {
    expect(rejectWorthyProblems(candlePackage, day4)).toEqual([
      { source: 'item', id: 'restricted_item', repairTool: 'discard', requiresOpen: true, itemId: 1 },
    ]);
    expect(needsOpening(candlePackage, day4)).toBe(true);
    expect(rejectWorthyProblems(candlePackage, ruleCardForDay(3))).toEqual([]);
  });

  it('is resolved once the restricted item is thrown away', () => {
    expect(isShippable(candlePackage, newHandling(), day4)).toBe(false);
    expect(isShippable(candlePackage, { ...newHandling(), discarded: [1] }, day4)).toBe(true);
    expect(isShippable(candlePackage, { ...newHandling(), discarded: [2] }, day4)).toBe(false);
  });

  it('names every restricted item on the card text', () => {
    for (let d = 4; d <= 7; d++) {
      const card = ruleCardForDay(d);
      const text = card.lines.join(' ').toLowerCase();
      for (const name of card.restrictedItems) expect(text, `${d} ${name}`).toContain(name);
    }
  });

  it('only restricts items that can turn up that day', () => {
    for (let d = 4; d <= 7; d++) {
      const names = new Set(
        kindsForDay(d).flatMap((kind) => CATALOG[kind].map((c) => c.name)),
      );
      for (const name of ruleCardForDay(d).restrictedItems) expect(names.has(name), `${d} ${name}`).toBe(true);
    }
  });
});
```
(imports: `kindsForDay` from `./packages`, `CATALOG` from `./contents`, the rules helpers already imported; `newHandling` too.)

Replace the weight tests in `src/game/rules.test.ts`'s `weight and label resolution` that depend on lenient swapping if any (the existing `discarded: [1]` unresolved test stays valid). Append to `src/game/contents.test.ts`:

```ts
describe('the weight rule counts only the stowaways', () => {
  it('compares with the declared weight minus legit items thrown away', () => {
    expect(declaredAfter(pkg, [])).toBe(1.4);
    expect(declaredAfter(pkg, [1])).toBe(0.8);
    expect(declaredAfter(pkg, [3])).toBe(1.4); // an extra never counted in the declared weight
  });

  it('is not fooled by swapping a legit item for an equal-weight stowaway', () => {
    const swap = makePackage({
      packagingKg: 0,
      declaredWeightKg: 1,
      actualWeightKg: 1.6,
      contents: [item(1, 0.6), item(2, 0.4), item(3, 0.6, { extra: true })],
    });
    expect(weightMatches(swap, { ...newHandling(), discarded: [1] })).toBe(false);
    expect(weightMatches(swap, { ...newHandling(), discarded: [3] })).toBe(true);
  });

  it('stays matched when only legit items are thrown away from a package with no stowaway', () => {
    expect(weightMatches(pkg, { ...newHandling(), discarded: [3, 1] })).toBe(true);
  });
});
```
(`pkg`, `item` are the fixtures already defined in that file; import `declaredAfter`.) In `src/game/shift.test.ts`, update the wrong-weight test `lets the player ship a wrong-weight package once the stowaway is gone` only if its assertions change (they should not).

Append to `src/game/shift.test.ts`:

```ts
describe('restricted item strikes', () => {
  it('names the restricted item when a package that holds one is shipped', () => {
    const p = makePackage({
      kind: 'prism',
      packagingKg: 0.4,
      declaredWeightKg: 1,
      actualWeightKg: 1,
      contents: [{ id: 1, name: 'candles', art: 'sticks' as const, color: '#f2e2b0', weightKg: 0.6 }],
    });
    const r = stamp(shiftWith([p, p], 4), 'ship');
    expect(r.state.strikes).toBe(1);
    expect(r.message).toContain('restricted candles');
  });
});
```

- [ ] **Step 2: Run and see failures**

Run: `yarn test`
Expected: FAIL (`shapeName`, `restrictedItems`, `declaredAfter` missing; shape note text).

- [ ] **Step 3: Implement the shape note**

`src/game/shapes.ts`: replace `SHAPE_NOTES` with

```ts
const SHAPE_NAMES: Record<Shape, string> = {
  cuboid: 'cuboid',
  cylinder: 'cylinder',
  prism: 'triangular prism',
  tetra: 'tetrahedron',
};

export const shapeName = (kind: PackageKind): string => SHAPE_NAMES[SHAPE_OF_KIND[kind]];

// The note names the shape only; how it turns is explained on the Shapes tab.
export const shapeNote = (kind: PackageKind): string => `Shape: ${shapeName(kind)}`;
```

- [ ] **Step 4: Rules and cards** (`src/game/rules.ts`)

Add `restrictedItems: string[];` to `RuleCard`. Add `restrictedItems: []` to Days 1-3 and the values from Global Constraints to Days 4-7, and one line to each of those cards (keep every card's existing lines, they are checked by a keyword test):
- Day 4: `'Candles may not ship: open the box and throw them away.'`
- Day 5: `'Honey and cheese wedges may not ship: throw them away first.'`
- Day 6: `'Peaches and dice may not ship: throw them away first.'`
- Day 7: `'Candles, rubber ducks and strawberry jam may not ship: throw them away first.'`

Widen `Problem` and add the item problems:

```ts
export interface Problem {
  source: 'defect' | 'address' | 'item';
  id: DefectId | AddressIssue | 'restricted_item';
  repairTool: RepairTool | 'discard' | null;
  requiresOpen: boolean;
  itemId?: number; // for a restricted item: which one
}
```
in `rejectWorthyProblems` add

```ts
  const items: Problem[] = pkg.contents
    .filter((item) => card.restrictedItems.includes(item.name))
    .map((item) => ({
      source: 'item',
      id: 'restricted_item',
      repairTool: 'discard',
      requiresOpen: true,
      itemId: item.id,
    }));
  return [...defects, ...addresses, ...items];
```
and in `isResolved` handle it first: `if (problem.source === 'item') return handling.discarded.includes(problem.itemId as number);`. Fix other `source === 'defect'` narrowing as the compiler requires.

- [ ] **Step 5: The tighter weight rule**

`src/game/contents.ts`:

```ts
// What the label's weight comes to once the legit items the player threw away are left out.
export function declaredAfter(pkg: Package, discarded: readonly number[]): number {
  const gone = pkg.contents
    .filter((i) => discarded.includes(i.id) && !i.extra)
    .reduce((sum, i) => sum + i.weightKg, 0);
  return round1(pkg.declaredWeightKg - gone);
}

export const weightMatches = (pkg: Package, handling: Handling): boolean =>
  weightIsDeclared(currentWeightKg(pkg, handling), declaredAfter(pkg, handling.discarded));
```
(remove the old `weightMatches`). In `src/game/inspection.ts` the scale clue filter that drops the `wrong_weight` defect clue must use `weightIsDeclared(weightLeft(pkg, discarded), declaredAfter(pkg, discarded))`. The printed scale text still says `label says ${pkg.declaredWeightKg} kg`.

- [ ] **Step 6: Strike message** (`src/game/shift.ts`)

Where the strike message builds labels from `unresolvedProblems`, add the item case:

```ts
      .map((p) => {
        if (p.source === 'item') {
          return `restricted ${pkg.contents.find((i) => i.id === p.itemId)?.name ?? 'item'}`;
        }
        return p.source === 'defect'
          ? DEFECTS[p.id as DefectId].label
          : ADDRESS_ISSUE_LABELS[p.id as AddressIssue];
      })
```

- [ ] **Step 7: The bot** (`src/game/playthrough.test.ts`)

For a `'discard'` problem the bot throws away: every `extra` item when a `wrong_weight` problem exists, and every item named by an item problem (`problem.itemId`). Keep all assertions; the aggregate test should also assert the bot discarded at least one restricted item across the seeds (count them; widen the seed list if needed and report the numbers).

- [ ] **Step 8: Spec touch-up**

In `docs/superpowers/specs/2026-10-08-contents-design.md`, replace the paragraph added under "Wrong weight" that says any weight-restoring discard resolves the defect with: "The weight is compared with the declared weight minus the legit items thrown away, so exactly the stowaways must go; swapping an equal-weight legit item for a stowaway does not resolve it."

- [ ] **Step 9: Run everything and commit**

Run: `yarn test && yarn tsc --noEmit && yarn build` → PASS.

```bash
git add -A
git commit -m "Add restricted items and make wrong weight mean exactly the stowaways

A rule card can now ban items, fixed by throwing them away, which gives the
contents label and the Contents list a reason to be read. The weight rule counts
only stowaways so throwing away a restricted item cannot make a package
unsolvable, and the shape note names the shape only so its description has to
be looked up."
```

---

### Task 2: Two labels on the package

**Files:**
- Modify: `src/game/types.ts`, `src/game/handling.ts`, `src/game/testing.ts`, `src/game/packages.ts`, `src/game/shift.ts`
- Test: `src/game/handling.test.ts`, `src/game/packages.test.ts`, `src/game/shift.test.ts`

**Interfaces:**
- Produces:
  - `Package.labelFace: number` (index of the up face carrying the contents label); `makePackage` default `labelFace: 0`.
  - `Handling.addressRead: boolean`, `Handling.contentsRead: boolean` (`newHandling()` returns `false`, `false`).
  - `readLabel(s: ShiftState, which: 'shipping' | 'contents'): ActionResult`.

- [ ] **Step 1: Write the failing tests**

Update `src/game/handling.test.ts` `newHandling` expectation: add `addressRead: false`, `contentsRead: false`.

Append to `src/game/packages.test.ts`:

```ts
describe('the contents label face', () => {
  it('is face 1 on day 1 and on shapes with one up face', () => {
    for (const p of sample(1, 300)) expect(p.labelFace).toBe(0);
    for (const day of [2, 5, 7]) {
      for (const p of sample(day, 300)) {
        expect(p.labelFace).toBeGreaterThanOrEqual(0);
        expect(p.labelFace).toBeLessThan(faceCount(p.kind, 'up'));
        if (faceCount(p.kind, 'up') === 1) expect(p.labelFace).toBe(0);
      }
    }
  });

  it('spreads over the up faces from day 2', () => {
    const faces = new Set(sample(4, 600).map((p) => p.labelFace));
    expect(faces.has(1) || faces.has(2) || faces.has(3)).toBe(true);
  });

  it('puts a missing contents label on the face the label belongs on', () => {
    let seen = 0;
    for (const day of [2, 4, 7]) {
      for (const p of sample(day, 600)) {
        if (!p.defects.includes('missing_label')) continue;
        seen++;
        expect(p.placements?.missing_label).toEqual({ side: 'up', face: p.labelFace });
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});
```

Append to `src/game/shift.test.ts` (it has `shiftWith`, `tools`, `openBox`, `rotateBox`, `flipBox`):

```ts
describe('readLabel', () => {
  const box = makePackage({ kind: 'box', labelFace: 2 });
  const withRotate = (p = box) => shiftWith([p], 3, tools('rotate'));

  it('reads the shipping label face up on face 1', () => {
    const r = readLabel(withRotate(), 'shipping');
    expect(r.state.handling.addressRead).toBe(true);
    expect(r.message).toBe('You read the shipping label.');
  });

  it('cannot read the shipping label from another side', () => {
    const turned = rotateBox(withRotate()).state;
    const r = readLabel(turned, 'shipping');
    expect(r.message).toBe('The shipping label is on the first side.');
    expect(r.state.handling.addressRead).toBe(false);
  });

  it('reads the contents label only on the face it sits on', () => {
    let s = withRotate();
    expect(readLabel(s, 'contents').message).toBe('The contents label is on another side.');
    s = rotateBox(rotateBox(s).state).state; // face 3 (index 2)
    const r = readLabel(s, 'contents');
    expect(r.state.handling.contentsRead).toBe(true);
    expect(r.message).toBe('You read the contents label.');
  });

  it('finds no contents label when it is missing, and reads a reprinted one', () => {
    const unlabeled = makePackage({ kind: 'box', defects: ['missing_label'], labelFace: 0 });
    const s = shiftWith([unlabeled], 5);
    expect(readLabel(s, 'contents').message).toBe('There is no contents label.');
    const printed = { ...s, handling: { ...s.handling, repaired: ['missing_label' as const] } };
    expect(readLabel(printed, 'contents').state.handling.contentsRead).toBe(true);
  });

  it('needs the box closed and face up', () => {
    const open = openBox(shiftWith([box, box], 3)).state;
    expect(readLabel(open, 'shipping').message).toBe('Close the box first.');
    const flipped = flipBox(withRotate()).state;
    expect(readLabel(flipped, 'shipping').message).toBe('Turn the box face up first.');
  });
});
```
(import `readLabel`; `box.labelFace: 2` means the third up face of a box.)

- [ ] **Step 2: Run and see failures**

Run: `yarn test` → FAIL.

- [ ] **Step 3: Types, handling, fixtures**

`src/game/types.ts`: `Package.labelFace: number;` (comment: the up face carrying the contents label) and `Handling.addressRead: boolean; contentsRead: boolean;`. `newHandling()` adds `addressRead: false, contentsRead: false`. `makePackage` default `labelFace: 0`.

- [ ] **Step 4: Generator** (`src/game/packages.ts`)

After `placeDefects` is chosen, decide the face of the contents label (before the address draws, after the placements draw) and put a missing label on it:

```ts
  const upFaces = faceCount(kind, 'up');
  const labelFace = card.day >= 2 && upFaces > 1 ? rng.int(upFaces) : 0;
```
and, when `defects.includes('missing_label')` and placements exist for it (day ≥ 2) or day 1, set `placements.missing_label = { side: 'up', face: labelFace }`. Implement by calling `placeDefects(...)` then adjusting: if `defects.includes('missing_label') && card.day >= 2`, ensure the returned placements object includes `missing_label: { side: 'up', face: labelFace }` (create the object if it was undefined). On day 1 no placements are stored, and the default placement for a surface defect is `up:0`, which equals `labelFace` 0, so nothing to store. Add `labelFace` to the returned package. (The rng draw for `labelFace` must happen only when `card.day >= 2 && upFaces > 1`, so Day 1 sequences are unchanged.)

- [ ] **Step 5: `readLabel`** (`src/game/shift.ts`)

```ts
export function readLabel(s: ShiftState, which: 'shipping' | 'contents'): ActionResult {
  const pkg = currentPackage(s);
  if (!pkg) return idle(s);
  if (s.handling.opened) return { state: s, message: 'Close the box first.' };
  if (s.handling.flipped) return { state: s, message: 'Turn the box face up first.' };
  if (which === 'shipping') {
    if (s.handling.face !== 0) return { state: s, message: 'The shipping label is on the first side.' };
    return {
      state: { ...s, handling: { ...s.handling, addressRead: true } },
      message: 'You read the shipping label.',
    };
  }
  if (s.handling.face !== pkg.labelFace) {
    return { state: s, message: 'The contents label is on another side.' };
  }
  if (pkg.defects.includes('missing_label') && !s.handling.repaired.includes('missing_label')) {
    return { state: s, message: 'There is no contents label.' };
  }
  return {
    state: { ...s, handling: { ...s.handling, contentsRead: true } },
    message: 'You read the contents label.',
  };
}
```

- [ ] **Step 6: Run everything and commit**

Run: `yarn test && yarn tsc --noEmit && yarn build` → PASS.

```bash
git add -A
git commit -m "Give a package two labels, read by clicking them

The address and the contents list should not be free information: the shipping
label sits on the first side and the contents label on a face of its own, so
learning either means finding the label and reading it."
```

---

### Task 3: The reference tabs

**Files:**
- Create: `src/ui/reference.ts`
- Modify: `src/game/address.ts` (export `EVERYDAY_ZIPS`), `src/ui/app.ts`, `src/styles.css`
- Test: `src/ui/reference.test.ts`, `src/game/address.test.ts`

**Interfaces:**
- Produces (address.ts): `EVERYDAY_ZIPS: ReadonlyArray<{ city: string; zip: string }>` (the four everyday cities in order).
- Produces (reference.ts): `type TabId = 'rules' | 'shapes' | 'addresses' | 'restrictions'`; `tabsFor(card: RuleCard): TabId[]` (always `'rules'`, `'shapes'` first, then `'addresses'` and `'restrictions'` when they apply); `TAB_LABELS`; `shapeGuide(day: number): Array<{ name: string; kinds: string; description: string }>`; `addressGuide(card): { rules: Array<{ text: string; rejected: boolean }>; cityZips: Array<{ city: string; zip: string }> }`; `restrictionGuide(card): { destinations: string[]; items: string[] }`.

- [ ] **Step 1: Write the failing tests**

Add to `src/game/address.test.ts`:

```ts
it('lists the everyday cities with the ZIP codes that match them', () => {
  expect(EVERYDAY_ZIPS).toEqual([
    { city: 'Maplewood', zip: '10001' },
    { city: 'Riverton', zip: '20002' },
    { city: 'Port Calloway', zip: '30003' },
    { city: 'Dunmere', zip: '40004' },
  ]);
});
```

`src/ui/reference.test.ts`:

```ts
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
      { text: 'A label needs a recipient, street, city and ZIP.', rejected: true },
      { text: 'The ZIP must match the city.', rejected: true },
      { text: 'A smudged label is readable enough.', rejected: false },
    ]);
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
```
(Day 3 rejects `restricted_zone` and allows `po_box`; Day 4 rejects `restricted_zone` and `nowhere`; Day 7 rejects every destination. Check each against the card definitions; if a card differs, fix the test expectation to the card, not the card.)

- [ ] **Step 2: Run and see failures**

Run: `yarn test src/ui/reference.test.ts src/game/address.test.ts` → FAIL.

- [ ] **Step 3: Implement**

`src/game/address.ts`: `export const EVERYDAY_ZIPS = EVERYDAY_CITIES.map((city) => ({ city, zip: CITY_ZIP[city] }));` (after the tables).

`src/ui/reference.ts`:

```ts
import { EVERYDAY_ZIPS } from '../game/address';
import { kindsForDay } from '../game/packages';
import type { RuleCard } from '../game/rules';
import { SHAPE_OF_KIND, type Shape } from '../game/shapes';
import type { AddressIssue } from '../game/types';

export type TabId = 'rules' | 'shapes' | 'addresses' | 'restrictions';

export const TAB_LABELS: Record<TabId, string> = {
  rules: 'Rules',
  shapes: 'Shapes',
  addresses: 'Addresses',
  restrictions: 'Restrictions',
};

const FORMAT_RULES: AddressIssue[] = ['missing_field', 'zip_mismatch', 'smudged'];
const DESTINATIONS: AddressIssue[] = ['po_box', 'restricted_zone', 'nowhere', 'underwater', 'lunar'];

const mentioned = (card: RuleCard, issues: AddressIssue[]): AddressIssue[] =>
  issues.filter((i) => card.rejectAddress.includes(i) || card.allowedAddress.includes(i));

export function tabsFor(card: RuleCard): TabId[] {
  const tabs: TabId[] = ['rules', 'shapes'];
  if (mentioned(card, FORMAT_RULES).length > 0) tabs.push('addresses');
  const rejectedDestinations = DESTINATIONS.filter((i) => card.rejectAddress.includes(i));
  if (rejectedDestinations.length > 0 || card.restrictedItems.length > 0) tabs.push('restrictions');
  return tabs;
}

const SHAPE_TEXT: Record<Shape, { name: string; kinds: string; description: string }> = {
  cuboid: {
    name: 'Cuboid',
    kinds: 'Boxes and parcels',
    description: 'Four sides to rotate; flip it for the underside.',
  },
  cylinder: {
    name: 'Cylinder',
    kinds: 'Cans, jars and tubes',
    description: 'One round side; flip it for the base.',
  },
  prism: {
    name: 'Triangular prism',
    kinds: 'Prisms',
    description: 'Three sides to rotate; it cannot be flipped.',
  },
  tetra: {
    name: 'Tetrahedron',
    kinds: 'Tetrahedrons',
    description: 'Four faces to rotate; flip it for four more.',
  },
};

const SHAPE_ORDER: Shape[] = ['cuboid', 'cylinder', 'prism', 'tetra'];

export function shapeGuide(day: number): Array<{ name: string; kinds: string; description: string }> {
  const today = new Set(kindsForDay(day).map((k) => SHAPE_OF_KIND[k]));
  return SHAPE_ORDER.filter((s) => today.has(s)).map((s) => SHAPE_TEXT[s]);
}

const FORMAT_TEXT: Record<'missing_field' | 'zip_mismatch' | 'smudged', string> = {
  missing_field: 'A label needs a recipient, street, city and ZIP.',
  zip_mismatch: 'The ZIP must match the city.',
  smudged: 'A smudged label is readable enough.',
};

export function addressGuide(card: RuleCard): {
  rules: Array<{ text: string; rejected: boolean }>;
  cityZips: Array<{ city: string; zip: string }>;
} {
  const rules = mentioned(card, FORMAT_RULES).map((issue) => ({
    text: FORMAT_TEXT[issue as keyof typeof FORMAT_TEXT],
    rejected: card.rejectAddress.includes(issue),
  }));
  const hasZipRule = mentioned(card, ['zip_mismatch']).length > 0;
  return { rules, cityZips: hasZipRule ? EVERYDAY_ZIPS.map((c) => ({ ...c })) : [] };
}

const DESTINATION_TEXT: Record<'po_box' | 'restricted_zone' | 'nowhere' | 'underwater' | 'lunar', string> = {
  po_box: 'PO boxes',
  restricted_zone: 'Fort Hush (ZIP 99001)',
  nowhere: "'Nowhere Lane'",
  underwater: 'Atlantis (below sea level)',
  lunar: 'Moon Base',
};

export function restrictionGuide(card: RuleCard): { destinations: string[]; items: string[] } {
  return {
    destinations: DESTINATIONS.filter((i) => card.rejectAddress.includes(i)).map(
      (i) => DESTINATION_TEXT[i as keyof typeof DESTINATION_TEXT],
    ),
    items: [...card.restrictedItems],
  };
}
```
(Check `DESTINATIONS` order matches the expected test order: PO boxes, Fort Hush, Nowhere Lane, Atlantis, Moon Base.) `ui/reference.ts` imports `kindsForDay` from the game, which is fine (UI may import game).

- [ ] **Step 4: The tab buttons** (`src/ui/app.ts`, `src/styles.css`)

In `mount`, keep `let tab: TabId = 'rules';`. In `shiftScreen`, replace the rule-card panel with a panel that has the tab buttons and the active tab's body:

```ts
    const tabs = tabsFor(s.card);
    if (!tabs.includes(tab)) tab = 'rules';
    const tabButtons = el(
      'div',
      { cls: 'tabs' },
      tabs.map((id) =>
        button(TAB_LABELS[id], () => { tab = id; render(); }, false, id === tab ? 'tab active' : 'tab'),
      ),
    );
    const card = el('div', { cls: 'panel' }, [
      tabButtons,
      ...referenceBody(tab, s),
    ]);
```
with a module-level helper `referenceBody(tab, s)` returning DOM nodes: `rules` → the existing `h3` title, `ul` of card lines and the open-box fine paragraph; `shapes` → for each `shapeGuide(s.day)` an `h4` with the name, a muted line with the kinds and a `p` with the description; `addresses` → `ul` of the rules each with a trailing "(rejected today)" / "(tolerated today)", then, if `cityZips` is non-empty, a small `table` (class `zips`) of City / ZIP rows; `restrictions` → `h4 Restricted destinations` with a `ul` (or "None today."), `h4 Restricted items` with a `ul` (or "None today.") and one `p`: "A restricted item can be thrown away: open the box, then use Throw away." when items exist. All text through `el`/`textContent`. The rule card for the `rules` tab must still render `s.card.title`, `s.card.lines` and the fine line exactly as today. Remove the old inline card construction. The dead-screen path (`if (!pkg)`) also uses `card`; keep it working with the same variable.

`src/styles.css`: `.tabs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; } button.tab.active { background: #4a5368; } .zips { border-collapse: collapse; } .zips td, .zips th { padding: 2px 10px; text-align: left; } h4 { margin: 8px 0 4px; }`.

- [ ] **Step 5: Run everything**

Run: `yarn test && yarn tsc --noEmit && yarn build` → PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add Rules, Shapes, Addresses and Restrictions tabs under the rule card

Players should look rules up, not memorize them: the shape descriptions, the
city and ZIP matches and the banned destinations and items each get a tab that
only appears once the day's rules need it."
```

---

### Task 4: The labels on the package, and the visual check

**Files:**
- Modify: `src/ui/geometry.ts`, `src/ui/markers.ts`, `src/ui/packageArt.ts`, `src/ui/app.ts`, `src/styles.css`
- Test: `src/ui/geometry.test.ts`, `src/ui/markers.test.ts`

**Interfaces:**
- Produces (geometry.ts): `shippingLabelRect(kind: PackageKind, b: Rect): Rect` — default `{ x: b.x + b.w*0.2, y: b.y + b.h*0.14, w: b.w*0.6, h: b.h*0.22 }`; tetra `{ x: b.x + b.w*0.36, y: b.y + b.h*0.36, w: b.w*0.28, h: b.h*0.2 }`. The contents label keeps using the existing `labelRect`.
- Produces (markers.ts): `interface LabelMarker { label: 'shipping' | 'contents'; rect: Rect }` and `labelMarkersFor(pkg, handling, width, height): LabelMarker[]`: only in the front view (closed, face up): the shipping marker when `handling.face === 0`; the contents marker when `handling.face === pkg.labelFace` and the contents label exists (no unrepaired `missing_label`).

- [ ] **Step 1: Write the failing tests**

Append to `src/ui/geometry.test.ts`:

```ts
describe('label rectangles', () => {
  it('puts the shipping label above the contents label, inside the body, for every kind', () => {
    for (const kind of ['box', 'can', 'parcel', 'jar', 'tube', 'prism', 'tetra'] as const) {
      const b = bodyRect(kind, 320, 260);
      const ship = shippingLabelRect(kind, b);
      const cont = labelRect(kind, b);
      expect(ship.x, kind).toBeGreaterThanOrEqual(b.x);
      expect(ship.x + ship.w, kind).toBeLessThanOrEqual(b.x + b.w);
      expect(ship.y + ship.h, kind).toBeLessThanOrEqual(cont.y);
      expect(cont.y + cont.h, kind).toBeLessThanOrEqual(b.y + b.h);
    }
  });

  it('keeps the tetrahedron labels inside the triangle', () => {
    const b = bodyRect('tetra', 320, 260);
    for (const r of [shippingLabelRect('tetra', b), labelRect('tetra', b)]) {
      // half-width of the triangle at the top edge of each rectangle
      const half = (b.w / 2) * ((r.y - b.y) / b.h);
      expect(r.x).toBeGreaterThanOrEqual(b.x + b.w / 2 - half);
      expect(r.x + r.w).toBeLessThanOrEqual(b.x + b.w / 2 + half);
    }
  });
});
```
(imports: `shippingLabelRect`, `labelRect`, `bodyRect`.)

Append to `src/ui/markers.test.ts`:

```ts
describe('label markers', () => {
  const box = makePackage({ kind: 'box', labelFace: 2 });

  it('offers the shipping label on face 1 and the contents label on its own face', () => {
    expect(labelMarkersFor(box, front, W, H).map((m) => m.label)).toEqual(['shipping']);
    expect(labelMarkersFor(box, { ...front, face: 2 }, W, H).map((m) => m.label)).toEqual(['contents']);
    expect(labelMarkersFor(box, { ...front, face: 1 }, W, H)).toEqual([]);
  });

  it('offers both on one face when they share it', () => {
    expect(labelMarkersFor(makePackage({ kind: 'can', labelFace: 0 }), front, W, H).map((m) => m.label)).toEqual([
      'shipping',
      'contents',
    ]);
  });

  it('offers no label when the box is open or flipped', () => {
    expect(labelMarkersFor(box, open, W, H)).toEqual([]);
    expect(labelMarkersFor(box, flipped, W, H)).toEqual([]);
  });

  it('has no contents label to click while it is missing, but does once it is reprinted', () => {
    const lost = makePackage({ kind: 'can', defects: ['missing_label'], labelFace: 0 });
    expect(labelMarkersFor(lost, front, W, H).map((m) => m.label)).toEqual(['shipping']);
    expect(
      labelMarkersFor(lost, { ...front, repaired: ['missing_label'] }, W, H).map((m) => m.label),
    ).toEqual(['shipping', 'contents']);
  });

  it('places the markers on the label rectangles', () => {
    const b = bodyRect('box', W, H);
    const [ship] = labelMarkersFor(box, front, W, H);
    expect(ship.rect).toEqual(shippingLabelRect('box', b));
    const [cont] = labelMarkersFor(box, { ...front, face: 2 }, W, H);
    expect(cont.rect).toEqual(labelRect('box', b));
  });
});
```
(`front`, `flipped`, `open`, `W`, `H` are defined in that file; import `labelMarkersFor`, `shippingLabelRect`, `labelRect`.)

- [ ] **Step 2: Run and see failures**

Run: `yarn test src/ui` → FAIL.

- [ ] **Step 3: Geometry and markers**

`src/ui/geometry.ts`:

```ts
// The shipping (address) label sits above the contents label. A tetrahedron's is higher and narrower.
export function shippingLabelRect(kind: PackageKind, b: Rect): Rect {
  if (kind === 'tetra') return { x: b.x + b.w * 0.36, y: b.y + b.h * 0.36, w: b.w * 0.28, h: b.h * 0.2 };
  return { x: b.x + b.w * 0.2, y: b.y + b.h * 0.14, w: b.w * 0.6, h: b.h * 0.22 };
}
```
`src/ui/markers.ts`:

```ts
export interface LabelMarker {
  label: 'shipping' | 'contents';
  rect: Rect;
}

// The two labels on the outside, each clickable only on the face it sits on.
export function labelMarkersFor(pkg: Package, handling: Handling, width: number, height: number): LabelMarker[] {
  if (viewOf(handling) !== 'front') return [];
  const body = bodyRect(pkg.kind, width, height);
  const markers: LabelMarker[] = [];
  if (handling.face === 0) markers.push({ label: 'shipping', rect: shippingLabelRect(pkg.kind, body) });
  const lost = pkg.defects.includes('missing_label') && !handling.repaired.includes('missing_label');
  if (handling.face === pkg.labelFace && !lost) {
    markers.push({ label: 'contents', rect: labelRect(pkg.kind, body) });
  }
  return markers;
}
```
(import `shippingLabelRect` / `labelRect`; `viewOf` is already imported there.)

- [ ] **Step 4: Drawing** (`src/ui/packageArt.ts`, `drawFront`)

Today the front draws one white label rectangle on every face. Change it so that:
- on up face 1 (`handling.face === 0`) it draws the **shipping label**: a white rectangle at `shippingLabelRect(pkg.kind, b)` with a small "TO" mark and two grey text lines;
- on face `pkg.labelFace` it draws the **contents label** at `labelRect(pkg.kind, b)` with a "CONTENTS" mark and two grey lines, **unless** the missing-label defect is visible there (then the existing dashed outline at `labelRect` is drawn instead, as now);
- on every other face neither label is drawn.
Both labels can be on the same face (face 1 when `labelFace` is 0); the rectangles do not overlap by Step 1's geometry test. Keep the face shading, tape strip, marks and repair patch as they are. Text marks use `ctx.fillText` with a small bold font set before and restored after (`ctx.save()`/`ctx.restore()`).

- [ ] **Step 5: The screen** (`src/ui/app.ts`, `src/styles.css`)

1. Add `readLabel` to the shift imports and `labelMarkersFor` to the markers import.
2. **Label markers.** Build overlay buttons from `labelMarkersFor(pkg, s.handling, STAGE_W, STAGE_H)` next to the defect and item markers, with aria-labels `Read the shipping label` / `Read the contents label`, class `marker label` (and `marker label read` once read: `addressRead` / `contentsRead`), clicking `act((st) => readLabel(st, m.label))`. Keep the largest-area-first sort over all marker kinds together.
3. **Label panels.** Replace the old always-visible label card (`label-card` with the address lines, declared weight and the "Contents:" line) with two blocks under the picture:
   - Shipping label: if `s.handling.addressRead`, the address lines and `Declared weight: N kg`; otherwise a muted hint `Shipping label: find it on the package and click it.`
   - Contents label: if `s.handling.contentsRead` and the label exists, `Contents: <labelText>`; otherwise a muted hint `Contents label: find it on the package and click it.` (After a reprint the same block shows the new text.)
   Keep `labelText` as it is for the printed text. No address text may be built when `addressRead` is false.
4. Style `.marker.label` with a distinct dashed border colour (e.g. light blue) so label targets are distinguishable from defect markers, and `.label-card` unchanged for the revealed blocks.

- [ ] **Step 6: Run everything**

Run: `yarn test && yarn tsc --noEmit && yarn build` → PASS.

- [ ] **Step 7: Visual check in the browser preview**

Start the server (`preview_start` name `pack-inspect`). In `preview_eval` import `/src/ui/packageArt.ts`, `/src/ui/markers.ts` and `/src/ui/geometry.ts` (append `?t=`+Date.now()) and render a gallery on scratch canvases with the label marker rectangles outlined in yellow for: a box on faces 1-4 with `labelFace` 2; a can; a parcel; a prism on its three faces; a tetra on face 1 and its label face; a box with a missing contents label (dashed outline at the contents label rectangle); a box with the label reprinted. Judge: the shipping label and the contents label are both readable, do not overlap each other or the tape strip or the other markers, sit inside the triangle for tetrahedrons, and each marker rectangle sits over its label. Then play the real UI (seed 1): the area under the picture shows the two hints and no address; clicking the shipping label shows the address and weight; the contents hint stays until the contents label's face is turned to and clicked; tabs: Rules / Shapes / Addresses on Day 1, and (use the generator or a later day via `preview_eval` calls on the modules if reaching Day 4 by play is too slow) Restrictions with the restricted items on Day 4; the Notes list shows "Shape: cuboid" only; no console errors. Fix what is visibly wrong in `src/ui` (rectangles, drawing, spacing) and commit each fix separately. Stop the server.

- [ ] **Step 8: Commit, then squash**

```bash
git add -A
git commit -m "Put a shipping label and a contents label on the package

Nothing about the address or the contents shows until the matching label is
found and clicked, so reading the package becomes part of inspecting it."
git reset --soft main
git commit -m "Add reference tabs, restricted items and clickable labels

The rule card gets Rules, Shapes, Addresses and Restrictions tabs that appear as
the day's rules need them. A package now has a shipping label and a separate
contents label, and neither the address nor the contents list shows until its
label is found and clicked. Rule cards can ban items, fixed by throwing them
away; wrong weight counts only the stowaways so those fixes never clash; and the
shape note names the shape only, with the description on the Shapes tab."
```
