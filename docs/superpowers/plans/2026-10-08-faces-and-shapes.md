# Faces, Rotate/Flip and Shapes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give packages faces (Rotate turns to the next face, Flip shows the other side), add triangular-prism and tetrahedron packages on later days, place defects on specific faces, and record the shape as the first note.

**Architecture:** Shape and face rules live in a small pure module (`shapes.ts`) used by the core (handling, visibility, actions, generation) and by the UI geometry. Defect visibility becomes face-aware; the canvas and screen only draw what the pure helpers say.

**Tech Stack:** TypeScript (strict), Vite, Vitest, yarn. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-08-faces-and-shapes-design.md` (extends `2026-10-08-views-and-notes-design.md`)

## Global Constraints

- `yarn` only. TDD: failing test first, watch it fail, minimal code.
- Branch `feature/faces-and-shapes` (already created from `main`). Never commit to `main`.
- Commit messages explain *why*. NO `Co-Authored-By`, no "Generated with", no signature or trailer. Never stage `.superpowers/`.
- No new dependencies. `src/game/` must not import `src/ui/` or `src/audio/` or touch the DOM. UI text via DOM APIs only, never `innerHTML`.
- Snyk is not required; do not run it.
- Every task ends with `yarn test && yarn tsc --noEmit` green (and `yarn build` for UI tasks).
- Shapes: cuboid (box, parcel) 4 up / 1 down; cylinder (can, jar, tube) 1 up / 1 down; prism 3 up / 0 down; tetra 4 up / 4 down.
- Prisms appear from Day 4 and tetrahedrons from Day 6; placements are generated from Day 2.

## File Structure

```
src/game/types.ts        PackageKind + prism/tetra, Side, Placement, Package.placements, Handling.face/visited
src/game/shapes.ts       shapes, faceCount, faceKey, placementOf, shapeNote (new)
src/game/defects.ts      kinds updated
src/game/handling.ts     face 0, visited ['up:0'], notes ['shape']
src/game/inspection.ts   face-aware visibleDefects/markerClues/revealedDefects, shape clue
src/game/shift.ts        rotateBox, flipBox (faces, shapes)
src/game/packages.ts     kindsForDay, placements, weights
src/ui/geometry.ts       bodyRect for prism/tetra, labelRect
src/ui/contents.ts       items for prism/tetra
src/ui/packageArt.ts     colors, triangle path, face caption
src/ui/markers.ts        label marker rect via labelRect
src/ui/app.ts            Rotate button, Flip button
```

---

### Task 1: New kinds and the shapes module

**Files:**
- Modify: `src/game/types.ts`, `src/game/defects.ts`, `src/game/packages.ts` (weights only), `src/ui/contents.ts`, `src/ui/geometry.ts`, `src/ui/packageArt.ts`
- Create: `src/game/shapes.ts`
- Test: `src/game/shapes.test.ts`, `src/game/defects.test.ts`, `src/ui/contents.test.ts`

**Interfaces:**
- Produces (types.ts): `PackageKind` adds `'prism' | 'tetra'`; `type Side = 'up' | 'down'`; `interface Placement { side: Side; face: number }`; `Package.placements?: Partial<Record<DefectId, Placement>>`.
- Produces (shapes.ts): `type Shape = 'cuboid' | 'cylinder' | 'prism' | 'tetra'`; `SHAPE_OF_KIND`; `faceCount(kind: PackageKind, side: Side): number`; `faceKey(side: Side, face: number): string` (`'up:2'`); `placementOf(pkg: Package, defect: DefectId): Placement`; `isUndersideDefect(defect: DefectId): boolean`; `shapeNote(kind: PackageKind): string`.

- [ ] **Step 1: Write the failing tests**

`src/game/shapes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { makePackage } from './testing';
import {
  SHAPE_OF_KIND,
  faceCount,
  faceKey,
  isUndersideDefect,
  placementOf,
  shapeNote,
} from './shapes';
import type { PackageKind } from './types';

const KINDS: PackageKind[] = ['box', 'can', 'parcel', 'jar', 'tube', 'prism', 'tetra'];

describe('shapes', () => {
  it('gives every kind a shape', () => {
    for (const kind of KINDS) expect(SHAPE_OF_KIND[kind]).toBeDefined();
  });

  it('counts faces on each side', () => {
    expect([faceCount('box', 'up'), faceCount('box', 'down')]).toEqual([4, 1]);
    expect([faceCount('parcel', 'up'), faceCount('parcel', 'down')]).toEqual([4, 1]);
    expect([faceCount('can', 'up'), faceCount('can', 'down')]).toEqual([1, 1]);
    expect([faceCount('jar', 'up'), faceCount('tube', 'down')]).toEqual([1, 1]);
    expect([faceCount('prism', 'up'), faceCount('prism', 'down')]).toEqual([3, 0]);
    expect([faceCount('tetra', 'up'), faceCount('tetra', 'down')]).toEqual([4, 4]);
  });

  it('names a face by side and index', () => {
    expect(faceKey('up', 2)).toBe('up:2');
    expect(faceKey('down', 0)).toBe('down:0');
  });

  it('puts underside defects on the down side and the rest on the up side by default', () => {
    expect(isUndersideDefect('bottomless')).toBe(true);
    expect(isUndersideDefect('wet_cardboard')).toBe(true);
    expect(isUndersideDefect('torn_tape')).toBe(false);
    expect(placementOf(makePackage({ defects: ['bottomless'] }), 'bottomless')).toEqual({ side: 'down', face: 0 });
    expect(placementOf(makePackage({ defects: ['torn_tape'] }), 'torn_tape')).toEqual({ side: 'up', face: 0 });
  });

  it('uses a stored placement when there is one', () => {
    const pkg = makePackage({
      defects: ['torn_tape'],
      placements: { torn_tape: { side: 'up', face: 2 } },
    });
    expect(placementOf(pkg, 'torn_tape')).toEqual({ side: 'up', face: 2 });
  });

  it('describes each shape in the first note', () => {
    expect(shapeNote('box')).toBe('Shape: cuboid. Four sides to rotate; flip it for the underside.');
    expect(shapeNote('parcel')).toBe(shapeNote('box'));
    expect(shapeNote('can')).toBe('Shape: cylinder. One round side; flip it for the base.');
    expect(shapeNote('prism')).toBe('Shape: triangular prism. Three sides to rotate; it cannot be flipped.');
    expect(shapeNote('tetra')).toBe('Shape: tetrahedron. Four sides to rotate; flip it for four more.');
  });
});
```

Append to `src/game/defects.test.ts`:

```ts
it('lets the new shapes carry only the defects that fit them', () => {
  const on = (kind: 'prism' | 'tetra') =>
    ALL_DEFECT_IDS.filter((id) => DEFECTS[id].kinds.includes(kind)).sort();
  expect(on('prism')).toContain('torn_tape');
  expect(on('prism')).toContain('crushed_corner');
  expect(on('prism')).not.toContain('bottomless');
  expect(on('prism')).not.toContain('wet_cardboard');
  expect(on('tetra')).toContain('bottomless');
  expect(on('tetra')).toContain('wet_cardboard');
  expect(on('tetra')).not.toContain('torn_tape');
  expect(on('tetra')).not.toContain('crushed_corner');
  expect(on('tetra')).toContain('missing_label');
});
```

Append to `src/ui/contents.test.ts`: the existing "picks an item that belongs to the package kind" and "varies" tests iterate a local `KINDS` list; extend that list to include `'prism'` and `'tetra'`.

- [ ] **Step 2: Run and see failures**

Run: `yarn test src/game/shapes.test.ts src/game/defects.test.ts src/ui/contents.test.ts`
Expected: FAIL (`./shapes` missing; new kinds unknown).

- [ ] **Step 3: Types**

In `src/game/types.ts`: `export type PackageKind = 'box' | 'can' | 'parcel' | 'jar' | 'tube' | 'prism' | 'tetra';`, add

```ts
export type Side = 'up' | 'down';

// Which face of the package a defect sits on.
export interface Placement {
  side: Side;
  face: number;
}
```
and add `placements?: Partial<Record<DefectId, Placement>>;` to `Package`.

- [ ] **Step 4: `src/game/shapes.ts`**

```ts
import type { DefectId, Package, PackageKind, Placement, Side } from './types';

export type Shape = 'cuboid' | 'cylinder' | 'prism' | 'tetra';

export const SHAPE_OF_KIND: Record<PackageKind, Shape> = {
  box: 'cuboid',
  parcel: 'cuboid',
  can: 'cylinder',
  jar: 'cylinder',
  tube: 'cylinder',
  prism: 'prism',
  tetra: 'tetra',
};

const FACES: Record<Shape, Record<Side, number>> = {
  cuboid: { up: 4, down: 1 },
  cylinder: { up: 1, down: 1 },
  prism: { up: 3, down: 0 },
  tetra: { up: 4, down: 4 },
};

export const faceCount = (kind: PackageKind, side: Side): number => FACES[SHAPE_OF_KIND[kind]][side];

export const faceKey = (side: Side, face: number): string => `${side}:${face}`;

// These live on the underside, so you only find them by flipping.
const UNDERSIDE: readonly DefectId[] = ['bottomless', 'wet_cardboard'];

export const isUndersideDefect = (defect: DefectId): boolean => UNDERSIDE.includes(defect);

export function placementOf(pkg: Package, defect: DefectId): Placement {
  return pkg.placements?.[defect] ?? { side: isUndersideDefect(defect) ? 'down' : 'up', face: 0 };
}

const SHAPE_NOTES: Record<Shape, string> = {
  cuboid: 'Shape: cuboid. Four sides to rotate; flip it for the underside.',
  cylinder: 'Shape: cylinder. One round side; flip it for the base.',
  prism: 'Shape: triangular prism. Three sides to rotate; it cannot be flipped.',
  tetra: 'Shape: tetrahedron. Four sides to rotate; flip it for four more.',
};

export const shapeNote = (kind: PackageKind): string => SHAPE_NOTES[SHAPE_OF_KIND[kind]];
```

- [ ] **Step 5: Defect kinds, weights, contents, geometry, art plumbing**

`src/game/defects.ts`: define `const ANY: readonly PackageKind[] = ['box','can','parcel','jar','tube','prism','tetra'];` (extend the existing constant), keep `FLAT = ['box','parcel']`, add `const SURFACE_SHAPES: readonly PackageKind[] = ['box','parcel','prism'];` and `const UNDERSIDE_SHAPES: readonly PackageKind[] = ['box','parcel','tetra'];`. Set `kinds: SURFACE_SHAPES` for `crushed_corner` and `torn_tape`, and `kinds: UNDERSIDE_SHAPES` for `wet_cardboard` and `bottomless`. Remove `FLAT` if it becomes unused. Other defects keep their kinds (those using `ANY` now also apply to the new kinds).

`src/game/packages.ts`: add `prism: 1.0, tetra: 0.8` to `BASE_WEIGHT_KG` (do NOT change `KINDS` yet; Task 4 does).

`src/ui/contents.ts`: add to `CONTENT_ITEMS`:

```ts
  prism: [
    { name: 'candles', art: 'sticks', color: '#f2e2b0' },
    { name: 'a toy tent', art: 'tower', color: '#d95d5d' },
    { name: 'cheese wedges', art: 'dome', color: '#f2c94c' },
  ],
  tetra: [
    { name: 'crystals', art: 'tower', color: '#8fd3f4' },
    { name: 'party hats', art: 'tower', color: '#ff7eb6' },
    { name: 'dice', art: 'book', color: '#e8e8e8' },
  ],
```

`src/ui/geometry.ts` `bodyRect`: add

```ts
    case 'prism':
      return { x: w / 2 - 90, y: floor - 95, w: 180, h: 95 };
    case 'tetra':
      return { x: w / 2 - 75, y: floor - 130, w: 150, h: 130 };
```

`src/ui/packageArt.ts`: add `prism: '#b9a0d8', tetra: '#9cc7a3'` to `BODY_COLOR`; change `flat` to `(kind) => kind === 'box' || kind === 'parcel' || kind === 'prism'`; in `bodyPath` draw a triangle for `tetra`:

```ts
function bodyPath(ctx: CanvasRenderingContext2D, pkg: Package, b: Rect): void {
  ctx.beginPath();
  if (pkg.kind === 'tetra') {
    ctx.moveTo(b.x + b.w / 2, b.y);
    ctx.lineTo(b.x + b.w, b.y + b.h);
    ctx.lineTo(b.x, b.y + b.h);
    ctx.closePath();
  } else if (flat(pkg.kind)) ctx.rect(b.x, b.y, b.w, b.h);
  else ctx.roundRect(b.x, b.y, b.w, b.h, 18);
}
```
(Fix any other exhaustive `Record<PackageKind, …>` or `switch` the compiler flags.)

- [ ] **Step 6: Run everything**

Run: `yarn test && yarn tsc --noEmit && yarn build`
Expected: PASS. Existing generator tests still pass because `KINDS` is unchanged (no prism/tetra yet).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Add prism and tetra kinds and a module that knows each shape's faces

Shapes decide how many faces a package has, so the rules, generator and drawing
can share one source of truth before anything starts using the new kinds."
```

---

### Task 2: Faces in handling and visibility

**Files:**
- Modify: `src/game/types.ts` (Handling), `src/game/handling.ts`, `src/game/inspection.ts`
- Test: `src/game/handling.test.ts`, `src/game/inspection.test.ts`, plus existing tests this legitimately changes

**Interfaces:**
- Consumes: `faceKey`, `placementOf`, `shapeNote` (Task 1).
- Produces:
  - `Handling` gains `face: number` (index of the face showing on the current side) and `visited: string[]` (face keys the player has shown). `newHandling()` returns `face: 0`, `visited: ['up:0']`, `notes: ['shape']`.
  - `ClueSource` gains `'shape'`; `notedClues` includes the shape clue `{ key: 'shape', source: 'shape', defect: null, channel: 'reading', text: shapeNote(kind) }`.
  - `visibleDefects`, `markerClues`, `revealedDefects` become face-aware as in the spec.

- [ ] **Step 1: Write the failing tests**

Update `src/game/handling.test.ts` `newHandling` expectation to include `face: 0`, `visited: ['up:0']`, `notes: ['shape']`.

Append to `src/game/inspection.test.ts` (adjust the existing import to add what is missing):

```ts
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
```

- [ ] **Step 2: Run and see failures**

Run: `yarn test src/game/handling.test.ts src/game/inspection.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/game/types.ts` `Handling`: add `face: number; // index of the face showing on the current side` and `visited: string[]; // face keys the player has shown (e.g. 'up:0')`.

`src/game/handling.ts`:

```ts
export function newHandling(): Handling {
  return {
    opened: false,
    flipped: false,
    fined: false,
    face: 0,
    visited: ['up:0'],
    used: ['look'],
    repaired: [],
    relabeled: false,
    notes: ['shape'], // the shape is always the first note
  };
}
```
(`viewOf` is unchanged.)

`src/game/inspection.ts`: add imports `faceKey, placementOf, shapeNote` from `./shapes` and `Side` from `./types`; change `ClueSource` to `InspectionTool | 'inside' | 'shape'`; replace `VIEW_TOOLS` with two tables and rewrite `revealedDefects`, `visibleDefects`, `markerClues` and `notedClues`:

```ts
// The tools that reveal a surface defect while its face is showing.
const FACE_TOOLS: Record<'front' | 'back', readonly InspectionTool[]> = {
  front: ['look', 'uv'],
  back: ['rotate', 'uv'],
};
// The tools whose clues a marker can record in each outside view (the pebble works on any up face).
const CLUE_TOOLS: Record<'front' | 'back', readonly InspectionTool[]> = {
  front: ['look', 'uv', 'pebble'],
  back: ['rotate', 'uv'],
};
const SURFACE_TOOLS: readonly InspectionTool[] = ['look', 'uv', 'rotate'];

const shapeClue = (pkg: Package): Clue => ({
  key: 'shape',
  source: 'shape',
  defect: null,
  channel: 'reading',
  text: shapeNote(pkg.kind),
});

// Defects the player knows about: seen on a face they have shown, found by a non-surface tool,
// or visible because the box is open.
export function revealedDefects(pkg: Package, handling: Handling): DefectId[] {
  return pkg.defects.filter((id) => {
    if (handling.repaired.includes(id)) return false;
    const def = DEFECTS[id];
    const tools = Object.keys(def.clues) as InspectionTool[];
    const p = placementOf(pkg, id);
    const seen = handling.visited.includes(faceKey(p.side, p.face));
    const bySurface = seen && tools.some((t) => SURFACE_TOOLS.includes(t) && handling.used.includes(t));
    const byOther = tools.some((t) => !SURFACE_TOOLS.includes(t) && handling.used.includes(t));
    return bySurface || byOther || (handling.opened && def.insideClue !== undefined);
  });
}

// Defects with a drawn marker in the given view, on the face that is showing.
export function visibleDefects(pkg: Package, handling: Handling, view: View): DefectId[] {
  return pkg.defects.filter((id) => {
    if (handling.repaired.includes(id)) return false;
    const def = DEFECTS[id];
    if (view === 'inside') return def.insideClue !== undefined;
    const side: Side = view === 'front' ? 'up' : 'down';
    const p = placementOf(pkg, id);
    const onThisFace = p.side === side && p.face === handling.face;
    const bySurface =
      onThisFace && FACE_TOOLS[view].some((t) => def.clues[t] !== undefined && handling.used.includes(t));
    const dropped = view === 'front' && def.clues.pebble !== undefined && handling.used.includes('pebble');
    return bySurface || dropped;
  });
}

// What clicking a defect's marker in this view records.
export function markerClues(pkg: Package, handling: Handling, defect: DefectId, view: View): Clue[] {
  if (view === 'inside') {
    return insideCluesFor(pkg, handling.repaired).filter((c) => c.defect === defect);
  }
  if (!visibleDefects(pkg, handling, view).includes(defect)) return [];
  return CLUE_TOOLS[view]
    .filter((t) => handling.used.includes(t))
    .flatMap((t) => cluesFor(pkg, t, handling.repaired))
    .filter((c) => c.defect === defect);
}

// The clues the player has recorded, in the order they recorded them.
export function notedClues(pkg: Package, handling: Handling): Clue[] {
  const known = [
    shapeClue(pkg),
    ...handling.used.flatMap((t) => cluesFor(pkg, t, handling.repaired)),
    ...insideCluesFor(pkg, handling.repaired),
  ];
  return handling.notes
    .map((key) => known.find((c) => c.key === key))
    .filter((c): c is Clue => c !== undefined);
}
```
Delete the old `VIEW_TOOLS`.

- [ ] **Step 4: Fix what the new state legitimately changes**

Run `yarn test && yarn tsc --noEmit` and fix, without weakening any assertion:
- Tests that expected `currentNotes(...)` / `notedClues(...)` to be empty now expect the shape note first (e.g. `['shape']`, then the rest).
- Tests that build a flipped/used handling and rely on a defect being *revealed* by flipping (repair tests with `used: ['look','rotate']` and `bottomless` or `wet_cardboard`) must also set `visited: ['up:0', 'down:0']` (flipping shows the underside). Prefer `{ ...newHandling(), flipped: true, visited: ['up:0','down:0'], used: [...] }`.
- Any literal `Handling` object gains `face` and `visited`.

- [ ] **Step 5: Run everything and commit**

Run: `yarn test && yarn tsc --noEmit && yarn build` → PASS.

```bash
git add -A
git commit -m "Make defect visibility depend on which face is showing

Faces only matter if a defect can hide on one, so markers, clues and repair
gating now follow the face on screen, and the shape is always the first note."
```

---

### Task 3: Rotate and Flip actions

**Files:**
- Modify: `src/game/shift.ts`
- Test: `src/game/shift.test.ts`

**Interfaces:**
- Consumes: `faceCount`, `faceKey` (Task 1), `Handling.face/visited` (Task 2).
- Produces: `rotateBox(s): ActionResult`; `flipBox` updated (resets the face, adds the visited face, refuses shapes that cannot flip).

- [ ] **Step 1: Write the failing tests** (append to `src/game/shift.test.ts`; it already has `shiftWith`, `tools`, `clean`, `makePackage`; add imports `rotateBox`)

```ts
describe('rotateBox', () => {
  const cuboid = makePackage({ kind: 'box' });
  const withRotate = (pkg = cuboid) => shiftWith([pkg], 3, tools('rotate'));

  it('needs the rotate tool', () => {
    expect(rotateBox(shiftWith([cuboid])).message).toBe('You do not own that tool.');
  });

  it('is refused while the box is open', () => {
    expect(rotateBox(openBox(withRotate()).state).message).toBe('Close the box first.');
  });

  it('turns through the four sides of a cuboid and wraps around', () => {
    let s = withRotate();
    const seen: number[] = [];
    for (let i = 0; i < 5; i++) {
      s = rotateBox(s).state;
      seen.push(s.handling.face);
    }
    expect(seen).toEqual([1, 2, 3, 0, 1]);
    expect(s.handling.visited).toEqual(['up:0', 'up:1', 'up:2', 'up:3']);
  });

  it('says so when a shape has only one side', () => {
    const can = makePackage({ kind: 'can' });
    const r = rotateBox(withRotate(can));
    expect(r.message).toBe('This shape has only one side to turn.');
    expect(r.state.handling.face).toBe(0);
  });

  it('turns through three sides on a prism and four on a tetrahedron', () => {
    let p = withRotate(makePackage({ kind: 'prism' }));
    p = rotateBox(rotateBox(rotateBox(p).state).state).state;
    expect(p.handling.face).toBe(0);
    let t = withRotate(makePackage({ kind: 'tetra' }));
    for (let i = 0; i < 3; i++) t = rotateBox(t).state;
    expect(t.handling.face).toBe(3);
  });

  it('rotates the down faces of a flipped tetrahedron', () => {
    let t = flipBox(withRotate(makePackage({ kind: 'tetra' }))).state;
    t = rotateBox(rotateBox(t).state).state;
    expect(t.handling.face).toBe(2);
    expect(t.handling.visited).toEqual(['up:0', 'down:0', 'down:1', 'down:2']);
  });
});

describe('flipBox with faces', () => {
  it('shows face 1 of the other side and remembers it was seen', () => {
    let s = shiftWith([makePackage({ kind: 'tetra' })], 6, tools('rotate'));
    s = rotateBox(rotateBox(s).state).state; // up face 3
    s = flipBox(s).state;
    expect(s.handling.flipped).toBe(true);
    expect(s.handling.face).toBe(0);
    expect(s.handling.visited).toContain('down:0');
    s = flipBox(s).state;
    expect(s.handling.flipped).toBe(false);
    expect(s.handling.face).toBe(0);
  });

  it('refuses a shape with no underside', () => {
    const s = shiftWith([makePackage({ kind: 'prism' })], 4, tools('rotate'));
    const r = flipBox(s);
    expect(r.message).toBe('This shape cannot be flipped.');
    expect(r.state.handling.flipped).toBe(false);
  });
});
```


- [ ] **Step 2: Run and see failures**

Run: `yarn test src/game/shift.test.ts`
Expected: FAIL (`rotateBox` missing; flip refuses nothing).

- [ ] **Step 3: Implement in `src/game/shift.ts`**

Import `faceCount, faceKey` from `./shapes` and `Side` from `./types`. Add a helper and rewrite `flipBox`:

```ts
const withVisited = (visited: string[], side: Side, face: number): string[] => {
  const key = faceKey(side, face);
  return visited.includes(key) ? visited : [...visited, key];
};

export function rotateBox(s: ShiftState): ActionResult {
  const pkg = currentPackage(s);
  if (!pkg) return idle(s);
  if (!s.inventory.tools.includes('rotate')) return { state: s, message: 'You do not own that tool.' };
  if (s.handling.opened) return { state: s, message: 'Close the box first.' };
  const side: Side = s.handling.flipped ? 'down' : 'up';
  const count = faceCount(pkg.kind, side);
  if (count <= 1) return { state: s, message: 'This shape has only one side to turn.' };
  const face = (s.handling.face + 1) % count;
  return {
    state: {
      ...s,
      handling: { ...s.handling, face, visited: withVisited(s.handling.visited, side, face) },
    },
    message: `You turn it to side ${face + 1} of ${count}.`,
  };
}

export function flipBox(s: ShiftState): ActionResult {
  const pkg = currentPackage(s);
  if (!pkg) return idle(s);
  if (!s.inventory.tools.includes('rotate')) return { state: s, message: 'You do not own that tool.' };
  if (s.handling.opened) return { state: s, message: 'Close the box first.' };
  if (!s.handling.flipped && faceCount(pkg.kind, 'down') === 0) {
    return { state: s, message: 'This shape cannot be flipped.' };
  }
  const flipped = !s.handling.flipped;
  const used = s.handling.used.includes('rotate') ? s.handling.used : [...s.handling.used, 'rotate' as const];
  return {
    state: {
      ...s,
      handling: {
        ...s.handling,
        flipped,
        face: 0,
        used,
        visited: withVisited(s.handling.visited, flipped ? 'down' : 'up', 0),
      },
    },
    message: flipped ? 'You flip the box over.' : 'You turn the box back over.',
  };
}
```

- [ ] **Step 4: Run everything and commit**

Run: `yarn test && yarn tsc --noEmit` → PASS.

```bash
git add -A
git commit -m "Add Rotate and give Flip face-aware rules

Rotate steps through the faces on the side showing and Flip switches sides, so
shapes with more faces really take more turning to inspect."
```

---

### Task 4: Generate the new shapes and place defects on faces

**Files:**
- Modify: `src/game/packages.ts`, `src/game/playthrough.test.ts`
- Test: `src/game/packages.test.ts`

**Interfaces:**
- Consumes: `faceCount`, `isUndersideDefect` (Task 1), `Package.placements`.
- Produces: `kindsForDay(day: number): PackageKind[]`; `generatePackage` picks kinds from it and sets `placements` from Day 2.

- [ ] **Step 1: Write the failing tests** (append to `src/game/packages.test.ts`; it has a `sample(day, n)` helper)

```ts
import { faceCount } from './shapes';
import { kindsForDay } from './packages';

describe('shapes by day', () => {
  it('uses the five original kinds on days 1 to 3, adds prisms on day 4 and tetrahedrons on day 6', () => {
    for (const day of [1, 2, 3]) expect(kindsForDay(day)).toEqual(['box', 'can', 'parcel', 'jar', 'tube']);
    expect(kindsForDay(4)).toEqual(['box', 'can', 'parcel', 'jar', 'tube', 'prism']);
    expect(kindsForDay(5)).toContain('prism');
    expect(kindsForDay(5)).not.toContain('tetra');
    expect(kindsForDay(6)).toContain('tetra');
    expect(kindsForDay(7)).toContain('tetra');
  });

  it('only generates a shape once it is unlocked, and does generate it afterwards', () => {
    const kinds = (day: number) => new Set(sample(day, 400).map((p) => p.kind));
    expect(kinds(3).has('prism')).toBe(false);
    expect(kinds(5).has('tetra')).toBe(false);
    expect(kinds(4).has('prism')).toBe(true);
    expect(kinds(6).has('tetra')).toBe(true);
  });
});

describe('defect placements', () => {
  it('places nothing on day 1', () => {
    for (const p of sample(1, 300)) expect(p.placements).toBeUndefined();
  });

  it('spreads surface defects over the up faces and underside defects over the down faces from day 2', () => {
    const surface = ['leaking', 'crushed_corner', 'torn_tape', 'bulging', 'missing_label'];
    const under = ['bottomless', 'wet_cardboard'];
    let sawFaceBeyondFirst = false;
    for (const day of [2, 3, 5, 7]) {
      for (const p of sample(day, 400)) {
        for (const id of p.defects) {
          const placed = p.placements?.[id];
          if (surface.includes(id)) {
            expect(placed?.side).toBe('up');
            expect(placed!.face).toBeLessThan(faceCount(p.kind, 'up'));
            if (placed!.face > 0) sawFaceBeyondFirst = true;
          } else if (under.includes(id)) {
            expect(placed?.side).toBe('down');
            expect(placed!.face).toBeLessThan(faceCount(p.kind, 'down'));
          } else {
            expect(placed).toBeUndefined();
          }
        }
      }
    }
    expect(sawFaceBeyondFirst).toBe(true);
  });
});
```

- [ ] **Step 2: Run and see failures**

Run: `yarn test src/game/packages.test.ts` → FAIL (`kindsForDay` missing).

- [ ] **Step 3: Implement in `src/game/packages.ts`**

Import `faceCount, isUndersideDefect` from `./shapes` and `Placement` from `./types`. Replace the `KINDS` constant and add:

```ts
const BASE_KINDS: readonly PackageKind[] = ['box', 'can', 'parcel', 'jar', 'tube'];

// New shapes arrive as the days go on.
export function kindsForDay(day: number): PackageKind[] {
  return [...BASE_KINDS, ...(day >= 4 ? (['prism'] as const) : []), ...(day >= 6 ? (['tetra'] as const) : [])];
}

const SURFACE_DEFECTS: readonly DefectId[] = [
  'leaking',
  'crushed_corner',
  'torn_tape',
  'bulging',
  'missing_label',
];

// From day 2 the Rotate / flip tool is on sale, so defects start hiding on other faces.
function placeDefects(rng: Rng, kind: PackageKind, defects: DefectId[], day: number): Package['placements'] {
  if (day < 2) return undefined;
  const placements: Partial<Record<DefectId, Placement>> = {};
  for (const id of defects) {
    if (SURFACE_DEFECTS.includes(id)) {
      placements[id] = { side: 'up', face: rng.int(faceCount(kind, 'up')) };
    } else if (isUndersideDefect(id) && faceCount(kind, 'down') > 0) {
      placements[id] = { side: 'down', face: rng.int(faceCount(kind, 'down')) };
    }
  }
  return Object.keys(placements).length > 0 ? placements : undefined;
}
```
In `generatePackage`: `const kind = rng.pick(kindsForDay(card.day));` and, after choosing `defects`, `const placements = placeDefects(rng, kind, defects, card.day);`; add `...(placements ? { placements } : {})` to the returned object. (Do not reorder existing rng calls beyond adding the placement draw after the defects are chosen and before the address.)

- [ ] **Step 4: Update the playthrough bot** (`src/game/playthrough.test.ts`)

The bot must see every face so it can find defects wherever they sit. Replace the existing "flip then flip back" block in `playShiftPerfectly` with a full sweep, keeping the inspect loop and all assertions:

```ts
    if (s.inventory.tools.includes('rotate')) {
      const sweep = (): void => {
        // Show every face on the side that is showing.
        for (let i = 0; i < 4; i++) s = rotateBox(s).state;
      };
      sweep(); // up faces (wraps back to face 1)
      const flipped = flipBox(s);
      if (flipped.state.handling.flipped) {
        s = flipped.state;
        sweep(); // down faces
        s = flipBox(s).state; // back face up
      }
    }
```
and import `rotateBox`. The sweep rotates 4 times; on a cuboid that visits all four sides and returns to face 1, on a 3-face prism it goes around once and a bit more, on a 1-face shape it does nothing (refusal is harmless). All earlier assertions stay (opened > 0, repaired > 0, refused === 0, zero strikes and fines, positive bank).

- [ ] **Step 5: Run everything and commit**

Run: `yarn test && yarn tsc --noEmit && yarn build` → PASS. If a playthrough seed now fails an assertion, report the real cause (a rule interaction) instead of weakening the assertion.

```bash
git add -A
git commit -m "Generate prisms and tetrahedrons later and hide defects on faces

New shapes appear on Days 4 and 6, and from Day 2 defects hide on specific faces
so Rotate and Flip are needed to find them."
```

---

### Task 5: Drawing, the Rotate button, and the visual check

**Files:**
- Modify: `src/ui/geometry.ts`, `src/ui/markers.ts`, `src/ui/packageArt.ts`, `src/ui/app.ts`, `src/styles.css` (if needed)
- Test: `src/ui/markers.test.ts`

**Interfaces:**
- Produces: `labelRect(kind: PackageKind, b: Rect): Rect` in `geometry.ts` (default `{x: b.x+b.w*0.2, y: b.y+b.h*0.4, w: b.w*0.6, h: b.h*0.3}`; tetra `{x: b.x+b.w*0.3, y: b.y+b.h*0.62, w: b.w*0.4, h: b.h*0.26}`), used by both the art and the `missing_label` marker.

- [ ] **Step 1: Write the failing tests** (append to `src/ui/markers.test.ts`; add imports `labelRect`)

```ts
describe('new shapes', () => {
  it('puts the missing-label marker on the label rectangle for every kind', () => {
    for (const kind of ['box', 'can', 'parcel', 'jar', 'tube', 'prism', 'tetra'] as const) {
      const body = bodyRect(kind, W, H);
      const pkg = makePackage({ kind, defects: ['missing_label'] });
      const [m] = markersFor(pkg, front, W, H);
      expect(m.rect, kind).toEqual(labelRect(kind, body));
    }
  });

  it('keeps every marker of a prism and a tetrahedron inside the canvas', () => {
    const faceHandlings = [
      { ...front, used: ['look' as const, 'uv' as const, 'pebble' as const] },
      { ...flipped, face: 2 },
      open,
    ];
    for (const kind of ['prism', 'tetra'] as const) {
      for (const h of faceHandlings) {
        for (const m of markersFor(makePackage({ kind, defects: ['missing_label', 'bottomless', 'torn_tape'] }), h, W, H)) {
          expect(m.rect.x + m.rect.w).toBeLessThanOrEqual(W);
          expect(m.rect.y + m.rect.h).toBeLessThanOrEqual(H);
          expect(m.rect.x).toBeGreaterThanOrEqual(0);
          expect(m.rect.y).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
});
```
Note `makePackage({ kind: 'tetra', defects: ['torn_tape'] })` is not a legal generated package but the markers module does not validate kinds; the second test only checks bounds.

- [ ] **Step 2: Run and see failures**

Run: `yarn test src/ui/markers.test.ts` → FAIL (`labelRect` missing).

- [ ] **Step 3: Implement geometry and art**

`src/ui/geometry.ts`: add

```ts
// Where the contents label goes (or is missing). A tetrahedron's is lower, where the triangle is wide.
export function labelRect(kind: PackageKind, b: Rect): Rect {
  if (kind === 'tetra') return { x: b.x + b.w * 0.3, y: b.y + b.h * 0.62, w: b.w * 0.4, h: b.h * 0.26 };
  return { x: b.x + b.w * 0.2, y: b.y + b.h * 0.4, w: b.w * 0.6, h: b.h * 0.3 };
}
```
`src/ui/markers.ts`: change `missing_label` in the `FRONT` table to a function of the kind: make `OnBody` take `(b: Rect, kind: PackageKind)`, call `fn(body, pkg.kind)` where the table is used, and set `missing_label: (b, kind) => labelRect(kind, b)` (import `labelRect` and `PackageKind`; other entries ignore the second argument). Remove the unreachable `wet_cardboard` entry from `FRONT` (underside defects only have back markers now; the front `bottomless` entry stays for the pebble).

`src/ui/packageArt.ts`:
1. `drawFront`: replace the hard-coded label rectangle with `const label = labelRect(pkg.kind, b)`, and draw the two text lines inside it using `label.x + label.w * 0.15`, `label.y + label.h * 0.2` etc. (keep the look: `ctx.fillRect(label.x + label.w * 0.1, label.y + label.h * 0.3, label.w * 0.8, 3)` and `(… label.y + label.h * 0.65, label.w * 0.55, 3)`). Draw the tape strip only for `flat(pkg.kind)` (already so).
2. Add a face caption to `drawFront` and `drawBack`, using `faceCount` from `../game/shapes`:

```ts
function drawCaption(ctx: CanvasRenderingContext2D, pkg: Package, handling: Handling): void {
  const side = handling.flipped ? 'down' : 'up';
  const count = faceCount(pkg.kind, side);
  if (count <= 1 && !handling.flipped) return; // a one-face front needs no caption
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  const word = handling.flipped ? 'Underside' : 'Side';
  ctx.fillText(count > 1 ? `${word} ${handling.face + 1} of ${count}` : word, 10, 16);
}
```
Call it at the end of `drawFront` and replace the fixed `'Other side'` text in `drawBack` with it.
3. Give each face a slightly different shade so a turn is visible: in `drawFront`, fill with `darken(BODY_COLOR[pkg.kind], 1 - 0.06 * (handling.face % 4))` instead of the flat color (the `darken` helper already exists; `1` means unchanged).

- [ ] **Step 4: The Rotate button** (`src/ui/app.ts`)

Import `rotateBox` and `faceCount`/`SHAPE`-free helpers from `../game/shapes` (`faceCount`). In the inspect row, replace the single Flip button block with two buttons:

```ts
      ...(ownsFlip
        ? [
            button(
              rotateLabel(pkg, s.handling),
              act(rotateBox),
              view === 'inside' || faceCount(pkg.kind, view === 'back' ? 'down' : 'up') <= 1,
            ),
            button(
              view === 'back' ? 'Flip box back' : 'Flip box',
              act(flipBox),
              view === 'inside' || (view === 'front' && faceCount(pkg.kind, 'down') === 0),
            ),
          ]
        : []),
```
and define near the top of the file:

```ts
const rotateLabel = (pkg: Package, h: Handling): string => {
  const count = faceCount(pkg.kind, h.flipped ? 'down' : 'up');
  return count > 1 ? `Rotate (${h.face + 1}/${count})` : 'Rotate';
};
```
(import the `Package` and `Handling` types from `../game/types`). Remove now-unused imports; `yarn tsc --noEmit` must be clean.

- [ ] **Step 5: Run everything**

Run: `yarn test && yarn tsc --noEmit && yarn build` → PASS.

- [ ] **Step 6: Visual check in the browser preview**

Start the server (`preview_start` name `pack-inspect`). In `preview_eval`, import `/src/ui/packageArt.ts` and `/src/ui/markers.ts` (append `?t=`+Date.now()) and render a gallery on scratch canvases with the marker rectangles outlined in yellow: every kind (box, parcel, can, jar, tube, prism, tetra) front face 1; a box on faces 1-4 with `torn_tape` placed on face 3; a tetra on up faces 1-4 and its flipped faces 1-4 with `wet_cardboard` on down face 2; a prism on three faces; a tetra with `missing_label`; each of the new kinds opened (inside). Check that: the triangle and prism read as different shapes, the caption reads right ("Side 2 of 4", "Underside 3 of 4"), every marker rectangle sits over its drawing, and nothing is clipped. Adjust the rectangles in `src/ui/markers.ts` / geometry and re-run `yarn test src/ui/markers.test.ts` where they miss. Then play the real game on a seed that reaches Day 4 and Day 6 or call the generator directly in `preview_eval` to confirm prisms and tetrahedrons appear, that Rotate steps through the faces (button label shows `Rotate (2/4)`), that Rotate is disabled for a cylinder, that Flip is disabled for a prism, that the first note is the shape, and check `preview_console_logs` for errors. Stop the server.

- [ ] **Step 7: Commit, then squash**

Commit visual fixes separately with messages that explain why. Then squash the whole branch into one commit on top of `main`:

```bash
git reset --soft main
git commit -m "Add Rotate, faces, and prism and tetrahedron packages

Rotate now turns a package to its next face and Flip shows the other side, so
shapes differ: cylinders have one side, prisms three and cannot flip, and
tetrahedrons have four faces on each side. Defects hide on specific faces from
Day 2, prisms arrive on Day 4 and tetrahedrons on Day 6, and the first note of
every package is its shape."
```
