# Orientation (Flip and Rotate) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two-state flip with the flip cycles (side, top, upside-down side, bottom) and a running rotation count, show no position hints, draw the top, bottom, upside-down and spun faces, and draw a repair patch only on the face where the defect was fixed.

**Architecture:** Orientation is two counters (`flipPos`, `turn`); a pure `shownFace` function says which face is on show, and `orient` keeps the existing derived fields (`flipped`, `face`, `upsideDown`, `spin`) consistent so the view, visibility and marker code keeps working. One pure `markerRectFor` gives where a defect is on the shown face, shared by the markers and the patch drawing.

**Tech Stack:** TypeScript (strict), Vite, Vitest, yarn. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-08-orientation-design.md`

## Global Constraints

- `yarn` only. TDD: failing test first, watch it fail, minimal code.
- Branch `feature/orientation` (already created from `main`). Never commit to `main`.
- Commit messages explain *why*. NO `Co-Authored-By`, no "Generated with", no signature or trailer. Never stage `.superpowers/`.
- No new dependencies. `src/game/` must not import `src/ui/` or `src/audio/` or touch the DOM. UI text via DOM APIs only, never `innerHTML`.
- Snyk is not required; do not run it.
- Every task ends with `yarn test && yarn tsc --noEmit && yarn build` green.
- The player is never told which face, side or flip they are on: no "Side 2 of 4", no `Rotate (2/4)`, no numbers in messages, no per-face shading.
- Rotate delta: +1 in flip positions 0 and 1, -1 in positions 2 and 3 (shapes with a four-position ring); +1 always for prisms and tetrahedrons.

## File Structure

```
src/game/shapes.ts       sideCount, ringLength, hasTop, shownFace, rotateDelta, orient; faceCount updated
src/game/types.ts        Handling.flipPos/turn/upsideDown/spin
src/game/handling.ts     newHandling
src/game/shift.ts        rotateBox, flipBox, openBox, inspect, readLabel
src/game/packages.ts     placements (torn-tape top, sides), labelFace over sides
src/ui/geometry.ts       faceSquare, rotateRect
src/ui/markers.ts        markerRectFor, markersFor, labelMarkersFor (top, bottom, upside-down, spin)
src/ui/packageArt.ts     top, bottom, upside-down, spin; patches on their own face; no caption or shading
src/ui/reference.ts      shape descriptions
src/ui/app.ts            plain Rotate and Flip buttons
```

---

### Task 1: The orientation model

**Files:**
- Modify: `src/game/shapes.ts`, `src/game/types.ts`, `src/game/handling.ts`
- Test: `src/game/shapes.test.ts`, `src/game/handling.test.ts`

**Interfaces:**
- Produces (shapes.ts): `sideCount(kind): number` (cuboid 4, cylinder 1, prism 3, tetra 4); `ringLength(kind): number` (cuboid 4, cylinder 4, prism 1, tetra 2); `hasTop(kind): boolean` (cuboid, cylinder); `type FacePart = 'side' | 'top' | 'bottom'`; `interface Shown { placement: Placement; part: FacePart; upsideDown: boolean; spin: number }`; `shownFace(kind, flipPos: number, turn: number): Shown`; `rotateDelta(kind, flipPos: number): 1 | -1`; `interface Orientation { flipPos: number; turn: number; flipped: boolean; face: number; upsideDown: boolean; spin: number }`; `orient(kind, flipPos, turn): Orientation`.
- Changes: `faceCount(kind, side)` counts placement indices: cuboid up 5 (sides 0-3, top 4) / down 1; cylinder up 2 (side 0, top 1) / down 1; prism up 3 / down 0; tetra up 4 / down 4.
- Changes (types.ts / handling.ts): `Handling` gains `flipPos: number`, `turn: number`, `upsideDown: boolean`, `spin: number`; `newHandling()` returns `flipPos: 0, turn: 0, upsideDown: false, spin: 0` (and still `flipped: false, face: 0`). `flipped` and `face` are now derived: they always equal what `orient` returns.

- [ ] **Step 1: Write the failing tests**

Update `src/game/shapes.test.ts`: the existing `counts faces on each side` test becomes

```ts
  it('counts placement faces on each side, including the top', () => {
    expect([faceCount('box', 'up'), faceCount('box', 'down')]).toEqual([5, 1]);
    expect([faceCount('parcel', 'up'), faceCount('parcel', 'down')]).toEqual([5, 1]);
    expect([faceCount('can', 'up'), faceCount('can', 'down')]).toEqual([2, 1]);
    expect([faceCount('jar', 'up'), faceCount('tube', 'down')]).toEqual([2, 1]);
    expect([faceCount('prism', 'up'), faceCount('prism', 'down')]).toEqual([3, 0]);
    expect([faceCount('tetra', 'up'), faceCount('tetra', 'down')]).toEqual([4, 4]);
  });
```
and append:

```ts
describe('orientation', () => {
  const at = (kind: PackageKind, flipPos: number, turn: number) => {
    const s = shownFace(kind, flipPos, turn);
    return `${s.placement.side}:${s.placement.face}${s.upsideDown ? ' upside-down' : ''}`;
  };

  it('has side counts, ring lengths and tops per shape', () => {
    expect([sideCount('box'), sideCount('can'), sideCount('prism'), sideCount('tetra')]).toEqual([4, 1, 3, 4]);
    expect([ringLength('box'), ringLength('tube'), ringLength('prism'), ringLength('tetra')]).toEqual([4, 4, 1, 2]);
    expect([hasTop('box'), hasTop('jar'), hasTop('prism'), hasTop('tetra')]).toEqual([true, true, false, false]);
  });

  it('flips a box through side, top, upside-down opposite side, bottom (face 1)', () => {
    expect([0, 1, 2, 3, 4].map((p) => at('box', p, 0))).toEqual([
      'up:0',
      'up:4',
      'up:2 upside-down',
      'down:0',
      'up:0',
    ]);
  });

  it('flips a box the same way from face 2', () => {
    expect([0, 1, 2, 3].map((p) => at('parcel', p, 1))).toEqual(['up:1', 'up:4', 'up:3 upside-down', 'down:0']);
  });

  it('flips a cylinder through side, top, upside-down side, bottom', () => {
    expect([0, 1, 2, 3, 4].map((p) => at('can', p, 0))).toEqual([
      'up:0',
      'up:1',
      'up:0 upside-down',
      'down:0',
      'up:0',
    ]);
  });

  it('turns the other way once the package is upside-down or at the bottom', () => {
    expect([0, 1, 2, 3].map((p) => rotateDelta('box', p))).toEqual([1, 1, -1, -1]);
    expect([0, 1, 2, 3].map((p) => rotateDelta('can', p))).toEqual([1, 1, -1, -1]);
    expect([0, 1].map((p) => rotateDelta('tetra', p))).toEqual([1, 1]);
    expect(rotateDelta('prism', 0)).toBe(1);
  });

  it('follows the worked example: face 1, top, rotate, upside-down face 4, bottom, rotate, face 1', () => {
    let pos = 0;
    let turn = 0;
    const seen: string[] = [at('box', pos, turn)];
    const flip = () => { pos = (pos + 1) % ringLength('box'); seen.push(at('box', pos, turn)); };
    const rotate = () => { turn += rotateDelta('box', pos); seen.push(at('box', pos, turn)); };
    flip(); // top
    rotate(); // spins on the top
    flip(); // upside-down face 4
    flip(); // bottom
    rotate(); // reverse spin
    flip(); // face 1
    expect(seen).toEqual([
      'up:0',
      'up:4',
      'up:4',
      'up:3 upside-down',
      'down:0',
      'down:0',
      'up:0',
    ]);
  });

  it('rotating on a side upright steps through the four sides and wraps', () => {
    expect([0, 1, 2, 3, 4, 5].map((t) => at('box', 0, t))).toEqual(['up:0', 'up:1', 'up:2', 'up:3', 'up:0', 'up:1']);
    expect([0, 1, 2, 3].map((t) => at('prism', 0, t))).toEqual(['up:0', 'up:1', 'up:2', 'up:0']);
  });

  it('keeps an upside-down package upside-down while rotating and shows other sides', () => {
    expect([0, -1, -2].map((t) => at('box', 2, t))).toEqual([
      'up:2 upside-down',
      'up:1 upside-down',
      'up:0 upside-down',
    ]);
  });

  it('spins the top one way and the bottom the other', () => {
    expect(shownFace('box', 1, 1).spin).toBe(1);
    expect(shownFace('box', 1, 5).spin).toBe(1);
    expect(shownFace('box', 3, 1).spin).toBe(3);
    expect(shownFace('box', 0, 3).spin).toBe(0);
  });

  it('flips a tetrahedron between four up faces and four down faces and never upside-down', () => {
    expect([0, 1, 0].map((p) => at('tetra', p, 2))).toEqual(['up:2', 'down:2', 'up:2']);
    expect(shownFace('tetra', 1, 0).part).toBe('bottom');
  });

  it('never flips a prism', () => {
    expect(at('prism', 0, 4)).toBe('up:1');
    expect(at('prism', 3, 4)).toBe('up:1'); // a stray position collapses back to the only one
  });

  it('derives flipped, face, upsideDown and spin from the position and turn', () => {
    expect(orient('box', 1, 1)).toEqual({ flipPos: 1, turn: 1, flipped: false, face: 4, upsideDown: false, spin: 1 });
    expect(orient('box', 2, 0)).toEqual({ flipPos: 2, turn: 0, flipped: false, face: 2, upsideDown: true, spin: 0 });
    expect(orient('box', 3, 0)).toEqual({ flipPos: 3, turn: 0, flipped: true, face: 0, upsideDown: false, spin: 0 });
    expect(orient('tetra', 1, 3)).toEqual({ flipPos: 1, turn: 3, flipped: true, face: 3, upsideDown: false, spin: 0 });
  });
});
```
(imports: `PackageKind` from `./types`; `sideCount, ringLength, hasTop, shownFace, rotateDelta, orient` from `./shapes`.)

Update `src/game/handling.test.ts` `newHandling` expectation: add `flipPos: 0, turn: 0, upsideDown: false, spin: 0`.

- [ ] **Step 2: Run and see failures**

Run: `yarn test src/game/shapes.test.ts src/game/handling.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/game/shapes.ts`**

Change `FACES` and add the model (keep everything else in the file):

```ts
const FACES: Record<Shape, Record<Side, number>> = {
  cuboid: { up: 5, down: 1 }, // four sides and the top / the bottom
  cylinder: { up: 2, down: 1 }, // the round side and the top / the bottom
  prism: { up: 3, down: 0 },
  tetra: { up: 4, down: 4 },
};

const SIDE_COUNT: Record<Shape, number> = { cuboid: 4, cylinder: 1, prism: 3, tetra: 4 };
// How many positions a flip cycles through.
const RING_LENGTH: Record<Shape, number> = { cuboid: 4, cylinder: 4, prism: 1, tetra: 2 };

export const sideCount = (kind: PackageKind): number => SIDE_COUNT[SHAPE_OF_KIND[kind]];
export const ringLength = (kind: PackageKind): number => RING_LENGTH[SHAPE_OF_KIND[kind]];
export const hasTop = (kind: PackageKind): boolean => {
  const shape = SHAPE_OF_KIND[kind];
  return shape === 'cuboid' || shape === 'cylinder';
};

const mod = (n: number, m: number): number => ((n % m) + m) % m;

export type FacePart = 'side' | 'top' | 'bottom';

export interface Shown {
  placement: Placement;
  part: FacePart;
  upsideDown: boolean;
  spin: number; // quarter turns the top or bottom picture is spun by
}

// The face on show, from where the package is in its flip cycle and how often it has been turned.
export function shownFace(kind: PackageKind, flipPos: number, turn: number): Shown {
  const shape = SHAPE_OF_KIND[kind];
  const sides = SIDE_COUNT[shape];
  const pos = mod(flipPos, RING_LENGTH[shape]);
  if (shape === 'prism') {
    return { placement: { side: 'up', face: mod(turn, sides) }, part: 'side', upsideDown: false, spin: 0 };
  }
  if (shape === 'tetra') {
    return pos === 0
      ? { placement: { side: 'up', face: mod(turn, sides) }, part: 'side', upsideDown: false, spin: 0 }
      : { placement: { side: 'down', face: mod(turn, sides) }, part: 'bottom', upsideDown: false, spin: 0 };
  }
  // Cuboids and cylinders: side, top, the opposite side upside-down, bottom.
  switch (pos) {
    case 0:
      return { placement: { side: 'up', face: mod(turn, sides) }, part: 'side', upsideDown: false, spin: 0 };
    case 1:
      return { placement: { side: 'up', face: sides }, part: 'top', upsideDown: false, spin: mod(turn, 4) };
    case 2:
      return { placement: { side: 'up', face: mod(turn + 2, sides) }, part: 'side', upsideDown: true, spin: 0 };
    default:
      return { placement: { side: 'down', face: 0 }, part: 'bottom', upsideDown: false, spin: mod(-turn, 4) };
  }
}

// The package spins the other way once it is upside-down (and on the bottom).
export function rotateDelta(kind: PackageKind, flipPos: number): 1 | -1 {
  return RING_LENGTH[SHAPE_OF_KIND[kind]] >= 4 && mod(flipPos, 4) >= 2 ? -1 : 1;
}

export interface Orientation {
  flipPos: number;
  turn: number;
  flipped: boolean; // the face on show is on the down side
  face: number; // its index on that side
  upsideDown: boolean;
  spin: number;
}

// The fields kept in the handling so the rest of the game need not know about the ring.
export function orient(kind: PackageKind, flipPos: number, turn: number): Orientation {
  const shown = shownFace(kind, flipPos, turn);
  return {
    flipPos: mod(flipPos, RING_LENGTH[SHAPE_OF_KIND[kind]]),
    turn,
    flipped: shown.placement.side === 'down',
    face: shown.placement.face,
    upsideDown: shown.upsideDown,
    spin: shown.spin,
  };
}
```
(the "prism collapses a stray position" test relies on `pos` being computed with `mod(flipPos, 1)`; in the prism branch the position is ignored.)

- [ ] **Step 4: Handling**

`src/game/types.ts` `Handling`: add after `fined`:

```ts
  flipPos: number; // where the package is in its flip cycle (the source of truth)
  turn: number; // running count of rotations (the source of truth)
  upsideDown: boolean; // derived by orient(): the side on show is upside-down
  spin: number; // derived by orient(): quarter turns the top or bottom picture is spun by
```
and change the comments on `flipped` and `face` to say they are derived by `orient()`. `src/game/handling.ts` `newHandling()`: add `flipPos: 0, turn: 0, upsideDown: false, spin: 0` (keep `flipped: false`, `face: 0`).

- [ ] **Step 5: Run everything**

Run: `yarn test && yarn tsc --noEmit && yarn build`
Expected: FAIL only where the changed `faceCount` values or the new handling fields break existing tests or code; fix them without weakening assertions: tests that assert `faceCount(kind,'up')` counts or build `Handling` literals gain the new fields; the generator (`packages.ts`, uses `faceCount(kind, 'up')` for random faces) and `rotateBox` (`shift.ts`) still compile and are rewritten in Task 2, so keep them compiling and their tests green in this task by leaving their current logic untouched (the changed up-face counts mean the generator may now place a surface defect on index 4 for cuboids; that is corrected in Task 2, and `packages.test.ts` assertions that tie placements to `faceCount(kind,'up')` still hold). If a test breaks only because of that, mark it for Task 2 in your report rather than editing its intent.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Model the package's orientation as a flip position and a turn count

Face 1, top, upside-down face 3, bottom is a cycle with a turn that changes which
side comes next, so the shown face is derived from two counters instead of a
flipped flag and a face number."
```

---

### Task 2: Actions, generation and the bot

**Files:**
- Modify: `src/game/shift.ts`, `src/game/packages.ts`, `src/game/playthrough.test.ts`
- Test: `src/game/shift.test.ts`, `src/game/packages.test.ts`

**Interfaces:**
- Consumes: `orient`, `shownFace`, `rotateDelta`, `ringLength`, `sideCount`, `hasTop` (Task 1).
- Produces: new behavior for `rotateBox`, `flipBox`, `openBox`, `inspect`, `readLabel`; generator placements.

- [ ] **Step 1: Write the failing tests**

In `src/game/shift.test.ts` replace the `rotateBox` and `flipBox with faces` describes with these (keep the imports they use; `shiftWith`, `tools`, `openBox`, `closeBox` exist in the file):

```ts
describe('flip and rotate follow the orientation rules', () => {
  const start = (kind: PackageKind = 'box') => shiftWith([makePackage({ kind })], 3, tools('rotate'));
  const faceOf = (s: ShiftState) =>
    `${s.handling.flipped ? 'down' : 'up'}:${s.handling.face}${s.handling.upsideDown ? ' upside-down' : ''}`;
  const press = (s: ShiftState, ...moves: Array<'flip' | 'rotate'>) =>
    moves.reduce((st, m) => (m === 'flip' ? flipBox(st) : rotateBox(st)).state, s);

  it('needs the rotate tool, and the box closed', () => {
    expect(rotateBox(shiftWith([makePackage()])).message).toBe('You do not own that tool.');
    expect(flipBox(shiftWith([makePackage()])).message).toBe('You do not own that tool.');
    expect(rotateBox(openBox(start()).state).message).toBe('Close the box first.');
    expect(flipBox(openBox(start()).state).message).toBe('Close the box first.');
  });

  it('flips a box: face 1, top, upside-down face 3, bottom, face 1', () => {
    const s0 = start();
    const seen = [s0, press(s0, 'flip'), press(s0, 'flip', 'flip'), press(s0, 'flip', 'flip', 'flip'), press(s0, 'flip', 'flip', 'flip', 'flip')].map(faceOf);
    expect(seen).toEqual(['up:0', 'up:4', 'up:2 upside-down', 'down:0', 'up:0']);
  });

  it('flips a box from face 2 the same way', () => {
    const s0 = press(start(), 'rotate');
    expect(faceOf(s0)).toBe('up:1');
    expect(faceOf(press(s0, 'flip', 'flip'))).toBe('up:3 upside-down');
  });

  it('flips a cylinder: side, top, upside-down side, bottom, side', () => {
    const s0 = start('can');
    expect([s0, press(s0, 'flip'), press(s0, 'flip', 'flip'), press(s0, 'flip', 'flip', 'flip'), press(s0, 'flip', 'flip', 'flip', 'flip')].map(faceOf)).toEqual([
      'up:0',
      'up:1',
      'up:0 upside-down',
      'down:0',
      'up:0',
    ]);
  });

  it('rotating on the top changes which side comes next, and on the bottom it is reversed', () => {
    // face 1, top, rotate, flip -> upside-down face 4, flip -> bottom, rotate, flip -> face 1
    let s = start();
    s = press(s, 'flip', 'rotate');
    expect(faceOf(s)).toBe('up:4'); // still the top
    s = press(s, 'flip');
    expect(faceOf(s)).toBe('up:3 upside-down');
    s = press(s, 'flip', 'rotate');
    expect(faceOf(s)).toBe('down:0'); // still the bottom
    s = press(s, 'flip');
    expect(faceOf(s)).toBe('up:0');
  });

  it('rotating upside-down stays upside-down and shows another side', () => {
    const upside = press(start(), 'flip', 'flip');
    expect(faceOf(upside)).toBe('up:2 upside-down');
    expect(faceOf(press(upside, 'rotate'))).toBe('up:1 upside-down');
    expect(faceOf(press(upside, 'rotate', 'rotate'))).toBe('up:0 upside-down');
  });

  it('rotating on a side steps through the sides and wraps', () => {
    const s0 = start();
    expect([1, 2, 3, 4, 5].map((n) => faceOf(press(s0, ...Array<'rotate'>(n).fill('rotate'))))).toEqual([
      'up:1',
      'up:2',
      'up:3',
      'up:0',
      'up:1',
    ]);
  });

  it('records every face shown as seen', () => {
    const s = press(start(), 'flip', 'flip', 'flip');
    expect(s.handling.visited).toEqual(['up:0', 'up:4', 'up:2', 'down:0']);
  });

  it('never refuses a rotate that has nowhere new to show, and gives away no numbers', () => {
    const can = press(start('can'), 'rotate');
    expect(rotateBox(start('can')).message).toBe('You turn the package.');
    expect(flipBox(start('can')).message).toBe('You flip the package over.');
    expect(faceOf(can)).toBe('up:0');
    expect(can.handling.turn).toBe(1);
  });

  it('keeps the tetrahedron and the prism as they were', () => {
    const tetra = start('tetra');
    expect(faceOf(press(tetra, 'rotate', 'rotate'))).toBe('up:2');
    expect(faceOf(press(tetra, 'rotate', 'rotate', 'flip'))).toBe('down:2');
    expect(faceOf(press(tetra, 'flip', 'flip'))).toBe('up:0');
    const prism = start('prism');
    expect(flipBox(prism).message).toBe('This shape cannot be flipped.');
    expect(faceOf(press(prism, 'rotate', 'rotate', 'rotate'))).toBe('up:0');
  });

  it('opens and uses the tools only upright on a side', () => {
    const s0 = shiftWith([makePackage()], 3, tools('rotate', 'scale'));
    const top = press(s0, 'flip');
    expect(openBox(top).message).toBe('Turn the box upright first.');
    expect(inspect(top, 'scale').message).toBe('Close the box and turn it face up first.');
    expect(openBox(press(s0, 'flip', 'flip', 'flip', 'flip')).state.handling.opened).toBe(true);
  });

  it('reads a label whenever its side is showing, even upside-down', () => {
    const p = makePackage({ kind: 'box', labelFace: 2 });
    const s0 = shiftWith([p], 3, tools('rotate'));
    expect(readLabel(s0, 'shipping').state.handling.addressRead).toBe(true);
    expect(readLabel(press(s0, 'rotate'), 'shipping').message).toBe('That label is not on this side.');
    const upside = press(s0, 'flip', 'flip'); // side 3 (index 2) upside-down
    expect(readLabel(upside, 'contents').state.handling.contentsRead).toBe(true);
    expect(readLabel(press(s0, 'flip'), 'shipping').message).toBe('That label is not on this side.');
  });
});
```
(imports: `PackageKind` from `./types`; `ShiftState` is already imported or import it.) Remove the old `readLabel` tests that assert the removed messages ('The shipping label is on the first side.', 'The contents label is on another side.', 'Turn the box face up first.') and re-express them with `'That label is not on this side.'`; keep the 'There is no contents label.' and the reprinted-label tests, and `needs the box closed` ('Close the box first.').

In `src/game/packages.test.ts` update the placement tests: surface defects other than `torn_tape` sit on `up` faces with `face < sideCount(kind)`; `torn_tape` on a box or parcel sits at `{ side: 'up', face: sideCount(kind) }` (the top) and on a prism on a random side; underside defects on `down` faces within `faceCount(kind, 'down')`; `labelFace < sideCount(kind)` and `=== 0` when `sideCount(kind) === 1`; a missing label sits on `labelFace`. Add:

```ts
  it('puts the torn tape on the top of boxes and parcels from day 2', () => {
    let seen = 0;
    for (const day of [2, 4, 7]) {
      for (const p of sample(day, 600)) {
        if (!p.defects.includes('torn_tape')) continue;
        seen++;
        const placed = p.placements?.torn_tape;
        if (p.kind === 'box' || p.kind === 'parcel') expect(placed).toEqual({ side: 'up', face: 4 });
        else expect(placed!.face).toBeLessThan(sideCount(p.kind));
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
```
(import `sideCount`.)

- [ ] **Step 2: Run and see failures**

Run: `yarn test src/game`
Expected: FAIL.

- [ ] **Step 3: Implement the actions** (`src/game/shift.ts`; import `orient, rotateDelta, ringLength, shownFace` from `./shapes`, drop the `faceCount` import if unused)

Replace `rotateBox` and `flipBox`:

```ts
const withVisited = (visited: string[], side: Side, face: number): string[] => {
  const key = faceKey(side, face);
  return visited.includes(key) ? visited : [...visited, key];
};

// Moves the package to a new orientation and remembers the face it now shows.
function reorient(s: ShiftState, kind: PackageKind, flipPos: number, turn: number): ShiftState {
  const o = orient(kind, flipPos, turn);
  const side: Side = o.flipped ? 'down' : 'up';
  return {
    ...s,
    handling: { ...s.handling, ...o, visited: withVisited(s.handling.visited, side, o.face) },
  };
}

export function rotateBox(s: ShiftState): ActionResult {
  const pkg = currentPackage(s);
  if (!pkg) return idle(s);
  if (!s.inventory.tools.includes('rotate')) return { state: s, message: 'You do not own that tool.' };
  if (s.handling.opened) return { state: s, message: 'Close the box first.' };
  const turn = s.handling.turn + rotateDelta(pkg.kind, s.handling.flipPos);
  return { state: reorient(s, pkg.kind, s.handling.flipPos, turn), message: 'You turn the package.' };
}

export function flipBox(s: ShiftState): ActionResult {
  const pkg = currentPackage(s);
  if (!pkg) return idle(s);
  if (!s.inventory.tools.includes('rotate')) return { state: s, message: 'You do not own that tool.' };
  if (s.handling.opened) return { state: s, message: 'Close the box first.' };
  if (ringLength(pkg.kind) === 1) return { state: s, message: 'This shape cannot be flipped.' };
  const flipped = reorient(s, pkg.kind, s.handling.flipPos + 1, s.handling.turn);
  const used = s.handling.used.includes('rotate') ? s.handling.used : [...s.handling.used, 'rotate' as const];
  return {
    state: { ...flipped, handling: { ...flipped.handling, used } },
    message: 'You flip the package over.',
  };
}
```
`readLabel`: replace the flipped/face checks with the shown placement:

```ts
export function readLabel(s: ShiftState, which: 'shipping' | 'contents'): ActionResult {
  const pkg = currentPackage(s);
  if (!pkg) return idle(s);
  if (s.handling.opened) return { state: s, message: 'Close the box first.' };
  const shown = shownFace(pkg.kind, s.handling.flipPos, s.handling.turn).placement;
  const labelFace = which === 'shipping' ? 0 : pkg.labelFace;
  if (shown.side !== 'up' || shown.face !== labelFace) {
    return { state: s, message: 'That label is not on this side.' };
  }
  if (which === 'shipping') {
    return {
      state: { ...s, handling: { ...s.handling, addressRead: true } },
      message: 'You read the shipping label.',
    };
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
`openBox`: replace `if (s.handling.flipped) return … 'Flip the box back first.'` with `if (s.handling.flipPos !== 0) return { state: s, message: 'Turn the box upright first.' };`. `inspect`: replace the `viewOf(s.handling) !== 'front'` check with `if (s.handling.opened || s.handling.flipPos !== 0)` (same message `'Close the box and turn it face up first.'`). Remove now-unused imports (`faceCount`, maybe `viewOf` if no longer used).

- [ ] **Step 4: Generation** (`src/game/packages.ts`; import `hasTop, sideCount` from `./shapes`)

In `placeDefects` replace the surface branch:

```ts
    if (id === 'torn_tape') {
      // The tape seals the top of a box or parcel; elsewhere it is on a side.
      const top = kind === 'box' || kind === 'parcel';
      placements[id] = { side: 'up', face: top ? sideCount(kind) : rng.int(sideCount(kind)) };
    } else if (SURFACE_DEFECTS.includes(id)) {
      placements[id] = { side: 'up', face: rng.int(sideCount(kind)) };
    } else if (isUndersideDefect(id) && faceCount(kind, 'down') > 0) {
```
(the underside branch is unchanged; keep the `faceCount` import for it; `hasTop` is not needed here, so do not import it unless used.) Change the label face draw to `const sides = sideCount(kind); const labelFace = card.day >= 2 && sides > 1 ? rng.int(sides) : 0;` (replace `upFaces`).

- [ ] **Step 5: The bot** (`src/game/playthrough.test.ts`)

Replace the face sweep with one that shows every face of every shape: for `ringLength(kind)` flip positions, rotate `sideCount(kind)` times at each position that has sides to turn through, then flip, ending back at position 0 (the box must be upright and closed before opening and stamping):

```ts
    if (s.inventory.tools.includes('rotate')) {
      const ring = ringLength(pkg.kind);
      const turns = sideCount(pkg.kind);
      for (let pos = 0; pos < ring; pos++) {
        for (let i = 0; i < turns; i++) s = rotateBox(s).state; // each side, or a harmless spin on the top and bottom
        if (ring > 1) s = flipBox(s).state;
      }
    }
```
(A full circuit returns the package to position 0; for a prism `ring` is 1 and it only rotates.) Keep every assertion (opened > 0, repaired > 0, refused === 0, wasted === 0, zero strikes and fines, positive bank, discards and seals across seeds). Rotating `turns` times at each position means the top and bottom are shown (visited); rotating on a top/bottom changes `turn` by ±1 each, which nets out over a full circuit for cuboids; if the circuit leaves a nonzero net turn that is harmless.

- [ ] **Step 6: Run everything and commit**

Run: `yarn test && yarn tsc --noEmit && yarn build` → PASS.

```bash
git add -A
git commit -m "Make Flip tumble through the faces and Rotate spin, without saying where you are

Flip now goes side, top, upside-down opposite side, bottom, and a rotate on the
top or bottom changes which side comes next. Messages drop their numbers, the
torn tape moves to the top of boxes, and labels are readable on any showing side."
```

---

### Task 3: Geometry, markers and drawing

**Files:**
- Modify: `src/ui/geometry.ts`, `src/ui/markers.ts`, `src/ui/packageArt.ts`
- Test: `src/ui/geometry.test.ts`, `src/ui/markers.test.ts`

**Interfaces:**
- Produces (geometry.ts): `faceSquare(kind: PackageKind, b: Rect): Rect` (a square centred on the body with side `min(b.w, b.h)`); `rotateRect(r: Rect, cx: number, cy: number, quarters: number): Rect` (clockwise quarter turns about a point).
- Produces (markers.ts): `markerRectFor(pkg: Package, handling: Handling, defect: DefectId, width: number, height: number): Rect | undefined` — where a defect is on the face now showing, in canvas coordinates, after the upside-down turn or the top/bottom spin; used by `markersFor`, `labelMarkersFor` and the patch drawing.

- [ ] **Step 1: Write the failing tests**

Append to `src/ui/geometry.test.ts`:

```ts
describe('faceSquare and rotateRect', () => {
  it('centres a square of the shorter side on the body', () => {
    const b = bodyRect('box', 320, 260);
    const sq = faceSquare('box', b);
    expect(sq.w).toBe(Math.min(b.w, b.h));
    expect(sq.h).toBe(sq.w);
    expect(sq.x + sq.w / 2).toBeCloseTo(b.x + b.w / 2);
    expect(sq.y + sq.h / 2).toBeCloseTo(b.y + b.h / 2);
  });

  it('rotates a rectangle clockwise about a point, in quarters', () => {
    const r = { x: 10, y: 0, w: 4, h: 2 };
    expect(rotateRect(r, 0, 0, 0)).toEqual(r);
    expect(rotateRect(r, 0, 0, 1)).toEqual({ x: -2, y: 10, w: 2, h: 4 });
    expect(rotateRect(r, 0, 0, 2)).toEqual({ x: -14, y: -2, w: 4, h: 2 });
    expect(rotateRect(r, 0, 0, 4)).toEqual(r);
    expect(rotateRect(r, 0, 0, -1)).toEqual(rotateRect(r, 0, 0, 3));
  });
});
```
(`-0` vs `0`: if `toEqual` complains about `-0`, normalise results with `+ 0` in the implementation.)

Append to `src/ui/markers.test.ts` (it has `W`, `H`, `front`, `open`, `flipped`; add an `orientHandling` helper):

```ts
const at = (kind: PackageKind, flipPos: number, turn = 0) => ({
  ...newHandling(),
  ...orient(kind, flipPos, turn),
  used: ['look' as const, 'rotate' as const, 'uv' as const],
  visited: ['up:0', 'up:1', 'up:2', 'up:3', 'up:4', 'down:0'],
});

describe('markers on every face', () => {
  const taped = makePackage({ kind: 'box', defects: ['torn_tape'], placements: { torn_tape: { side: 'up', face: 4 } } });
  const sq = (kind: PackageKind) => faceSquare(kind, bodyRect(kind, W, H));

  it('shows the torn tape only on the top, as a strip across the middle that spins with the package', () => {
    expect(markersFor(taped, at('box', 0), W, H)).toEqual([]);
    const [top] = markersFor(taped, at('box', 1, 0), W, H);
    const s = sq('box');
    expect(top.rect).toEqual({ x: s.x, y: s.y + s.h * 0.43, w: s.w, h: 14 });
    const [spun] = markersFor(taped, at('box', 1, 1), W, H);
    expect(spun.rect.w).toBe(14); // a quarter turn makes it a vertical strip
    expect(spun.rect.h).toBe(s.w);
  });

  it('shows a bottomless void on the bottom, spun the other way', () => {
    const hole = makePackage({ kind: 'box', defects: ['bottomless'] });
    expect(markersFor(hole, at('box', 0), W, H)).toEqual([]);
    expect(markersFor(hole, at('box', 3, 0), W, H).map((m) => [m.defect, m.view])).toEqual([['bottomless', 'back']]);
  });

  it('turns a side defect upside-down with the package', () => {
    const dented = makePackage({ kind: 'box', defects: ['crushed_corner'], placements: { crushed_corner: { side: 'up', face: 2 } } });
    const b = bodyRect('box', W, H);
    const upright = markersFor(dented, at('box', 0, 2), W, H)[0].rect;
    expect(upright).toEqual({ x: b.x + b.w - 44, y: b.y, w: 44, h: 44 }); // top-right corner
    const upside = markersFor(dented, at('box', 2, 0), W, H)[0].rect; // side 3 upside-down
    expect(upside).toEqual({ x: b.x, y: b.y + b.h - 44, w: 44, h: 44 }); // now bottom-left
  });

  it('puts the labels where the side is showing, turned with it', () => {
    const p = makePackage({ kind: 'box', labelFace: 2 });
    expect(labelMarkersFor(p, at('box', 0, 0), W, H).map((m) => m.label)).toEqual(['shipping']);
    expect(labelMarkersFor(p, at('box', 2, 0), W, H).map((m) => m.label)).toEqual(['contents']);
    expect(labelMarkersFor(p, at('box', 1), W, H)).toEqual([]);
    expect(labelMarkersFor(p, at('box', 3), W, H)).toEqual([]);
  });

  it('keeps every marker inside the canvas in every orientation of every kind', () => {
    const all: DefectId[] = ['leaking', 'crushed_corner', 'torn_tape', 'bulging', 'missing_label', 'bottomless', 'wet_cardboard', 'scorching', 'tiny_weather'];
    for (const kind of ['box', 'can', 'parcel', 'jar', 'tube', 'prism', 'tetra'] as const) {
      for (let flipPos = 0; flipPos < ringLength(kind); flipPos++) {
        for (let turn = 0; turn < 4; turn++) {
          const h = at(kind, flipPos, turn);
          const pkg = makePackage({
            kind,
            defects: all,
            placements: Object.fromEntries(all.map((d) => [d, placementOf(makePackage({ kind }), d)])),
          });
          for (const m of [...markersFor(pkg, h, W, H), ...labelMarkersFor(pkg, h, W, H)]) {
            const r = m.rect;
            expect(r.x, `${kind} ${flipPos} ${turn}`).toBeGreaterThanOrEqual(0);
            expect(r.y).toBeGreaterThanOrEqual(0);
            expect(r.x + r.w).toBeLessThanOrEqual(W);
            expect(r.y + r.h).toBeLessThanOrEqual(H);
          }
        }
      }
    }
  });
});
```
(imports: `orient, ringLength, placementOf` from `../game/shapes`, `PackageKind` from `../game/types`, `faceSquare`, `rotateRect`, `bodyRect`; `labelMarkersFor`. Existing marker tests that build handlings with `flipped: true, face: n` keep working because `flipped`/`face` are still read. If an existing marker test now disagrees because the crushed-corner and bulging back markers were removed, update that test.)

- [ ] **Step 2: Run and see failures**

Run: `yarn test src/ui` → FAIL.

- [ ] **Step 3: Geometry** (`src/ui/geometry.ts`)

```ts
// The square the top and bottom of a package are drawn in (a disk for a cylinder).
export function faceSquare(_kind: PackageKind, b: Rect): Rect {
  const side = Math.min(b.w, b.h);
  return { x: b.x + (b.w - side) / 2, y: b.y + (b.h - side) / 2, w: side, h: side };
}

// Turns a rectangle clockwise by whole quarter turns about a point.
export function rotateRect(r: Rect, cx: number, cy: number, quarters: number): Rect {
  const q = ((quarters % 4) + 4) % 4;
  let dx = r.x - cx;
  let dy = r.y - cy;
  let w = r.w;
  let h = r.h;
  for (let i = 0; i < q; i++) {
    const nx = -(dy + h);
    const ny = dx;
    dx = nx;
    dy = ny;
    [w, h] = [h, w];
  }
  return { x: cx + dx + 0, y: cy + dy + 0, w, h };
}
```

- [ ] **Step 4: Markers** (`src/ui/markers.ts`)

Add a `TOP` table and drop the unreachable back entries; add `markerRectFor`:

```ts
// On the top, relative to the face square (the torn tape is the seam across the middle).
const TOP: Partial<Record<DefectId, OnBody>> = {
  torn_tape: (s) => ({ x: s.x, y: s.y + s.h * 0.43, w: s.w, h: 14 }),
};

// Underside defects, relative to the face square (or the body for a tetrahedron).
const BACK: Partial<Record<DefectId, OnBody>> = {
  bottomless: (b, kind) => voidRect(kind, b),
  wet_cardboard: (b) => ({ x: b.x + b.w * 0.08, y: b.y + b.h * 0.4, w: b.w * 0.44, h: b.h * 0.4 }),
};

// Where a defect is on the face now showing, in canvas coordinates.
export function markerRectFor(
  pkg: Package,
  handling: Handling,
  defect: DefectId,
  width: number,
  height: number,
): Rect | undefined {
  const body = bodyRect(pkg.kind, width, height);
  const shown = shownFace(pkg.kind, handling.flipPos, handling.turn);
  if (shown.part === 'top') {
    const sq = faceSquare(pkg.kind, body);
    const r = TOP[defect]?.(sq, pkg.kind);
    return r && rotateRect(r, sq.x + sq.w / 2, sq.y + sq.h / 2, shown.spin);
  }
  if (shown.part === 'bottom') {
    const tetra = SHAPE_OF_KIND[pkg.kind] === 'tetra';
    const area = tetra ? body : faceSquare(pkg.kind, body);
    const r = BACK[defect]?.(area, pkg.kind);
    return r && (tetra ? r : rotateRect(r, area.x + area.w / 2, area.y + area.h / 2, shown.spin));
  }
  const r = FRONT[defect]?.(body, pkg.kind);
  return r && (shown.upsideDown ? rotateRect(r, body.x + body.w / 2, body.y + body.h / 2, 2) : r);
}
```
Use it in `markersFor`: for the outside views `rect = markerRectFor(pkg, handling, defect, width, height)` (the inside branch keeps the `INSIDE` table). In `labelMarkersFor` compute the label rectangles with the same upside-down turn: replace the `handling.face === …` conditions with `const shown = shownFace(...).placement` comparisons (`shown.side === 'up' && shown.face === 0` for the shipping label; `=== pkg.labelFace` for the contents label), and turn each rectangle by 180° about the body centre when `handling.upsideDown`. Return `[]` unless `viewOf(handling) === 'front'` and the shown part is a side (not the top). Import `shownFace`, `SHAPE_OF_KIND` from `../game/shapes`, `faceSquare`, `rotateRect` from `./geometry`. The `tiny_weather`/`scorching` front markers are faceless and keep using the side rectangles on a side; on the top they have no entry (so none), which is acceptable.

- [ ] **Step 5: The drawing** (`src/ui/packageArt.ts`)

Read `drawFront`, `drawBack`, `drawCaption`, `drawRepairFlash` and `drawPackage`, then:
1. **Delete** `drawCaption` and its calls, and the per-face shading (`darken(…, 1 - 0.06 * face)` and `0.72 - 0.05 * face`): use fixed shades.
2. **Side faces** (`shown.part === 'side'`): draw the current side art (body, seal-tape strip, labels, prism look, marks) inside a transform that turns it 180° about the body centre when `handling.upsideDown` (`ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI); ctx.translate(-cx, -cy); … ctx.restore()`), so labels and marks appear upside-down with their markers (the rectangles come from `markerRectFor`, which turns them the same way). The shipping label is drawn when the shown side is `up:0`, the contents label when it is `up:labelFace`, as now.
3. **Top** (`shown.part === 'top'`): draw inside `faceSquare(pkg.kind, b)`, spun by `shown.spin` quarter turns about the square's centre: for box, parcel a filled square (a lighter body colour) with the tape seam across the middle (`{ x: sq.x, y: sq.y + sq.h * 0.43, w: sq.w, h: 14 }`), drawn as the `torn_tape` mark (`MARKS.torn_tape(ctx, seamRect)`, reusing its zigzag) when the torn tape is visible, else a plain tape strip; for a cylinder a disk (lid) with a darker rim ring. No label on the top.
4. **Bottom** (`shown.part === 'bottom'`): for a cuboid or cylinder draw inside the face square (disk for a cylinder), spun by `shown.spin`: the existing underside look (darker, inner frame, tape cross unless the bottomless defect is visible, then the void and the soggy stain via `BACK_MARKS` relative to the square). For a tetrahedron keep the existing clipped underside drawing on the triangle (no spin).
5. **Patches:** remove every `handling.repaired.length > 0` patch. After drawing the face (outside any transform), for each repaired defect that has a face on the outside (`!isFaceless(id)` from `../game/shapes`) whose placement is the shown placement, draw the patch (a small grey rectangle, about 36 by 12, with a darker outline) centred on `markerRectFor(pkg, handling, id, width, height)`; defects with no rectangle on this face (no entry in the tables) draw nothing. The `repair` flash overlay must use the same centre and only play when a repaired defect is on the shown face; replace `patchRect` usage and delete `patchRect` from `geometry.ts` with its tests if nothing else uses it (keep the geometry test file green).
6. Tool overlays (scale, UV, pebble, stethoscope, shake) keep drawing on the side faces as before; they only run when `flipPos === 0` because the tools are refused elsewhere.
7. Keep `drawPackage`'s `viewOf` use and the inside screen unchanged.

- [ ] **Step 6: Run everything**

Run: `yarn test && yarn tsc --noEmit && yarn build` → PASS. (The drawing is verified visually in Task 4.)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Draw the top, bottom, upside-down and spun faces, and patch only where fixed

Each defect's rectangle on the face on show comes from one function, so its
marker, its label click and its repair patch agree, and a fix no longer shows up
on every other face."
```

---

### Task 4: The screen, the Shapes tab and the visual check

**Files:**
- Modify: `src/ui/app.ts`, `src/ui/reference.ts`, `src/ui/reference.test.ts`, `src/styles.css` (if needed)

- [ ] **Step 1: The buttons** (`src/ui/app.ts`)

Replace `rotateLabel` and the Rotate/Flip button block: the Rotate button is plainly `Rotate` (never a count), disabled only while the box is open; the Flip button is plainly `Flip box`, disabled while open or when the shape cannot flip (`ringLength(pkg.kind) === 1`). Remove the `Flip box back` label, `faceCount`/`sideOf` imports that become unused, and anything that prints a side or face number. Both buttons exist only when the Rotate / flip tool is owned, as now.

- [ ] **Step 2: The Shapes tab** (`src/ui/reference.ts`, `src/ui/reference.test.ts`)

Update the descriptions and the test expectations:
- cuboid: `Four sides to rotate. Flip tumbles it: side, top, the opposite side upside-down, bottom. Rotating on the top or bottom changes which side comes next, and the bottom turns the other way.`
- cylinder: `One round side. Flip tumbles it: side, top, the side upside-down, bottom.`
- prism: `Three sides to rotate; it cannot be flipped.`
- tetrahedron: `Four faces to rotate; flip it for four more.`
Update `shapeGuide` test strings accordingly (kinds text unchanged).

- [ ] **Step 3: Run everything**

Run: `yarn test && yarn tsc --noEmit && yarn build` → PASS.

- [ ] **Step 4: Visual check in the browser preview**

Start the server (`preview_start` name `pack-inspect`). In `preview_eval` import `/src/ui/packageArt.ts`, `/src/ui/markers.ts` and `/src/game/handling.ts`/`shapes.ts` (append `?t=`+Date.now()) and render a gallery on scratch canvases, with each marker rectangle outlined in yellow:
- a box walked through its whole cycle (side 1, top, upside-down side 3, bottom) and the same with a turn of 1 and 2; the top with and without torn tape, at spin 0 and 1; the bottom with `bottomless` and `wet_cardboard` at spin 0 and 1 (check the reverse spin);
- a can through side, top, upside-down side, bottom; a prism on its three sides; a tetrahedron's up and down faces;
- a box with a repaired `torn_tape` (placed on the top): the patch shows on the top and on **no** side, the bottom or any other face; and a repaired `crushed_corner` on side 3: the patch shows on side 3 only;
- a box side 1 with the shipping label and side 3 (index 2) with the contents label, upright and upside-down (labels inverted, markers on them).
Check: no captions or numbers anywhere, the faces are not shaded differently, the upside-down side is clearly inverted, markers sit over their drawing, nothing is clipped at the canvas edge. Then call the real UI (seed 1): Day 1 has no Rotate/Flip; to exercise the buttons use `preview_eval` to build state with the modules (the Rotate/flip tool is bought at the end of Day 1) and confirm the Rotate button never shows a count, Flip is disabled for a prism, no text on the page names a side or face number, and the console has no errors. Fix what is visibly wrong in `src/ui` (commit separately). Stop the server.

- [ ] **Step 5: Commit, then squash**

```bash
git add -A
git commit -m "Show plain Rotate and Flip buttons and describe the flip cycles on the Shapes tab"
git reset --soft main
git commit -m "Flip tumbles through the faces and Rotate spins, with no hints

Flip now cycles a box through side, top, the opposite side upside-down and
bottom (a cylinder the same with its one round side); Rotate steps through the
sides and, on the top or bottom, changes which side comes next, reversing when
upside-down. The package no longer says which side or flip it is on, the top,
bottom, upside-down and spun faces are drawn, and a repair patch appears only on
the face where the defect was fixed."
```
