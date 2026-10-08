# Views, Notes and Closing Implementation Plan (Phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the package three views (front, back, inside), record notes only by clicking markers (sound and reading clues record themselves), require the box to be closed before shipping, and let torn tape and crushed corners be fixed from outside, with opening an unnecessary box fined once.

**Architecture:** View state lives in the game core (`Handling.opened` / `flipped`), so every rule is unit-tested. Pure modules compute marker rectangles and sound events; the canvas module only draws a view, and `app.ts` renders buttons and overlay marker buttons from those pure results.

**Tech Stack:** TypeScript (strict), Vite, Vitest, yarn. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-08-views-and-notes-design.md` (extends `docs/superpowers/specs/2026-10-08-pack-inspect-design.md`)

## Global Constraints

- Package manager is `yarn` only. Never npm, pnpm or bun.
- TDD: failing test first, watch it fail, then the minimal code.
- Work on branch `feature/views-and-notes` (already created). Never commit to `main`.
- Commit messages explain *why*. NO `Co-Authored-By` line, no "Generated with" line, no signature or trailer of any kind. Never stage anything under `.superpowers/`.
- No new dependencies. `src/game/` must not import from `src/ui/` or `src/audio/` and must not touch the DOM.
- UI text is built with `textContent` / DOM APIs only; never `innerHTML`.
- Snyk is not required for this project; do not run it.
- Every task ends with `yarn test && yarn tsc --noEmit` green.
- Opening a box that does not need opening is fined `2 x fee` (`openingFine`), at most once per package.
- Views: `opened` -> inside, else `flipped` -> back, else front; a package is never both open and flipped.
- Tool clue channels: visual = look, rotate (flip), uv, pebble; sound = shake, stethoscope; reading = scale.

## File Structure

```
src/game/types.ts          + View, Handling.flipped/fined/notes
src/game/handling.ts       newHandling, viewOf
src/game/defects.ts        + repairNeedsOpen, insideClue
src/game/inspection.ts     channels, keys, inside clues, visibleDefects, notedClues
src/game/repair.ts         closed repairs for exterior defects
src/game/rules.ts          needsOpening (replaces needsRepair), Problem.requiresOpen
src/game/shift.ts          closeBox, flipBox, noteDefect, currentNotes; rule changes
src/audio/sfx.ts           + rattle, hum, whisper, tick, slosh, thunder
src/audio/events.ts        + sound events for newly used sound tools
src/ui/geometry.ts         Rect, bodyRect, insideLayout
src/ui/markers.ts          markersFor, markerNoted
src/ui/contents.ts         contentsFor(pkg, repaired)
src/ui/animation.ts        drop 'open' and 'rotate' actions
src/ui/packageArt.ts       drawFront, drawBack, drawInsideScreen
src/ui/app.ts              view buttons, marker overlay buttons, notes
src/styles.css             .stage, .marker
```

---

### Task 1: Handling state and clue model

**Files:**
- Modify: `src/game/types.ts`, `src/game/handling.ts`, `src/game/defects.ts`, `src/game/inspection.ts`
- Create: `src/game/handling.test.ts`
- Test: `src/game/defects.test.ts`, `src/game/inspection.test.ts`, and any existing test broken by the new semantics (see Step 8)

**Interfaces:**
- Produces (types.ts): `type View = 'front' | 'back' | 'inside'`; `Handling` gains `flipped: boolean`, `fined: boolean`, `notes: string[]`.
- Produces (handling.ts): `newHandling(): Handling`, `viewOf(h: Handling): View`.
- Produces (defects.ts): `DefectDef.repairNeedsOpen: boolean`, `DefectDef.insideClue?: string`.
- Produces (inspection.ts):
  - `type ClueChannel = 'visual' | 'sound' | 'reading'`, `type ClueSource = InspectionTool | 'inside'`
  - `interface Clue { key: string; source: ClueSource; defect: DefectId | null; channel: ClueChannel; text: string }` (replaces the old `tool` field with `source`)
  - `CLUE_CHANNEL: Record<InspectionTool, ClueChannel>`
  - `cluesFor(pkg, tool, repaired?) : Clue[]` (same behavior, new fields)
  - `insideCluesFor(pkg, repaired?): Clue[]`
  - `revealedDefects(pkg, handling): DefectId[]` (now also reveals inside-clue defects while `handling.opened`)
  - `visibleDefects(pkg, handling, view: View): DefectId[]`
  - `markerClues(pkg, handling, defect, view): Clue[]`
  - `notedClues(pkg, handling): Clue[]`

- [ ] **Step 1: Write the failing tests**

`src/game/handling.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { newHandling, viewOf } from './handling';

describe('newHandling', () => {
  it('starts closed, face up, unfined, with no notes', () => {
    expect(newHandling()).toEqual({
      opened: false,
      flipped: false,
      fined: false,
      used: ['look'],
      repaired: [],
      relabeled: false,
      notes: [],
    });
  });
});

describe('viewOf', () => {
  it('is front by default, back when flipped, inside when open', () => {
    expect(viewOf(newHandling())).toBe('front');
    expect(viewOf({ ...newHandling(), flipped: true })).toBe('back');
    expect(viewOf({ ...newHandling(), opened: true })).toBe('inside');
  });
});
```

Append to `src/game/defects.test.ts` (inside the existing top-level, as new `it`s in the existing `describe`, or a new `describe`):

```ts
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
```

Append to `src/game/inspection.test.ts` (add `makePackage`, `newHandling` imports if missing; add the new function imports to the existing import from `./inspection`):

```ts
import {
  CLUE_CHANNEL,
  insideCluesFor,
  markerClues,
  notedClues,
  visibleDefects,
} from './inspection';

describe('clue channels and keys', () => {
  it('tags clues with a key, source and channel', () => {
    const torn = cluesFor(makePackage({ defects: ['torn_tape'] }), 'look')[0];
    expect(torn).toMatchObject({ key: 'look:torn_tape', source: 'look', channel: 'visual' });
    expect(cluesFor(makePackage({ defects: ['rattling'] }), 'shake')[0]).toMatchObject({
      key: 'shake:rattling',
      channel: 'sound',
    });
    expect(cluesFor(makePackage(), 'scale')[0]).toMatchObject({ key: 'scale:none', channel: 'reading' });
  });

  it('assigns each tool to a channel', () => {
    expect(CLUE_CHANNEL).toEqual({
      look: 'visual',
      rotate: 'visual',
      uv: 'visual',
      pebble: 'visual',
      scale: 'reading',
      shake: 'sound',
      stethoscope: 'sound',
    });
  });
});

describe('inside clues', () => {
  it('lists a clue for each unrepaired defect that shows inside', () => {
    const pkg = makePackage({ defects: ['bottomless', 'torn_tape'] });
    expect(insideCluesFor(pkg)).toEqual([
      {
        key: 'inside:bottomless',
        source: 'inside',
        defect: 'bottomless',
        channel: 'visual',
        text: 'Inside there is only a black void where the floor should be.',
      },
    ]);
    expect(insideCluesFor(pkg, ['bottomless'])).toEqual([]);
  });

  it('reveals inside defects only while the box is open', () => {
    const pkg = makePackage({ defects: ['humming'] });
    expect(revealedDefects(pkg, newHandling())).toEqual([]);
    expect(revealedDefects(pkg, { ...newHandling(), opened: true })).toEqual(['humming']);
  });
});

describe('visibleDefects', () => {
  const pkg = makePackage({ defects: ['torn_tape', 'bottomless', 'tiny_weather'] });

  it('front shows what look, UV and the pebble reveal', () => {
    expect(visibleDefects(pkg, newHandling(), 'front')).toEqual(['torn_tape']);
    expect(visibleDefects(pkg, { ...newHandling(), used: ['look', 'uv'] }, 'front')).toEqual([
      'torn_tape',
      'tiny_weather',
    ]);
    expect(visibleDefects(pkg, { ...newHandling(), used: ['look', 'pebble'] }, 'front')).toEqual([
      'torn_tape',
      'bottomless',
    ]);
  });

  it('back shows what flipping revealed', () => {
    expect(visibleDefects(pkg, newHandling(), 'back')).toEqual([]);
    expect(visibleDefects(pkg, { ...newHandling(), used: ['look', 'rotate'] }, 'back')).toEqual([
      'bottomless',
    ]);
  });

  it('inside shows every unrepaired inside defect, and hides repaired ones', () => {
    expect(visibleDefects(pkg, newHandling(), 'inside')).toEqual(['bottomless', 'tiny_weather']);
    expect(
      visibleDefects(pkg, { ...newHandling(), repaired: ['bottomless'] }, 'inside'),
    ).toEqual(['tiny_weather']);
  });
});

describe('markerClues and notedClues', () => {
  const pkg = makePackage({ kind: 'can', defects: ['leaking', 'rattling'] });

  it('a front marker yields the visual clues of its defect from the tools used', () => {
    const h = { ...newHandling(), used: ['look' as const, 'uv' as const] };
    expect(markerClues(pkg, h, 'leaking', 'front').map((c) => c.key)).toEqual([
      'look:leaking',
      'uv:leaking',
    ]);
  });

  it('an inside marker yields the inside clue', () => {
    expect(markerClues(pkg, newHandling(), 'leaking', 'inside').map((c) => c.key)).toEqual([
      'inside:leaking',
    ]);
  });

  it('lists only the noted clues, in the order they were noted', () => {
    const h = {
      ...newHandling(),
      used: ['look' as const, 'shake' as const],
      notes: ['shake:rattling', 'look:leaking'],
    };
    expect(notedClues(pkg, h).map((c) => c.key)).toEqual(['shake:rattling', 'look:leaking']);
  });

  it('drops notes for repaired defects and for unknown keys', () => {
    const h = {
      ...newHandling(),
      notes: ['look:leaking', 'bogus:key'],
      repaired: ['leaking' as const],
    };
    expect(notedClues(pkg, h)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `yarn test src/game/handling.test.ts src/game/defects.test.ts src/game/inspection.test.ts`
Expected: FAIL (`viewOf` missing, `repairNeedsOpen` undefined, new inspection exports missing).

- [ ] **Step 3: Implement `types.ts` and `handling.ts`**

In `src/game/types.ts` add `export type View = 'front' | 'back' | 'inside';` and replace the `Handling` interface with:

```ts
// What the player has done to the package currently on the desk.
export interface Handling {
  opened: boolean; // the box is open: the inside view
  flipped: boolean; // the other side is showing: the back view
  fined: boolean; // the opening fine was already charged for this package
  used: InspectionTool[];
  repaired: DefectId[];
  relabeled: boolean;
  notes: string[]; // keys of the clues the player has recorded, in order
}
```

`src/game/handling.ts`:

```ts
import type { Handling, View } from './types';

export function newHandling(): Handling {
  return {
    opened: false,
    flipped: false,
    fined: false,
    used: ['look'],
    repaired: [],
    relabeled: false,
    notes: [],
  };
}

export function viewOf(h: Handling): View {
  return h.opened ? 'inside' : h.flipped ? 'back' : 'front';
}
```

- [ ] **Step 4: Implement the defect data**

In `src/game/defects.ts` add to `DefectDef`:

```ts
  // Repairing it requires the box to be open.
  repairNeedsOpen: boolean;
  // What the player sees when the box is open, if it shows inside.
  insideClue?: string;
```

and set per defect (add these two properties to each entry; `insideClue` only where listed):

| defect | repairNeedsOpen | insideClue |
|---|---|---|
| leaking | true | `'Liquid is pooling at the bottom inside.'` |
| crushed_corner | **false** | none |
| torn_tape | **false** | none |
| bulging | true | none |
| wet_cardboard | true | none |
| wrong_weight | true | none |
| rattling | true | none |
| missing_label | true | none |
| bottomless | true | `'Inside there is only a black void where the floor should be.'` |
| humming | true | `'Faint wavy lines rise from the contents.'` |
| whispering | true | `'Faint wavy lines rise from the contents.'` |
| ticking | true | `'A small clock sits among the contents, ticking.'` |
| scorching | true | `'Something inside glows white-hot.'` |
| future_contents | true | `'One of the gadgets inside looks slightly wrong.'` |
| heavier_inside | true | none |
| tiny_weather | true | `'A tiny storm swirls above the contents.'` |

- [ ] **Step 5: Implement `inspection.ts`** (replace the file)

```ts
import { DEFECTS } from './defects';
import { viewOf } from './handling';
import type { DefectId, Handling, InspectionTool, Package, View } from './types';

export type ClueChannel = 'visual' | 'sound' | 'reading';
export type ClueSource = InspectionTool | 'inside';

export interface Clue {
  key: string; // stable id used to record the clue in notes
  source: ClueSource;
  defect: DefectId | null;
  channel: ClueChannel;
  text: string;
}

export const CLUE_CHANNEL: Record<InspectionTool, ClueChannel> = {
  look: 'visual',
  rotate: 'visual',
  uv: 'visual',
  pebble: 'visual',
  scale: 'reading',
  shake: 'sound',
  stethoscope: 'sound',
};

const QUIET: Record<InspectionTool, string> = {
  look: 'Looks fine from the outside.',
  rotate: 'Nothing odd on any side.',
  scale: '',
  shake: 'Quiet. Nothing moves inside.',
  uv: 'Nothing glows under the UV light.',
  pebble: 'The pebble lands with a plink.',
  stethoscope: 'Only silence.',
};

// The tools that can show something on each side of the package.
const VIEW_TOOLS: Record<'front' | 'back', readonly InspectionTool[]> = {
  front: ['look', 'uv', 'pebble'],
  back: ['rotate'],
};

const clueKey = (source: ClueSource, defect: DefectId | null): string =>
  `${source}:${defect ?? 'none'}`;

export function cluesFor(
  pkg: Package,
  tool: InspectionTool,
  repaired: readonly DefectId[] = [],
): Clue[] {
  const channel = CLUE_CHANNEL[tool];
  const make = (defect: DefectId | null, text: string): Clue => ({
    key: clueKey(tool, defect),
    source: tool,
    defect,
    channel,
    text,
  });
  const clues: Clue[] = [];
  if (tool === 'scale') {
    clues.push(
      make(null, `Scale reads ${pkg.actualWeightKg} kg (label says ${pkg.declaredWeightKg} kg).`),
    );
  }
  for (const id of pkg.defects) {
    if (repaired.includes(id)) continue;
    const text = DEFECTS[id].clues[tool];
    if (text) clues.push(make(id, text));
  }
  const foundDefect = clues.some((c) => c.defect !== null);
  if (!foundDefect && QUIET[tool]) clues.push(make(null, QUIET[tool]));
  return clues;
}

export function insideCluesFor(pkg: Package, repaired: readonly DefectId[] = []): Clue[] {
  return pkg.defects
    .filter((id) => !repaired.includes(id) && DEFECTS[id].insideClue !== undefined)
    .map((id) => ({
      key: clueKey('inside', id),
      source: 'inside' as const,
      defect: id,
      channel: 'visual' as const,
      text: DEFECTS[id].insideClue as string,
    }));
}

// Defects the player knows about: found by a tool they used, or visible because the box is open.
export function revealedDefects(pkg: Package, handling: Handling): DefectId[] {
  return pkg.defects.filter(
    (id) =>
      !handling.repaired.includes(id) &&
      (Object.keys(DEFECTS[id].clues).some((tool) => handling.used.includes(tool as InspectionTool)) ||
        (handling.opened && DEFECTS[id].insideClue !== undefined)),
  );
}

// Defects with a drawn marker in the given view.
export function visibleDefects(pkg: Package, handling: Handling, view: View): DefectId[] {
  return pkg.defects.filter((id) => {
    if (handling.repaired.includes(id)) return false;
    const def = DEFECTS[id];
    if (view === 'inside') return def.insideClue !== undefined;
    return VIEW_TOOLS[view].some((t) => def.clues[t] !== undefined && handling.used.includes(t));
  });
}

// What clicking a defect's marker in this view records.
export function markerClues(
  pkg: Package,
  handling: Handling,
  defect: DefectId,
  view: View,
): Clue[] {
  if (view === 'inside') {
    return insideCluesFor(pkg, handling.repaired).filter((c) => c.defect === defect);
  }
  return VIEW_TOOLS[view]
    .filter((t) => handling.used.includes(t))
    .flatMap((t) => cluesFor(pkg, t, handling.repaired))
    .filter((c) => c.defect === defect);
}

// The clues the player has recorded, in the order they recorded them.
export function notedClues(pkg: Package, handling: Handling): Clue[] {
  const known = [
    ...handling.used.flatMap((t) => cluesFor(pkg, t, handling.repaired)),
    ...insideCluesFor(pkg, handling.repaired),
  ];
  return handling.notes
    .map((key) => known.find((c) => c.key === key))
    .filter((c): c is Clue => c !== undefined);
}
```

- [ ] **Step 6: Run the new tests**

Run: `yarn test src/game/handling.test.ts src/game/defects.test.ts src/game/inspection.test.ts`
Expected: PASS.

- [ ] **Step 7: Fix anything the new fields broke**

Run: `yarn tsc --noEmit` and `yarn test`. Fix every failure the change legitimately causes, without weakening assertions:
- The old `Clue.tool` field is now `source`: `grep -rn "\.tool\b" src` and update users (tests only compare `defect`/`text`).
- `src/game/repair.test.ts` has a test that a defect the player has not revealed is NOT fixed, using `bottomless` with an opened handling. An open box now reveals `bottomless`, so that test must use a defect that is not revealed by opening, for example `wrong_weight` with `relabel` and `used: ['look']`.
- Any test building a `Handling` literal by hand must gain the three new fields (prefer `{ ...newHandling(), ... }`).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Model views, clue channels and inside clues in the game core

Notes, closing and the three views all hang off this state, so it lands first
with its rules tested before any drawing changes."
```

---

### Task 2: Repairs from the outside

**Files:**
- Modify: `src/game/repair.ts`
- Test: `src/game/repair.test.ts`

**Interfaces:**
- Consumes: `DEFECTS[id].repairNeedsOpen`, `revealedDefects` (Task 1).
- Produces: `applyRepair` unchanged in signature. Behavior: refuses with `'Open the box first.'` only when it would fix a revealed defect that needs the box open and the box is closed. The out-of-supply check now comes first.

- [ ] **Step 1: Update and add tests in `src/game/repair.test.ts`**

Replace the existing "requires the box to be opened first" test with these (the file already defines `opened` and `inspected`; add `closed = newHandling()` if absent):

```ts
const closed = newHandling();

it('refuses a repair that needs the box open while it is closed', () => {
  const pkg = makePackage({ defects: ['humming'] });
  const stethoscoped = { ...closed, used: ['look' as const, 'stethoscope' as const] };
  expect(applyRepair(pkg, stethoscoped, inventoryWith({ foam: 1 }), 'foam')).toEqual({
    ok: false,
    reason: 'Open the box first.',
  });
});

it('fixes torn tape without opening the box', () => {
  const pkg = makePackage({ defects: ['torn_tape'] });
  const r = applyRepair(pkg, closed, inventoryWith({ tape: 1 }), 'tape');
  expect(r.ok && r.handling.repaired).toEqual(['torn_tape']);
  expect(r.ok && r.inventory.supplies.tape).toBe(0);
});

it('fixes a crushed corner without opening the box', () => {
  const pkg = makePackage({ defects: ['crushed_corner'] });
  const r = applyRepair(pkg, closed, inventoryWith({ tape: 1 }), 'tape');
  expect(r.ok && r.handling.repaired).toEqual(['crushed_corner']);
});

it('relabels an address from the outside but not a missing contents label', () => {
  const badAddress = { ...goodAddress, zip: '' };
  const addressOnly = applyRepair(makePackage({ address: badAddress }), closed, inventoryWith({ relabel: 1 }), 'relabel');
  expect(addressOnly.ok && addressOnly.handling.relabeled).toBe(true);
  const labelToo = applyRepair(
    makePackage({ defects: ['missing_label'], address: badAddress }),
    closed,
    inventoryWith({ relabel: 1 }),
    'relabel',
  );
  expect(labelToo).toEqual({ ok: false, reason: 'Open the box first.' });
});

it('still wastes a supply on a tool that would fix nothing, open or closed', () => {
  const r = applyRepair(makePackage(), closed, inventoryWith({ foam: 1 }), 'foam');
  expect(r.ok && r.fixed).toEqual([]);
  expect(r.ok && r.inventory.supplies.foam).toBe(0);
});

it('reports out of supplies before anything else', () => {
  const pkg = makePackage({ defects: ['humming'] });
  expect(applyRepair(pkg, closed, inventoryWith(), 'foam')).toEqual({
    ok: false,
    reason: 'You are out of that supply.',
  });
});
```

Make sure `goodAddress` is imported from `./testing`. Update any other test in the file that assumed a closed box could never be repaired.

- [ ] **Step 2: Run and see failures**

Run: `yarn test src/game/repair.test.ts`
Expected: FAIL (closed repairs currently refused).

- [ ] **Step 3: Implement**

In `src/game/repair.ts` replace the two guard lines and compute the fixable defects before checking the open requirement:

```ts
export function applyRepair(
  pkg: Package,
  handling: Handling,
  inventory: Inventory,
  tool: RepairTool,
): RepairResult {
  if (inventory.supplies[tool] < 1) return { ok: false, reason: 'You are out of that supply.' };

  const fixedDefects = revealedDefects(pkg, handling).filter(
    (id) => DEFECTS[id].repairedBy === tool,
  );
  // Only repairs that reach inside need the box open; patching tape or a dent works from outside.
  if (!handling.opened && fixedDefects.some((id) => DEFECTS[id].repairNeedsOpen)) {
    return { ok: false, reason: 'Open the box first.' };
  }
  // …rest of the function unchanged (relabelsAddress, return value)
```

- [ ] **Step 4: Run tests and typecheck**

Run: `yarn test && yarn tsc --noEmit`
Expected: PASS. (Existing `shift.test.ts` repair tests that relied on 'Open the box first.' for torn tape must switch to a defect that needs opening, such as `bottomless` with `used: ['look','rotate']`, or be updated to the new behavior. Do not weaken assertions.)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Let exterior repairs happen with the box closed

Patching tape or a dent does not need the box open, so only repairs that reach
inside should demand it."
```

---

### Task 3: needsOpening, fines and the bot

**Files:**
- Modify: `src/game/rules.ts`, `src/game/shift.ts` (only the `openBox` fine logic and import), `src/game/playthrough.test.ts`
- Test: `src/game/rules.test.ts`, `src/game/shift.test.ts`

**Interfaces:**
- Consumes: `DEFECTS[id].repairNeedsOpen` (Task 1).
- Produces:
  - `Problem` gains `requiresOpen: boolean` (defect: `DEFECTS[id].repairNeedsOpen`; address problems: `false`).
  - `needsOpening(pkg, card): boolean` replaces `needsRepair` (same signature): true when there is at least one reject-worthy problem, every one is repairable, and at least one requires opening.

- [ ] **Step 1: Update `src/game/rules.test.ts`**

Rename the import and the `describe('needsRepair', …)` block to `needsOpening` with these cases (keep the existing mixed/unrepairable/allowed cases, renamed):

```ts
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
```

(`day1`, `day2`, `day5` are the existing constants; add `const day2 = ruleCardForDay(2);` if missing. `leaking` and `bulging` are both rejected on day 1.) Update the `rejectWorthyProblems` expectation in the existing `'problems'` describe to include `requiresOpen`:

```ts
{ source: 'defect', id: 'torn_tape', repairTool: 'tape', requiresOpen: false },
{ source: 'address', id: 'missing_field', repairTool: 'relabel', requiresOpen: false },
```

- [ ] **Step 2: Update `src/game/shift.test.ts` open/fine tests**

Replace the `openBox` describe's fine tests with:

```ts
describe('openBox', () => {
  it('fines opening a box that does not need opening', () => {
    const r = openBox(shiftWith([clean]));
    expect(r.state.handling.opened).toBe(true);
    expect(r.state.fines).toBe(40);
    expect(r.message).toBe('Fined $40: that box did not need opening.');
  });

  it('fines opening a box that only needs a repair from outside', () => {
    expect(openBox(shiftWith([tornBox])).state.fines).toBe(40);
  });

  it('is free for a box that needs opening', () => {
    const bottomless = makePackage({ id: 3, defects: ['bottomless'], fee: 20 });
    const r = openBox(shiftWith([bottomless], 5));
    expect(r.state.fines).toBe(0);
    expect(r.message).toBe('Box opened.');
  });

  it('only fines once per box', () => {
    const once = openBox(shiftWith([clean])).state;
    expect(openBox(once).state.fines).toBe(40);
  });
});
```

(`tornBox` is `makePackage({ id: 2, defects: ['torn_tape'], fee: 20 })` from the file's fixtures.) Fix the `repair` tests in the file: the repair test that opens first then repairs `tornBox` remains valid, but it should no longer assert it was free to open; keep its assertions on the repair outcome only.

- [ ] **Step 3: Run and see failures**

Run: `yarn test src/game/rules.test.ts src/game/shift.test.ts`
Expected: FAIL (`needsOpening` missing, message text).

- [ ] **Step 4: Implement `rules.ts`**

Add `requiresOpen: boolean` to `Problem`; set it when building problems:

```ts
export interface Problem {
  source: 'defect' | 'address';
  id: DefectId | AddressIssue;
  repairTool: RepairTool | null;
  requiresOpen: boolean;
}
```
In `rejectWorthyProblems`, defect problems get `requiresOpen: DEFECTS[id].repairNeedsOpen` and address problems `requiresOpen: false`. Replace `needsRepair` with:

```ts
// True when fixing the package means opening it: it can be saved, and some fix reaches inside.
export function needsOpening(pkg: Package, card: RuleCard): boolean {
  const problems = rejectWorthyProblems(pkg, card);
  return (
    problems.length > 0 &&
    problems.every((p) => p.repairTool !== null) &&
    problems.some((p) => p.requiresOpen)
  );
}
```

- [ ] **Step 5: Implement the fine change in `shift.ts` `openBox`**

Import `needsOpening` instead of `needsRepair` and replace `openBox` with:

```ts
export function openBox(s: ShiftState): ActionResult {
  const pkg = currentPackage(s);
  if (!pkg) return idle(s);
  if (s.handling.opened) return { state: s, message: 'Already open.' };
  // Opening a box that did not need it is fined, but only once however often it is reopened.
  const fine = needsOpening(pkg, s.card) || s.handling.fined ? 0 : openingFine(pkg);
  return {
    state: {
      ...s,
      handling: { ...s.handling, opened: true, fined: s.handling.fined || fine > 0 },
      fines: s.fines + fine,
    },
    message: fine > 0 ? `Fined $${fine}: that box did not need opening.` : 'Box opened.',
  };
}
```

- [ ] **Step 6: Update the playthrough bot in `src/game/playthrough.test.ts`**

Import `needsOpening` instead of `needsRepair`. The bot must open only when needed and repair exterior problems closed. Replace the repair block inside `playShiftPerfectly`:

```ts
    const problems = rejectWorthyProblems(pkg, s.card);
    const repairable = problems.length > 0 && problems.every((p) => p.repairTool !== null);
    if (repairable) {
      const tools = new Set(problems.map((p) => p.repairTool!));
      const allStocked = [...tools].every((t) => s.inventory.supplies[t] > 0);
      if (allStocked) {
        // Exterior-only repairs (tape on tape or a dent) are done with the box closed.
        if (needsOpening(pkg, s.card)) {
          s = openBox(s).state;
          metrics.opened++;
        }
        for (const t of tools) {
          s = repair(s, t).state;
          metrics.repaired++;
        }
      } else {
        metrics.skippedForStock++;
      }
    }
```
(Keep the existing "inspect with every owned tool" loop and the final `stamp` line exactly as they are.) All existing assertions stay.

- [ ] **Step 7: Run everything**

Run: `yarn test && yarn tsc --noEmit`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Fine opening a box that did not need opening, once

Only some repairs reach inside, so a box that can be fixed from outside should
not be opened. The fine is charged once so closing and reopening cannot stack it."
```

---

### Task 4: Shift actions — close, flip, notes, closed shipping

**Files:**
- Modify: `src/game/shift.ts`, `src/game/playthrough.test.ts`
- Test: `src/game/shift.test.ts`

**Interfaces:**
- Consumes: `viewOf`, `cluesFor`, `markerClues`, `notedClues`, `CLUE_CHANNEL` (Task 1); `needsOpening` (Task 3).
- Produces (all return `ActionResult`, refusals leave the state unchanged):
  - `closeBox(s)`, `flipBox(s)`, `noteDefect(s, defect: DefectId, view: View)`
  - `currentNotes(s): Clue[]` (keep the old `currentClues` export in place for now; the UI removes its use in Task 8)
  - `inspect` changes: refuses `rotate` ("Use Flip box for that."), refuses unless the view is front ("Close the box and turn it face up first."), and auto-records sound and reading clues.
  - `openBox` refuses while flipped ("Flip the box back first.").
  - `stamp(s, 'ship')` refuses while the box is open ("Close the box before shipping.") with no strike and no state change.

- [ ] **Step 1: Write the failing tests**

Append to `src/game/shift.test.ts` (it already defines `shiftWith`, `clean`, `tornBox`; add imports `closeBox, flipBox, noteDefect, currentNotes` from `./shift`):

```ts
const tools = (...t: InspectionTool[]) => inventoryWith({}, ['look', ...t]);

describe('closeBox', () => {
  it('closes an open box', () => {
    const opened = openBox(shiftWith([clean])).state;
    const r = closeBox(opened);
    expect(r.state.handling.opened).toBe(false);
    expect(r.message).toBe('Box closed.');
  });

  it('refuses when the box is already closed', () => {
    expect(closeBox(shiftWith([clean])).message).toBe('The box is already closed.');
  });

  it('does not charge the fine again when the box is reopened', () => {
    let s = openBox(shiftWith([clean])).state;
    s = closeBox(s).state;
    s = openBox(s).state;
    expect(s.fines).toBe(40);
  });
});

describe('flipBox', () => {
  it('needs the rotate tool', () => {
    expect(flipBox(shiftWith([clean])).message).toBe('You do not own that tool.');
  });

  it('shows the back, counts as using the tool, and flips back again', () => {
    const s0 = shiftWith([clean], 3, tools('rotate'));
    const back = flipBox(s0).state;
    expect(back.handling.flipped).toBe(true);
    expect(back.handling.used).toEqual(['look', 'rotate']);
    const front = flipBox(back).state;
    expect(front.handling.flipped).toBe(false);
    expect(front.handling.used).toEqual(['look', 'rotate']);
  });

  it('is refused while the box is open, and opening is refused while flipped', () => {
    const s0 = shiftWith([clean], 3, tools('rotate'));
    expect(flipBox(openBox(s0).state).message).toBe('Close the box first.');
    expect(openBox(flipBox(s0).state).message).toBe('Flip the box back first.');
  });
});

describe('inspect with views and notes', () => {
  it('sends flipping to the flip button', () => {
    const s0 = shiftWith([clean], 3, tools('rotate'));
    expect(inspect(s0, 'rotate').message).toBe('Use Flip box for that.');
  });

  it('only works face up and closed', () => {
    const s0 = shiftWith([clean], 3, tools('rotate', 'scale'));
    const msg = 'Close the box and turn it face up first.';
    expect(inspect(flipBox(s0).state, 'scale').message).toBe(msg);
    expect(inspect(openBox(s0).state, 'scale').message).toBe(msg);
  });

  it('records scale readings and sound clues automatically, even a quiet result', () => {
    const rattler = makePackage({ defects: ['rattling'] });
    const s0 = shiftWith([rattler], 4, tools('scale', 'shake', 'stethoscope'));
    let s = inspect(s0, 'scale').state;
    s = inspect(s, 'shake').state;
    s = inspect(s, 'stethoscope').state;
    expect(currentNotes(s).map((c) => c.key)).toEqual([
      'scale:none',
      'shake:rattling',
      'stethoscope:none',
    ]);
  });

  it('does not record visual clues until a marker is clicked', () => {
    const leaker = makePackage({ kind: 'can', defects: ['leaking'] });
    const s = inspect(shiftWith([leaker], 3, tools('uv')), 'uv').state;
    expect(currentNotes(s)).toEqual([]);
  });
});

describe('noteDefect', () => {
  const leaker = makePackage({ kind: 'can', defects: ['leaking'] });

  it('records a visible defect from its front marker', () => {
    const r = noteDefect(shiftWith([leaker]), 'leaking', 'front');
    expect(currentNotes(r.state).map((c) => c.key)).toEqual(['look:leaking']);
    expect(r.message).toBe('A dark drip trails down the side.');
  });

  it('does not record the same clue twice', () => {
    const once = noteDefect(shiftWith([leaker]), 'leaking', 'front').state;
    const twice = noteDefect(once, 'leaking', 'front');
    expect(twice.message).toBe('Already noted.');
    expect(currentNotes(twice.state)).toHaveLength(1);
  });

  it('records the inside clue from the inside view', () => {
    const opened = openBox(shiftWith([leaker], 1)).state;
    const r = noteDefect(opened, 'leaking', 'inside');
    expect(currentNotes(r.state).map((c) => c.key)).toEqual(['inside:leaking']);
  });

  it('refuses a marker from a view that is not showing', () => {
    expect(noteDefect(shiftWith([leaker]), 'leaking', 'inside').message).toBe(
      'You are not looking at that side.',
    );
  });

  it('has nothing to note where nothing is visible', () => {
    expect(noteDefect(shiftWith([clean]), 'leaking', 'front').message).toBe('Nothing to note there.');
  });
});

describe('shipping needs a closed box', () => {
  it('refuses to ship an open box, without a strike', () => {
    const opened = openBox(shiftWith([clean, clean])).state;
    const r = stamp(opened, 'ship');
    expect(r.message).toBe('Close the box before shipping.');
    expect(r.state).toBe(opened);
  });

  it('ships once the box is closed', () => {
    const closed = closeBox(openBox(shiftWith([clean, clean])).state).state;
    expect(stamp(closed, 'ship').state.earned).toBe(20);
  });

  it('lets you reject an open box', () => {
    const opened = openBox(shiftWith([tornBox, clean])).state;
    const r = stamp(opened, 'reject');
    expect(r.state.rejected).toBe(1);
    expect(r.state.strikes).toBe(0);
  });
});
```

Add `import type { InspectionTool } from './types';` if missing, and fix any existing test in the file that used `inspect(…, 'rotate')` (use `uv` or `scale`) or expected an open box to ship.

- [ ] **Step 2: Run and see failures**

Run: `yarn test src/game/shift.test.ts`
Expected: FAIL (new exports missing).

- [ ] **Step 3: Implement in `src/game/shift.ts`**

Add imports: `viewOf` from `./handling`; `CLUE_CHANNEL, markerClues, notedClues, cluesFor` from `./inspection` (keep `Clue`); `View` from `./types`. Add:

```ts
const noteKeys = (handling: Handling, keys: string[]): string[] => [
  ...handling.notes,
  ...keys.filter((k) => !handling.notes.includes(k)),
];

export function currentNotes(s: ShiftState): Clue[] {
  const pkg = currentPackage(s);
  return pkg ? notedClues(pkg, s.handling) : [];
}

export function closeBox(s: ShiftState): ActionResult {
  if (!currentPackage(s)) return idle(s);
  if (!s.handling.opened) return { state: s, message: 'The box is already closed.' };
  return { state: { ...s, handling: { ...s.handling, opened: false } }, message: 'Box closed.' };
}

export function flipBox(s: ShiftState): ActionResult {
  if (!currentPackage(s)) return idle(s);
  if (!s.inventory.tools.includes('rotate')) return { state: s, message: 'You do not own that tool.' };
  if (s.handling.opened) return { state: s, message: 'Close the box first.' };
  const flipped = !s.handling.flipped;
  const used = s.handling.used.includes('rotate') ? s.handling.used : [...s.handling.used, 'rotate' as const];
  return {
    state: { ...s, handling: { ...s.handling, flipped, used } },
    message: flipped ? 'You flip the box over.' : 'You turn the box back over.',
  };
}

export function noteDefect(s: ShiftState, defect: DefectId, view: View): ActionResult {
  const pkg = currentPackage(s);
  if (!pkg) return idle(s);
  if (viewOf(s.handling) !== view) return { state: s, message: 'You are not looking at that side.' };
  const clues = markerClues(pkg, s.handling, defect, view);
  if (clues.length === 0) return { state: s, message: 'Nothing to note there.' };
  const fresh = clues.filter((c) => !s.handling.notes.includes(c.key));
  if (fresh.length === 0) return { state: s, message: 'Already noted.' };
  return {
    state: { ...s, handling: { ...s.handling, notes: noteKeys(s.handling, fresh.map((c) => c.key)) } },
    message: fresh.map((c) => c.text).join(' '),
  };
}
```

Replace `inspect` with:

```ts
export function inspect(s: ShiftState, tool: InspectionTool): ActionResult {
  const pkg = currentPackage(s);
  if (!pkg) return idle(s);
  if (tool === 'rotate') return { state: s, message: 'Use Flip box for that.' };
  if (!s.inventory.tools.includes(tool)) return { state: s, message: 'You do not own that tool.' };
  if (viewOf(s.handling) !== 'front') {
    return { state: s, message: 'Close the box and turn it face up first.' };
  }
  if (s.handling.used.includes(tool)) return { state: s, message: 'You already checked that.' };
  const clues = cluesFor(pkg, tool, s.handling.repaired);
  // Sounds and readings need no marker, so they go straight into the notes.
  const auto = CLUE_CHANNEL[tool] === 'visual' ? [] : clues.map((c) => c.key);
  return {
    state: {
      ...s,
      handling: {
        ...s.handling,
        used: [...s.handling.used, tool],
        notes: noteKeys(s.handling, auto),
      },
    },
    message: clues.map((c) => c.text).join(' '),
  };
}
```

In `openBox` add, right after the `already open` line: `if (s.handling.flipped) return { state: s, message: 'Flip the box back first.' };`. At the top of `stamp`, after the `pkg` guard: `if (verdict === 'ship' && s.handling.opened) return { state: s, message: 'Close the box before shipping.' };`. Import `Handling` (type) if not already imported.

- [ ] **Step 4: Update the playthrough bot**

In `src/game/playthrough.test.ts` import `closeBox, flipBox`. In `playShiftPerfectly`: (a) inspect only with owned tools other than `look` and `rotate`; (b) after inspecting, if the bot owns `rotate`, do `s = flipBox(s).state; s = flipBox(s).state;` (reveal the back, return face up); (c) after the repair block, `if (s.handling.opened) s = closeBox(s).state;` before the final `stamp`. All assertions stay.

- [ ] **Step 5: Run everything**

Run: `yarn test && yarn tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add closing, flipping and click-to-note actions to the shift

Views, notes and shipping rules live in the core so they are tested without any
drawing. Sound and reading clues record themselves; visual ones need a click."
```

---

### Task 5: Sounds for sound clues

**Files:**
- Modify: `src/audio/sfx.ts`, `src/audio/events.ts`
- Test: `src/audio/sfx.test.ts`, `src/audio/events.test.ts`

**Interfaces:**
- Produces: `SoundEvent` gains `'rattle' | 'hum' | 'whisper' | 'tick' | 'slosh' | 'thunder'`; `SOUND_EVENTS` lists all thirteen; `soundsFor` also returns them.

- [ ] **Step 1: Write the failing tests**

The existing `sfx.test.ts` loops over `SOUND_EVENTS`, so extending the list covers the new tones. Add to `src/audio/events.test.ts` (it defines `campaignWith`, `withShift`; add the imports `inspect` from `../game/shift`):

```ts
describe('soundsFor sound clues', () => {
  const inv = inventoryWith({}, ['look', 'shake', 'stethoscope']);
  const afterUsing = (defects: DefectId[], tool: 'shake' | 'stethoscope') => {
    const c = campaignWith([makePackage({ defects })], 6, inv);
    return soundsFor(c, withShift(c, inspect(c.shift!, tool).state));
  };

  it.each<[DefectId, 'shake' | 'stethoscope', string]>([
    ['rattling', 'shake', 'rattle'],
    ['future_contents', 'shake', 'slosh'],
    ['tiny_weather', 'shake', 'thunder'],
    ['humming', 'stethoscope', 'hum'],
    ['whispering', 'stethoscope', 'whisper'],
    ['ticking', 'stethoscope', 'tick'],
  ])('plays the sound of %s when %s is used', (defect, tool, sound) => {
    expect(afterUsing([defect], tool)).toEqual([sound]);
  });

  it('is silent for a quiet result', () => {
    expect(afterUsing([], 'shake')).toEqual([]);
  });

  it('is silent for a defect the tool cannot hear', () => {
    expect(afterUsing(['humming'], 'shake')).toEqual([]);
  });

  it('does not play again when nothing new was used', () => {
    const c = campaignWith([makePackage({ defects: ['rattling'] })], 4, inv);
    const once = withShift(c, inspect(c.shift!, 'shake').state);
    expect(soundsFor(once, once)).toEqual([]);
  });
});
```

(Add `import type { DefectId } from '../game/types';` if missing.)

- [ ] **Step 2: Run and see failures**

Run: `yarn test src/audio`
Expected: FAIL.

- [ ] **Step 3: Implement `sfx.ts`**

Extend `SoundEvent` and `SOUND_EVENTS` with the six names, and add cases to `sfxFor`:

```ts
    case 'rattle':
      return [0, 0.09, 0.17, 0.22, 0.31].map((at) => ({
        type: 'noise' as const,
        freq: 0,
        at,
        dur: 0.05,
        gain: 0.3,
      }));
    case 'hum':
      return [
        { type: 'sine', freq: 110, at: 0, dur: 1.0, gain: 0.25 },
        { type: 'sine', freq: 112, at: 0, dur: 1.0, gain: 0.2 },
      ];
    case 'whisper':
      return [
        { type: 'noise', freq: 0, at: 0, dur: 0.5, gain: 0.1 },
        { type: 'noise', freq: 0, at: 0.55, dur: 0.6, gain: 0.08 },
      ];
    case 'tick':
      return [0, 0.35, 0.7].map((at) => ({
        type: 'square' as const,
        freq: 1800,
        at,
        dur: 0.03,
        gain: 0.15,
      }));
    case 'slosh':
      return [
        { type: 'sine', freq: 300, at: 0, dur: 0.35, gain: 0.2, slideTo: 180 },
        { type: 'sine', freq: 260, at: 0.3, dur: 0.35, gain: 0.18, slideTo: 150 },
      ];
    case 'thunder':
      return [{ type: 'sawtooth', freq: 70, at: 0, dur: 0.9, gain: 0.25, slideTo: 40 }];
```

- [ ] **Step 4: Implement `events.ts`**

Add imports `DEFECTS` from `../game/defects`, `CLUE_CHANNEL` from `../game/inspection`, `currentPackage` from `../game/shift`, `DefectId` from `../game/types`. Add:

```ts
const SOUND_OF_DEFECT: Partial<Record<DefectId, SoundEvent>> = {
  rattling: 'rattle',
  humming: 'hum',
  whispering: 'whisper',
  ticking: 'tick',
  future_contents: 'slosh',
  tiny_weather: 'thunder',
};

// Sounds for the sound tools the player has just used on this package.
function soundClues(b: ShiftState, a: ShiftState): SoundEvent[] {
  const pkg = currentPackage(b);
  if (!pkg || a.index !== b.index) return [];
  const sounds: SoundEvent[] = [];
  for (const tool of a.handling.used) {
    if (b.handling.used.includes(tool) || CLUE_CHANNEL[tool] !== 'sound') continue;
    for (const id of pkg.defects) {
      const sound = SOUND_OF_DEFECT[id];
      if (sound && DEFECTS[id].clues[tool] && !a.handling.repaired.includes(id)) sounds.push(sound);
    }
  }
  return sounds;
}
```
and inside the `shift`-phase branch of `soundsFor`, before the existing strike/ship logic: `events.push(...soundClues(b, a));`.

- [ ] **Step 5: Run everything**

Run: `yarn test && yarn tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Play a noise for each sound clue

A rattle, hum, whisper, tick, slosh or thunder should be heard when the tool
that reveals it is used, since those clues have nothing to click."
```

---

### Task 6: Geometry and marker regions

**Files:**
- Create: `src/ui/geometry.ts`, `src/ui/markers.ts`
- Modify: `src/ui/packageArt.ts` (import `Rect` and `bodyRect` from the new module instead of defining them)
- Test: `src/ui/markers.test.ts`

**Interfaces:**
- Produces (geometry.ts): `interface Rect { x; y; w; h }`, `bodyRect(kind: PackageKind, width: number, height: number): Rect`, `interface InsideLayout { wall: Rect; floorY: number; cx: number }`, `insideLayout(width, height): InsideLayout`.
- Produces (markers.ts): `interface Marker { defect: DefectId; view: View; rect: Rect }`, `markersFor(pkg, handling, width, height): Marker[]`, `markerNoted(pkg, handling, marker): boolean`.

- [ ] **Step 1: Move the geometry**

Create `src/ui/geometry.ts`:

```ts
import type { PackageKind } from '../game/types';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Where the closed package sits on the belt.
export function bodyRect(kind: PackageKind, w: number, h: number): Rect {
  const floor = h - 40;
  switch (kind) {
    case 'box':
      return { x: w / 2 - 80, y: floor - 130, w: 160, h: 130 };
    case 'parcel':
      return { x: w / 2 - 95, y: floor - 90, w: 190, h: 90 };
    case 'can':
      return { x: w / 2 - 50, y: floor - 120, w: 100, h: 120 };
    case 'jar':
      return { x: w / 2 - 55, y: floor - 110, w: 110, h: 110 };
    case 'tube':
      return { x: w / 2 - 35, y: floor - 150, w: 70, h: 150 };
  }
}

// The cutaway of the open box: a back wall with the floor near its bottom.
export interface InsideLayout {
  wall: Rect;
  floorY: number;
  cx: number;
}

export function insideLayout(width: number, height: number): InsideLayout {
  const wall = { x: 24, y: 20, w: width - 48, h: height - 40 };
  return { wall, floorY: wall.y + wall.h - 36, cx: width / 2 };
}
```

In `src/ui/packageArt.ts` delete the local `interface Rect` and `function bodyRect` and add `import { bodyRect, type Rect } from './geometry';`.

- [ ] **Step 2: Write the failing tests**

`src/ui/markers.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { newHandling } from '../game/handling';
import { makePackage } from '../game/testing';
import type { DefectId } from '../game/types';
import { bodyRect, insideLayout } from './geometry';
import { markerNoted, markersFor } from './markers';

const W = 320;
const H = 260;
const front = newHandling();
const flipped = { ...newHandling(), flipped: true, used: ['look' as const, 'rotate' as const] };
const open = { ...newHandling(), opened: true };

describe('markersFor', () => {
  it('has no markers on a clean package', () => {
    expect(markersFor(makePackage(), front, W, H)).toEqual([]);
  });

  it('puts a marker on each defect visible from the front', () => {
    const pkg = makePackage({ kind: 'can', defects: ['leaking', 'rattling'] });
    const markers = markersFor(pkg, front, W, H);
    expect(markers.map((m) => [m.defect, m.view])).toEqual([['leaking', 'front']]);
    const body = bodyRect('can', W, H);
    expect(markers[0].rect.y).toBeGreaterThanOrEqual(body.y + body.h); // the drip is below the can
  });

  it('shows a front marker for torn tape along the top edge', () => {
    const body = bodyRect('box', W, H);
    const [m] = markersFor(makePackage({ defects: ['torn_tape'] }), front, W, H);
    expect(m.rect).toEqual({ x: body.x, y: body.y, w: body.w, h: 14 });
  });

  it('keeps flip-only defects off the front and shows them on the back', () => {
    const pkg = makePackage({ defects: ['bottomless', 'wet_cardboard'] });
    expect(markersFor(pkg, { ...front, used: ['look', 'rotate'] }, W, H)).toEqual([]);
    expect(markersFor(pkg, flipped, W, H).map((m) => [m.defect, m.view])).toEqual([
      ['bottomless', 'back'],
      ['wet_cardboard', 'back'],
    ]);
  });

  it('shows interior markers only inside', () => {
    const pkg = makePackage({ defects: ['bottomless', 'tiny_weather', 'torn_tape'] });
    const inside = markersFor(pkg, open, W, H);
    expect(inside.map((m) => [m.defect, m.view])).toEqual([
      ['bottomless', 'inside'],
      ['tiny_weather', 'inside'],
    ]);
  });

  it('hides the marker of a repaired defect', () => {
    const pkg = makePackage({ defects: ['bottomless'] });
    expect(markersFor(pkg, { ...open, repaired: ['bottomless'] }, W, H)).toEqual([]);
  });

  it('keeps every marker inside the canvas, in every view', () => {
    const all: DefectId[] = [
      'leaking', 'crushed_corner', 'torn_tape', 'bulging', 'wet_cardboard', 'missing_label',
      'bottomless', 'humming', 'whispering', 'ticking', 'scorching', 'future_contents', 'tiny_weather',
    ];
    const handlings = [
      { ...front, used: ['look' as const, 'uv' as const, 'pebble' as const] },
      flipped,
      open,
    ];
    for (const kind of ['box', 'can', 'parcel', 'jar', 'tube'] as const) {
      for (const h of handlings) {
        for (const m of markersFor(makePackage({ kind, defects: all }), h, W, H)) {
          expect(m.rect.x, `${kind} ${m.defect}`).toBeGreaterThanOrEqual(0);
          expect(m.rect.y, `${kind} ${m.defect}`).toBeGreaterThanOrEqual(0);
          expect(m.rect.x + m.rect.w, `${kind} ${m.defect}`).toBeLessThanOrEqual(W);
          expect(m.rect.y + m.rect.h, `${kind} ${m.defect}`).toBeLessThanOrEqual(H);
        }
      }
    }
  });

  it('places inside markers relative to the floor of the cutaway', () => {
    const { floorY } = insideLayout(W, H);
    const [m] = markersFor(makePackage({ defects: ['bottomless'] }), open, W, H);
    expect(m.rect.y).toBeLessThanOrEqual(floorY);
    expect(m.rect.y + m.rect.h).toBeGreaterThanOrEqual(floorY);
  });
});

describe('markerNoted', () => {
  it('is false until every clue of the marker is recorded', () => {
    const pkg = makePackage({ kind: 'can', defects: ['leaking'] });
    const h = { ...front, used: ['look' as const, 'uv' as const] };
    const [m] = markersFor(pkg, h, W, H);
    expect(markerNoted(pkg, h, m)).toBe(false);
    expect(markerNoted(pkg, { ...h, notes: ['look:leaking'] }, m)).toBe(false);
    expect(markerNoted(pkg, { ...h, notes: ['look:leaking', 'uv:leaking'] }, m)).toBe(true);
  });
});
```

- [ ] **Step 3: Run and see failures**

Run: `yarn test src/ui/markers.test.ts`
Expected: FAIL (`./markers` missing).

- [ ] **Step 4: Implement `src/ui/markers.ts`**

```ts
import { viewOf } from '../game/handling';
import { markerClues, visibleDefects } from '../game/inspection';
import type { DefectId, Handling, Package, View } from '../game/types';
import { bodyRect, insideLayout, type InsideLayout, type Rect } from './geometry';

export interface Marker {
  defect: DefectId;
  view: View;
  rect: Rect;
}

type OnBody = (b: Rect) => Rect;

const FRONT: Partial<Record<DefectId, OnBody>> = {
  leaking: (b) => ({ x: b.x + b.w * 0.15, y: b.y + b.h, w: b.w * 0.7, h: 24 }),
  crushed_corner: (b) => ({ x: b.x + b.w - 44, y: b.y, w: 44, h: 44 }),
  torn_tape: (b) => ({ x: b.x, y: b.y, w: b.w, h: 14 }),
  bulging: (b) => ({ x: b.x - b.w * 0.12, y: b.y, w: b.w * 1.24, h: b.h }),
  missing_label: (b) => ({ x: b.x + b.w * 0.2, y: b.y + b.h * 0.4, w: b.w * 0.6, h: b.h * 0.3 }),
  wet_cardboard: (b) => ({ x: b.x, y: b.y + b.h * 0.6, w: b.w, h: b.h * 0.4 }),
  bottomless: (b) => ({ x: b.x + b.w * 0.1, y: b.y + b.h - 6, w: b.w * 0.8, h: 26 }),
  scorching: (b) => ({ x: b.x - 10, y: b.y - 10, w: b.w + 20, h: b.h + 20 }),
  tiny_weather: (b) => ({ x: b.x + b.w / 2 - 30, y: b.y - 40, w: 60, h: 46 }),
};

const BACK: Partial<Record<DefectId, OnBody>> = {
  bottomless: (b) => ({ x: b.x + b.w * 0.14, y: b.y + b.h * 0.16, w: b.w * 0.72, h: b.h * 0.68 }),
  wet_cardboard: (b) => ({ x: b.x + b.w * 0.08, y: b.y + b.h * 0.4, w: b.w * 0.44, h: b.h * 0.4 }),
  crushed_corner: (b) => ({ x: b.x + b.w - 44, y: b.y, w: 44, h: 44 }),
  bulging: (b) => ({ x: b.x + 8, y: b.y + 8, w: b.w - 16, h: b.h - 16 }),
};

type InLayout = (l: InsideLayout) => Rect;

// Rectangles line up with the cutaway drawing in packageArt.ts (contents drawn at 1.7x).
const INSIDE: Partial<Record<DefectId, InLayout>> = {
  bottomless: (l) => ({ x: l.cx - 75, y: l.floorY - 8, w: 150, h: 46 }),
  tiny_weather: (l) => ({ x: l.cx - 52, y: l.floorY - 112, w: 104, h: 108 }),
  leaking: (l) => ({ x: l.cx - 85, y: l.floorY + 4, w: 170, h: 26 }),
  ticking: (l) => ({ x: l.cx - 30, y: l.floorY - 76, w: 60, h: 60 }),
  scorching: (l) => ({ x: l.cx - 80, y: l.floorY - 100, w: 160, h: 100 }),
  future_contents: (l) => ({ x: l.cx - 36, y: l.floorY - 70, w: 72, h: 56 }),
  humming: (l) => ({ x: l.cx - 40, y: l.floorY - 86, w: 80, h: 86 }),
  whispering: (l) => ({ x: l.cx - 40, y: l.floorY - 86, w: 80, h: 86 }),
};

export function markersFor(pkg: Package, handling: Handling, width: number, height: number): Marker[] {
  const view = viewOf(handling);
  const body = bodyRect(pkg.kind, width, height);
  const layout = insideLayout(width, height);
  const markers: Marker[] = [];
  for (const defect of visibleDefects(pkg, handling, view)) {
    const rect =
      view === 'inside'
        ? INSIDE[defect]?.(layout)
        : (view === 'front' ? FRONT : BACK)[defect]?.(body);
    if (rect) markers.push({ defect, view, rect });
  }
  return markers;
}

// True once everything the marker would record is already in the notes.
export function markerNoted(pkg: Package, handling: Handling, marker: Marker): boolean {
  const clues = markerClues(pkg, handling, marker.defect, marker.view);
  return clues.length > 0 && clues.every((c) => handling.notes.includes(c.key));
}
```

- [ ] **Step 5: Run everything**

Run: `yarn test && yarn tsc --noEmit`
Expected: PASS. (If a marker rectangle falls outside the canvas for some kind, fix the rectangle, not the test.)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Compute clickable marker regions as pure, tested geometry

Where each marker sits is separated from drawing, so clicks, keyboard buttons
and the art can share one source of truth."
```

---

### Task 7: Drawing the three views

**Files:**
- Modify: `src/ui/packageArt.ts`, `src/ui/contents.ts`, `src/ui/animation.ts`, `src/ui/app.ts` (minimal compile fixes only; the real UI work is Task 8)
- Test: `src/ui/contents.test.ts`, `src/ui/animation.test.ts`

**Interfaces:**
- Consumes: `viewOf`, `visibleDefects`, `bodyRect`, `insideLayout`, `contentsFor`.
- Produces:
  - `contentsFor(pkg, repaired?: readonly DefectId[])`: extras of repaired defects are omitted.
  - `PackageAction = 'shake' | 'scale' | 'uv' | 'pebble' | 'stethoscope' | 'repair'` (drops `'open'` and `'rotate'`); `PACKAGE_ACTIONS` and `ANIMATION_MS` follow.
  - `drawPackage(ctx, pkg, handling, motion?)` draws the view named by `viewOf(handling)`. `Motion` replaces the old `View` interface name: `{ action: PackageAction | null; progress: number }`.

- [ ] **Step 1: Update the tests**

`src/ui/animation.test.ts`: in the "moves forward in between" test use `'shake'` instead of `'rotate'` (`ANIMATION_MS.shake`). The other tests loop over `PACKAGE_ACTIONS` and need no change.

`src/ui/contents.test.ts`: add

```ts
it('leaves out what a repair has fixed', () => {
  const pkg = makePackage({ defects: ['bottomless', 'ticking'] });
  expect(contentsFor(pkg, ['bottomless']).extras).toEqual(['clock']);
  expect(contentsFor(pkg, ['bottomless', 'ticking']).extras).toEqual([]);
});
```

- [ ] **Step 2: Run and see failures**

Run: `yarn test src/ui/contents.test.ts src/ui/animation.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `contents.ts` and `animation.ts`**

`contentsFor(pkg: Package, repaired: readonly DefectId[] = [])`: skip `if (repaired.includes(defect)) continue;` in the defect loop (import `DefectId`). In `animation.ts` remove `'open'` and `'rotate'` from `PackageAction`, `PACKAGE_ACTIONS` and `ANIMATION_MS`.

- [ ] **Step 4: Rewrite the drawing in `src/ui/packageArt.ts`**

Keep unchanged: imports of `DefectId, Handling, Package, PackageKind`, `BODY_COLOR`, `MARKS`, `flat`, `ease`, `darken`, `drawBelt`, `bodyPath`, `drawItem`, `drawExtraBehind`, `drawScale`, `drawUv`, `drawPebble`, `drawStethoscope`, `drawShakeLines`, `drawRepairFlash`. **Delete** `drawInside`, `drawRim`, `drawUnderside` and `drawTopSide`. Change the imports at the top to:

```ts
import { viewOf } from '../game/handling';
import { visibleDefects } from '../game/inspection';
import type { DefectId, Handling, Package, PackageKind } from '../game/types';
import type { PackageAction } from './animation';
import { contentsFor } from './contents';
import { bodyRect, insideLayout, type Rect } from './geometry';
```

Rename the `View` interface and its `REST` constant to `Motion` / `REST: Motion`. Add these functions and the new `drawPackage`:

```ts
// ---- front ----------------------------------------------------------------------

function drawFront(ctx: CanvasRenderingContext2D, pkg: Package, b: Rect, handling: Handling): void {
  const visible = visibleDefects(pkg, handling, 'front');
  ctx.fillStyle = BODY_COLOR[pkg.kind];
  bodyPath(ctx, pkg, b);
  ctx.fill();

  // Seal tape strip, drawn unless the tape is torn
  if (flat(pkg.kind) && !visible.includes('torn_tape')) {
    ctx.fillStyle = '#b08a52';
    ctx.fillRect(b.x, b.y + 4, b.w, 8);
  }

  const label = { x: b.x + b.w * 0.2, y: b.y + b.h * 0.4, w: b.w * 0.6, h: b.h * 0.3 };
  if (visible.includes('missing_label')) {
    // An empty outline where the contents label should be, so the gap is something to point at.
    ctx.save();
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = 'rgba(60, 40, 20, 0.7)';
    ctx.lineWidth = 2;
    ctx.strokeRect(label.x, label.y, label.w, label.h);
    ctx.restore();
  } else {
    ctx.fillStyle = '#fdfdf5';
    ctx.fillRect(label.x, label.y, label.w, label.h);
    ctx.fillStyle = '#718096';
    ctx.fillRect(b.x + b.w * 0.25, b.y + b.h * 0.47, b.w * 0.5, 3);
    ctx.fillRect(b.x + b.w * 0.25, b.y + b.h * 0.56, b.w * 0.35, 3);
  }

  for (const id of visible) MARKS[id]?.(ctx, b);

  // Applied repairs show as a duct-tape patch
  if (handling.repaired.length > 0) {
    ctx.fillStyle = '#9aa0a6';
    ctx.fillRect(b.x + b.w * 0.1, b.y + b.h * 0.1, b.w * 0.3, 14);
  }
}

// ---- back -----------------------------------------------------------------------

const BACK_MARKS: Partial<Record<DefectId, (ctx: CanvasRenderingContext2D, b: Rect) => void>> = {
  bottomless: (ctx, b) => {
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(b.x + b.w / 2, b.y + b.h / 2, b.w * 0.36, b.h * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 4;
    ctx.stroke();
  },
  wet_cardboard: (ctx, b) => {
    ctx.fillStyle = 'rgba(30, 40, 70, 0.55)';
    ctx.beginPath();
    ctx.ellipse(b.x + b.w * 0.3, b.y + b.h * 0.6, b.w * 0.22, b.h * 0.2, 0.4, 0, Math.PI * 2);
    ctx.fill();
  },
  crushed_corner: (ctx, b) => {
    ctx.fillStyle = '#3d2f1f';
    ctx.beginPath();
    ctx.moveTo(b.x + b.w, b.y);
    ctx.lineTo(b.x + b.w - 40, b.y);
    ctx.lineTo(b.x + b.w, b.y + 40);
    ctx.fill();
  },
  bulging: (ctx, b) => {
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(b.x + b.w / 2, b.y + b.h / 2, b.w * 0.42, b.h * 0.4, 0, 0, Math.PI * 2);
    ctx.stroke();
  },
};

function drawBack(ctx: CanvasRenderingContext2D, pkg: Package, b: Rect, handling: Handling): void {
  const visible = visibleDefects(pkg, handling, 'back');
  ctx.fillStyle = darken(BODY_COLOR[pkg.kind], 0.72);
  bodyPath(ctx, pkg, b);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 3;
  ctx.strokeRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);

  // A sealed bottom has a tape cross; a missing one has a void instead.
  if (!visible.includes('bottomless')) {
    ctx.fillStyle = '#b08a52';
    ctx.fillRect(b.x, b.y + b.h / 2 - 5, b.w, 10);
    ctx.fillRect(b.x + b.w / 2 - 5, b.y, 10, b.h);
  }
  for (const id of visible) BACK_MARKS[id]?.(ctx, b);
  if (handling.repaired.length > 0) {
    ctx.fillStyle = '#9aa0a6';
    ctx.fillRect(b.x + b.w * 0.2, b.y + b.h * 0.2, b.w * 0.6, 12);
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Other side', 10, 16);
}

// ---- inside ---------------------------------------------------------------------

function drawInsideScreen(
  ctx: CanvasRenderingContext2D,
  pkg: Package,
  handling: Handling,
  width: number,
  height: number,
): void {
  const { wall, floorY, cx } = insideLayout(width, height);
  const contents = contentsFor(pkg, handling.repaired);
  const base = BODY_COLOR[pkg.kind];
  const wallPath = (): void => {
    ctx.beginPath();
    if (flat(pkg.kind)) ctx.rect(wall.x, wall.y, wall.w, wall.h);
    else ctx.roundRect(wall.x, wall.y, wall.w, wall.h, 28);
  };

  wallPath();
  ctx.fillStyle = darken(base, 0.5);
  ctx.fill();
  ctx.save();
  wallPath();
  ctx.clip();
  ctx.fillStyle = darken(base, 0.32);
  ctx.fillRect(wall.x, floorY, wall.w, wall.y + wall.h - floorY);
  ctx.restore();
  wallPath();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.lineWidth = 3;
  ctx.stroke();

  const hasVoid = contents.extras.includes('void');
  // The contents are drawn bigger than on the belt; a bottomless box swallows them.
  ctx.save();
  ctx.translate(cx, floorY + (hasVoid ? 10 : 0));
  ctx.scale(1.7, 1.7);
  drawItem(ctx, contents.item, 0, 0);
  for (const extra of contents.extras) drawExtraBehind(ctx, extra, 0, 0);
  ctx.restore();

  if (contents.extras.includes('liquid')) {
    ctx.fillStyle = '#3b82c4';
    ctx.beginPath();
    ctx.ellipse(cx, floorY + 16, 80, 12, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (hasVoid) {
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(cx, floorY + 14, 72, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Inside the ${pkg.kind}`, wall.x + 8, wall.y + 16);
}

// ---- entry point ----------------------------------------------------------------

export function drawPackage(
  ctx: CanvasRenderingContext2D,
  pkg: Package,
  handling: Handling,
  motion: Motion = REST,
): void {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
  const view = viewOf(handling);
  if (view === 'inside') {
    drawInsideScreen(ctx, pkg, handling, width, height);
    return;
  }

  drawBelt(ctx, width, height);
  const b = bodyRect(pkg.kind, width, height);
  const { action, progress: p } = motion;

  ctx.save();
  if (view === 'front' && action === 'shake') ctx.translate(Math.sin(p * Math.PI * 10) * 10 * (1 - p), 0);
  if (view === 'back') drawBack(ctx, pkg, b, handling);
  else drawFront(ctx, pkg, b, handling);
  ctx.restore();

  if (view !== 'front' || (p >= 1 && action !== null)) return; // tool overlays only on the front, and only while playing
  switch (action) {
    case 'scale':
      drawScale(ctx, pkg, b, p, width, height);
      break;
    case 'uv':
      drawUv(ctx, b, p, width, height);
      break;
    case 'pebble':
      drawPebble(ctx, pkg, b, p, height);
      break;
    case 'stethoscope':
      drawStethoscope(ctx, b, p, width);
      break;
    case 'shake':
      drawShakeLines(ctx, b, p);
      break;
    case 'repair':
      drawRepairFlash(ctx, b, p);
      break;
    default:
      break;
  }
}
```

Remove any now-unused locals or imports (the old `revealedDefects`, `contentsFor`-with-open arguments, `Contents` / `ContentsItem` type imports if unused) so `yarn tsc --noEmit` is clean. `drawItem` and `drawExtraBehind` must still be imported/defined where `drawInsideScreen` uses them (they are in this file); `drawExtraBehind`'s parameter list `(ctx, extra, cx, rim)` is unchanged — pass `0, 0` as shown.

- [ ] **Step 5: Minimal compile fixes in `src/ui/app.ts`**

`PackageAction` no longer has `'open'` or `'rotate'`:
- `act(openBox, 'open')` becomes `act(openBox)`.
- In the inspect row, `act((st) => inspect(st, t), t)` becomes `act((st) => inspect(st, t), t === 'rotate' ? undefined : t)`.
Nothing else changes here; Task 8 reworks this screen.

- [ ] **Step 6: Run everything**

Run: `yarn test && yarn tsc --noEmit && yarn build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Draw the front, back and inside of a package as separate views

Each view shows only its own markers, and the inside is a full cutaway screen
rather than an overlay, so what the player sees matches what they can click."
```

---

### Task 8: The screen: view buttons, marker buttons and notes

**Files:**
- Modify: `src/ui/app.ts`, `src/styles.css`, `src/game/shift.ts` (remove the now-unused `currentClues`), `src/game/shift.test.ts` (drop its `currentClues` use if any remains)

**Interfaces:**
- Consumes: `markersFor`, `markerNoted` (Task 6); `closeBox`, `flipBox`, `noteDefect`, `currentNotes` (Task 4); `viewOf`; `DEFECTS`.

- [ ] **Step 1: Update imports and constants in `src/ui/app.ts`**

Replace `currentClues` with `currentNotes` and add `closeBox, flipBox, noteDefect` to the `../game/shift` import; add `type PurchasableTool` to the `../game/shop` import; replace the `contentsFor, describeContents` import with `contentsFor`; add:

```ts
import { DEFECTS } from '../game/defects';
import { viewOf } from '../game/handling';
import { markerNoted, markersFor } from './markers';

const STAGE_W = 320;
const STAGE_H = 260;
```

- [ ] **Step 2: Replace the middle of `shiftScreen`**

Change the rule-card hint line to `'Opening a box that does not need opening costs 2x its shipping fee.'`. Replace everything from `const canvas = …` down to (and including) the final `return el('div', {}, [ hud, el('div', { cls: 'grid' }, …` of `shiftScreen` with:

```ts
    const view = viewOf(s.handling);
    const canvas = el('canvas', { attrs: { width: String(STAGE_W), height: String(STAGE_H) } });
    animate(canvas, s);

    // Each marker is a real button over the drawing: click to take a note, Tab to reach it.
    const markerButtons = markersFor(pkg, s.handling, STAGE_W, STAGE_H).map((m) => {
      const noted = markerNoted(pkg, s.handling, m);
      const b = button('', act((st) => noteDefect(st, m.defect, m.view)), false, noted ? 'marker noted' : 'marker');
      b.setAttribute('aria-label', `${noted ? 'Noted' : 'Take a note'}: ${DEFECTS[m.defect].label}`);
      b.style.left = `${(m.rect.x / STAGE_W) * 100}%`;
      b.style.top = `${(m.rect.y / STAGE_H) * 100}%`;
      b.style.width = `${(m.rect.w / STAGE_W) * 100}%`;
      b.style.height = `${(m.rect.h / STAGE_H) * 100}%`;
      return b;
    });
    const stage = el('div', { cls: 'stage' }, [canvas, ...markerButtons]);

    const label = el('div', { cls: 'label-card' }, [
      ...addressLines(pkg.address).map((line) => el('div', { text: line })),
      el('div', { text: `Declared weight: ${pkg.declaredWeightKg} kg` }),
    ]);
    const inside =
      view === 'inside'
        ? [el('p', { cls: 'inside', text: `Inside: ${contentsFor(pkg, s.handling.repaired).item.name}` })]
        : [];

    const noted = currentNotes(s);
    const notes = el('div', { cls: 'panel' }, [
      el('h3', { text: 'Notes' }),
      noted.length > 0
        ? el('ul', {}, noted.map((c) => el('li', { text: c.text })))
        : el('p', { cls: 'muted', text: 'Click a marker on the package to take a note.' }),
    ]);

    const tools = INSPECTION_ITEMS.filter(
      (t): t is Exclude<PurchasableTool, 'rotate'> => t !== 'rotate' && s.inventory.tools.includes(t),
    );
    const ownsFlip = s.inventory.tools.includes('rotate');
    const faceUp = view === 'front';
    const inspectRow = el('div', { cls: 'row' }, [
      ...tools.map((t) => button(ITEM_NAMES[t], act((st) => inspect(st, t), t), !faceUp || s.handling.used.includes(t))),
      ...(ownsFlip
        ? [button(view === 'back' ? 'Flip box back' : 'Flip box', act(flipBox), view === 'inside')]
        : []),
      ...(tools.length === 0 && !ownsFlip ? [el('span', { cls: 'muted', text: 'No inspection tools yet.' })] : []),
    ]);

    const stocked = REPAIR_ITEMS.filter((t) => s.inventory.supplies[t] > 0);
    const repairRow = el('div', { cls: 'row' }, [
      button(view === 'inside' ? 'Close box' : 'Open box', act(view === 'inside' ? closeBox : openBox), view === 'back'),
      ...stocked.map((t) =>
        button(`${ITEM_NAMES[t]} (${s.inventory.supplies[t]})`, act((st) => repair(st, t), 'repair')),
      ),
    ]);

    const stampRow = el('div', { cls: 'row' }, [
      button('SHIP', act((st) => stamp(st, 'ship')), s.handling.opened, 'ship'),
      button('REJECT', act((st) => stamp(st, 'reject')), false, 'reject'),
      ...(s.handling.opened ? [el('span', { cls: 'muted', text: 'Close the box before shipping.' })] : []),
    ]);

    return el('div', {}, [
      hud,
      el('div', { cls: 'grid' }, [
        el('div', {}, [stage, label, ...inside]),
        el('div', {}, [
          card,
          notes,
          el('div', { cls: 'panel' }, [
            el('h3', { text: 'Inspect' }),
            inspectRow,
            el('h3', { text: 'Repair' }),
            repairRow,
            el('h3', { text: 'Decide' }),
            stampRow,
            el('p', { cls: 'message', text: message }),
          ]),
        ]),
      ]),
    ]);
```

(`act`'s `PackageAction` argument is only passed for the five tool animations and `'repair'`; the `animate` function is unchanged.) Remove unused imports so `yarn tsc --noEmit` is clean (`describeContents`, `currentClues`).

- [ ] **Step 3: Styles**

Append to `src/styles.css`:

```css
.stage { position: relative; width: 100%; max-width: 320px; }
.stage canvas { display: block; }
.marker { position: absolute; padding: 0; background: transparent; border: 2px dashed transparent; border-radius: 6px; cursor: pointer; }
.marker:hover, .marker:focus-visible { border-color: #f6e05e; background: rgba(246, 224, 94, 0.14); }
.marker.noted { border-color: rgba(246, 224, 94, 0.35); }
```

- [ ] **Step 4: Remove `currentClues`**

Delete `currentClues` from `src/game/shift.ts` (and its now-unused `cluesFor` import only if nothing else in the file needs it; `inspect` still does). Fix any remaining test import of it.

- [ ] **Step 5: Run everything**

Run: `yarn test && yarn tsc --noEmit && yarn build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Wire views, marker buttons and click-to-note into the screen

Open and flip now switch screens, Close box gates shipping, and Notes start
empty so the player has to point at what looks wrong."
```

---

### Task 9: Visual check, spec touch-up and wrap-up

**Files:**
- Modify: `docs/superpowers/specs/2026-10-08-pack-inspect-design.md` (one pointer paragraph), anything the visual check shows wrong.

- [ ] **Step 1: Point the main spec at the new one**

Under the main spec's "Opening and fines" heading add: `> Superseded in part by 2026-10-08-views-and-notes-design.md (views, notes, closing, outside repairs, once-only fine).` and the same one-line pointer under "Repair tools".

- [ ] **Step 2: Visual verification in the browser preview**

Start the server (`preview_start` name `pack-inspect`, then load `/?seed=1`). With a script in `preview_eval` that imports `/src/ui/packageArt.ts` and `/src/ui/markers.ts`, render a gallery to scratch canvases (one canvas per case, the marker rectangles drawn as 2 px yellow outlines over the art) for: front with torn tape and a leaking can; back with bottomless and with a wet box; inside for each interior defect (void, storm, liquid, clock, glow, gadget, waves) and for a clean box of each kind. Take screenshots and check that **every marker rectangle sits over its drawing**; adjust the rectangles in `src/ui/markers.ts` (and re-run `yarn test src/ui/markers.test.ts`) where they do not. Then play the real game: open a box (inside screen appears), close it, confirm SHIP is disabled while open, flip (needs the Rotate / flip tool, buy it at the end of Day 1), click markers and watch Notes fill, use Shake and the stethoscope on later days and check the sound plays and the notes appear, and check there are no console errors. Stop the server.

- [ ] **Step 3: Full check and commit any fixes**

Run: `yarn test && yarn tsc --noEmit && yarn build`. Commit each visual fix separately with a message that explains why.

- [ ] **Step 4: Squash and finish**

Squash the branch into one commit on top of `main`:

```bash
git reset --soft main
git commit -m "Show the package from three sides and make notes click-to-record

Opening a box now switches to an inside screen and flipping shows the back until
flipped again. Notes start empty: visible problems are recorded by clicking their
marker, while sounds play a noise and record themselves. Boxes must be closed
before shipping. Torn tape and crushed corners can be taped from outside, so
opening a box that did not need it is fined, once."
```
