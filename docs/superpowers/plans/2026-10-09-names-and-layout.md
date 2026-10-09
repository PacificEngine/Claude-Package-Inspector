# Names and Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Everyday type names instead of shapes, declared weight on the contents label, two-faced cylinders, restrictions as people/towns/addresses, and an example-based Addresses tab.

**Architecture:** `Package.typeName` is cosmetic. Cylinder `sideCount` becomes 2 and the shape model generalises (it already derives from `sideCount`). A new `restricted_person` address issue joins the rule cards. Reference tab data functions change shape; the UI renders them.

**Tech Stack:** TypeScript strict, Vite, Vitest, yarn. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-09-names-and-layout-design.md`

## Global Constraints
- `yarn` only. TDD. Branch `feature/names-and-layout` (exists). Never commit to `main`.
- Commit messages explain *why*; NO `Co-Authored-By`/signature/trailer; never stage `.superpowers/`.
- No new dependencies; `src/game` must not import UI/audio; DOM text via `el()`/`textContent` only, never `innerHTML`. Snyk not required.
- Each task ends with `yarn test && yarn tsc --noEmit && yarn build` green.
- No geometry word ("cuboid", "cylinder", "prism", "tetrahedron", "triangular") in any player-visible string.

---
### Task 1: Game layer — type names, cylinder backside, restricted people
**Files:** Modify `src/game/types.ts`, `src/game/shapes.ts`, `src/game/packages.ts`, `src/game/inspection.ts`, `src/game/address.ts`, `src/game/rules.ts`, `src/game/testing.ts`; Tests: `shapes.test.ts`, `packages.test.ts`, `inspection.test.ts`, `address.test.ts`, `rules.test.ts`, others that break.

- [ ] **Step 1: Failing tests.**
  - `Package` has `typeName: string`; `makePackage` (testing.ts) defaults it from kind (`box`→'box' …, `prism`→'tent', `tetra`→'pyramid'). `generatePackage`: for box/parcel/can/jar/tube `typeName === kind`; for prism it is one of `['tent','cheese wedge']`; for tetra one of `['pyramid','tea pyramid']`; across many seeds both names of each appear.
  - Note text: the shape clue note is `Type: <typeName>` (update `inspection.test.ts`); remove `shapeName`/`shapeNote` and any test using them (replace with typeName tests). Grep `src` to prove no player-visible string contains cuboid/cylinder/prism/tetrahedron (a test scanning `shapeGuide` text is in Task 2).
  - Cylinder: `sideCount('can')` is 2; `faceCount('can','up')` is 3 and `faceCount('can','down')` 1; `ringLength` stays 4. Update the shapes.test.ts cases: `can` side counts `[4,2,3,4]`; cylinder flip cycle `at('can',0..4,0)` is `up:0, up:2, up:0 upside-down, down:0, up:0` (top is face 2); a can rotated once shows `up:1`; `orient('can',1,0)` face 2; rotating on the top spins as for boxes. Generation: a can's surface defects and `labelFace` are `< 2`; `labelFace` is 0 on day 1; torn tape on a can is on a side (`face < 2`), not the top.
  - Restricted people: `ALL_ADDRESS_ISSUES` includes `'restricted_person'`; label `Restricted recipient`; min day 3; `generateAddress(rng,'restricted_person')` returns a recipient from `RESTRICTED_PEOPLE = ['Z. Blackwood','K. Mortimer']`, otherwise valid; `addressIssues` returns `['restricted_person']` for such an address and never for normal recipients; it is not repairable (`isRepairableAddressIssue` false). Rule cards: day 3, 4, 7 `rejectAddress` include it and each card gets a text line naming it (`'Do not ship to Z. Blackwood or K. Mortimer.'`); days 1, 2, 5, 6 do not mention it; the `consistency.test.ts` / `rules.test.ts` invariants (every address issue a card mentions has a line, etc.) still pass.
- [ ] **Step 2:** `yarn test src/game` → FAIL.
- [ ] **Step 3: Implement.** `types.ts`: `AddressIssue` gains `'restricted_person'`; `Package.typeName: string`. `shapes.ts`: cylinder `SIDE_COUNT` 2, `FACES.cylinder.up` 3; `TYPE_NAMES: Record<PackageKind, readonly string[]>` (exported `typeNamesFor(kind)`) and `typeNote(pkg: Package): string` returning `Type: ${pkg.typeName}`; delete `shapeName`/`shapeNote`/`SHAPE_NAMES`. `packages.ts`: pick `typeName` via `rng.pick(typeNamesFor(kind))` (single-name kinds must not consume the rng so existing seeds stay stable — only consume when the list has more than one name); torn tape on top only for box/parcel (already; cylinder falls to the random-side branch). `inspection.ts`: `shapeClue` uses `typeNote`. `address.ts`: new issue per the tests; `addressIssues` detects `RESTRICTED_PEOPLE.includes(a.recipient)`; `generateAddress` case. `rules.ts`: cards as in the tests.
- [ ] **Step 4:** `yarn test && yarn tsc --noEmit && yarn build`. `src/ui` still references `shapeGuide`'s `kinds`/geometry names and `addressGuide`/`restrictionGuide`; keep them compiling with minimal edits (Task 2 reworks them). The cylinder back face needs no UI change to compile; Task 3 draws it.
- [ ] **Step 5: Commit** `"Name packages by what they are and give cylinders a back, restrict some people"` (add a why-body).

---
### Task 2: Reference tabs and label panels
**Files:** Modify `src/ui/reference.ts`, `src/ui/reference.test.ts`, `src/ui/app.ts`.
- [ ] **Step 1: Failing tests** in `reference.test.ts`:
  - `shapeGuide(day)` entries are `{ name, description }` only (no `kinds`); names exactly `Boxes and parcels`, `Cans, jars and tubes`, `Tents and cheese wedges`, `Pyramids and tea pyramids`; day gating as before (tents from day 4, pyramids from day 6); no entry text contains `cuboid`, `cylinder`, `prism`, `tetrahedron`, `triangular`. Descriptions: boxes `Four sides to rotate. Flip tumbles it: side, top, the opposite side upside-down, bottom. Rotating on the top or bottom changes which side comes next, and the bottom turns the other way.`; cans `Two faces, front and back, to rotate between. Flip tumbles it: side, top, the same side upside-down, bottom.`; tents/wedges `Three sides to rotate; it cannot be flipped.`; pyramids `Four faces to rotate; flip it for four more.`
  - `addressGuide(card)` returns `{ example, cityZips }` with `example` exactly the four `{line, meaning}` pairs in the spec (lines `A. Pemberton`, `12 Elm Street`, `Maplewood 10001`, `Return: 40 Oak Road, Riverton`; meanings `Recipient: an initial and a surname.`, `Street: a house number and a street name.`, `City and ZIP: the ZIP must belong to the city.`, `Return address: where the package came from.`), `cityZips` populated only when the card mentions `zip_mismatch` (as now), and no `rules` key.
  - `restrictionGuide(card)` returns `{ people, towns, addresses, items }`: day 3 → people both names, towns `['Fort Hush (ZIP 99001)']`, addresses `[]`; day 4 → people both, towns `['Fort Hush (ZIP 99001)']`, addresses `["1 Nowhere Lane"]`, items `['candles']`; day 5 → people `[]`, towns `['Atlantis (below sea level)','Moon Base']`, addresses `[]`; PO boxes never appear in any list; day 2 (only PO box/ZIP rules) → all lists empty.
  - `tabsFor`: the `restrictions` tab shows exactly when any of people/towns/addresses/items is non-empty (day 2 therefore has no Restrictions tab; check the existing expectations and update).
- [ ] **Step 2:** fail. **Step 3: Implement** in `reference.ts`; update `app.ts`: the Addresses tab body renders the example (each line in a `.label-card` row with the line text and a `.muted` meaning beneath it) and the city-ZIP table when present; the Restrictions tab renders `People`, `Towns`, `Addresses`, `Items` groups (only non-empty ones); the Shapes tab renders name + description. In the labels panel: the shipping panel shows only `addressLines(pkg.address)`; the contents panel shows `Contents: …` then `Declared weight: ${pkg.declaredWeightKg} kg`. Update any existing text mentioning the shipping label carrying the weight (grep `declared`, `Declared`; e.g. scale clue text in `inspection.ts` should say `(label says X kg)` still — leave as is).
- [ ] **Step 4:** `yarn test && yarn tsc --noEmit && yarn build`. **Step 5: Commit** `"Describe packages by type and show only the useful address and restriction facts"`.

---
### Task 3: Cylinder backside art, visual check, squash
**Files:** Modify `src/ui/packageArt.ts` (and `markers.ts`/`geometry.ts` only if needed).
- [ ] **Step 1:** A can/jar/tube side face with index 1 (the back) is drawn as a plain round-body face with no shipping label; the contents label is drawn on whichever face equals `pkg.labelFace`; face 0 has the shipping label as now. Give the back a recognisable difference from the front (e.g. a vertical seam line and a small barcode block drawn in muted tones when it carries no label). Defect marks/markers for faces 0 and 1 use the existing rectangle tables (the marker rects are face-agnostic). Verify `labelMarkersFor` and `markerRectFor` work for a cylinder at face 1 (add a marker test: a can with `labelFace: 1` shows the contents label marker only when face 1 is showing, and the shipping label marker only at face 0).
- [ ] **Step 2:** `yarn test && yarn tsc --noEmit && yarn build`.
- [ ] **Step 3 (controller): visual check** in the browser preview: render a can at flipPos 0 turn 0 and turn 1, upside-down, top, bottom; with labelFace 1; and the real UI Addresses/Restrictions/Shapes tabs on days that show them (patch day/inventory temporarily and revert), and the contents panel showing the declared weight. Revert patches.
- [ ] **Step 4: Commit** `"Draw the back of cylinders"`, then squash: `git reset --soft main && git commit -m "Describe packages by what they are and give cylinders a back" ` with a why-body.
