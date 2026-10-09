# Shapes Amendment Implementation Plan (prism faces, tetrahedron bottom, octahedron)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Rename prism/tetrahedron types, give the prism a top and bottom, give the tetrahedron a single bottom, and add a diamond-shaped octahedron kind with the old tetrahedron's eight faces.

**Architecture:** All face logic derives from the shape tables in `src/game/shapes.ts`; UI branches on shape (`tetra`-style underside = `tetra || octa` for the octa's lower faces, `tetra` for its single bottom). New kind `octa` flows through types, catalog, packaging weights, defect eligibility, geometry, art and reference text.

**Tech Stack:** TypeScript strict, Vite, Vitest, yarn. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-09-names-and-layout-design.md` (section "Amendment: prism, tetrahedron and octahedron faces").

## Global Constraints
- `yarn` only. TDD. Work on branch `feature/names-and-layout` (HEAD 267e200); never commit to `main`.
- Commit messages explain *why*; NO `Co-Authored-By`/signature/trailer; never stage `.superpowers/`.
- No new dependencies; `src/game` must not import UI/audio; DOM text via `el()`/`textContent` only. Snyk not required.
- Each task ends with `yarn test && yarn tsc --noEmit && yarn build` green.
- No geometry word ("prism", "tetrahedron", "octahedron", "cuboid", "cylinder", "triangular") in player-visible text.

---
### Task 1: Game layer
**Files:** `src/game/types.ts`, `shapes.ts`, `packages.ts`, `contents.ts`, `defects.ts`; tests `shapes.test.ts`, `packages.test.ts`, `contents.test.ts`, `defects.test.ts`, `shift.test.ts`, `inspection.test.ts`, `playthrough.test.ts` and any others that break.
- [ ] **Step 1: Failing tests.**
  - `PackageKind` includes `'octa'`; `Shape` includes `'octa'`; `SHAPE_OF_KIND.octa === 'octa'`.
  - Names: `typeNamesFor('prism')` is `['tent','wedge']`, `'tetra'` → `['pyraminx','caltrops']`, `'octa'` → `['diamond','pyrite']` (`makePackage` default typeNames: tent, pyraminx, diamond); generation draws both names of each across seeds (use a day-7 campaign card so octa appears).
  - Tables: `sideCount` prism 3, tetra 4, octa 4; `ringLength` prism 4, tetra 2, octa 2; `hasTop` true for box/parcel/cylinders/prism, false for tetra/octa; `faceCount(kind,'up')`/`'down'`: prism 4/1, tetra 4/1, octa 4/4.
  - `shownFace`: prism flip cycle at turn 0: `up:0`, `up:3` (top), `up:2 upside-down`, `down:0`; at turn 1: `up:1`, top spin 1, `up:0 upside-down`, bottom spin 3; `rotateDelta('prism', pos)` is `[1,1,-1,-1]`; prism rotating on a side steps through `up:0,1,2,0`. Tetra: `at(tetra,0,t)` is `up:mod(t,4)`, `at(tetra,1,t)` is always `down:0` part `bottom`; `rotateDelta` +1 both; flipping twice returns to the same face. Octa: exactly the old tetra expectations (position 0 `up:turn mod 4`, position 1 `down:turn mod 4` part `bottom` flipped true; `orient('octa',1,3)` is `{flipPos:1,turn:3,flipped:true,face:3,upsideDown:false,spin:0}`).
  - Shift tests: flipping a prism is now allowed and cycles side, top, upside-down side, bottom (`flipBox` message `You flip the package over.`; no more `This shape cannot be flipped.` for any kind — delete that refusal and its test); a tetra flip alternates `up:n` and `down:0`; an octa flip alternates `up:n` and `down:n`. `visited` records every shown face.
  - Generation: prism surface defects/labelFace `< 3`; prism torn tape random side; prism can get underside defects (`bottomless`, `wet_cardboard`) on `down:0`; tetra underside defects on `down:0` (one bottom); octa underside defects on `down:<4`; octa never gets surface-only defects (same eligibility as the old tetra: only `ANY`-kind defects and underside defects). `kindsForDay(7)` includes `octa`; `kindsForDay(6)` does not; days 4-5 unchanged.
  - Catalog: `CATALOG.octa` has three items (suggested `crystals` tower #8fd3f4 0.4kg, `gold nuggets` dome #d4a017 0.5kg, `marbles` dome #6a8fd8 0.1kg); remove `crystals` from tetra and give tetra three others (keep `party hats`, `dice`; add e.g. `jingle bells` dome #e8c860 0.1kg); `PACKAGING_KG.octa` 0.3. No catalog item name collides with a type name; every restricted item named on any rule card still exists in some catalog available on or before that day (existing consistency tests must pass; adjust nothing in the cards unless a restricted item is removed).
  - The playthrough bot still plays seeds with zero strikes and now also rotates/flips prisms through all positions (its circuit uses `ringLength` and `sideCount`, which already adapts).
- [ ] **Step 2:** `yarn test src/game` → FAIL. **Step 3: Implement** in the files above (tables, `shownFace` generalised: shapes with `RING_LENGTH 4` use the cuboid/cylinder switch — prism joins it; tetra: pos0 side, pos1 `{down,0}` bottom; octa: the old tetra branch). `rotateDelta` stays `RING_LENGTH>=4 && pos>=2`. Defect eligibility: `ANY` gains `octa`; `UNDERSIDE_SHAPES` becomes `['box','parcel','prism','tetra','octa']`; `SURFACE_SHAPES` unchanged. `placeDefects`: underside branch uses `faceCount(kind,'down')` (already). `kindsForDay`: add `octa` from day 7.
- [ ] **Step 4:** `yarn test && yarn tsc --noEmit && yarn build`. `src/ui` switches on `PackageKind`/shape exhaustively: keep it compiling with the minimum (e.g. treat `octa` like `tetra` in `bodyRect`/label/void geometry and art until Task 2/3; add `octa` to colour table). **Step 5: Commit** `"Give prisms a top and bottom, tetrahedrons a bottom, and add the octahedron"` (+why-body).

---
### Task 2: Geometry, markers and reference text
**Files:** `src/ui/geometry.ts` (+test), `src/ui/markers.ts` (+test), `src/ui/reference.ts` (+test).
- [ ] **Step 1: Failing tests.** `bodyRect('octa', 320, 260)` is a diamond-friendly rect (suggest `{x:w/2-70,y:floor-140,w:140,h:140}`); `labelRect`/`shippingLabelRect`/`voidRect` for `octa` equal the tetra values scaled to a diamond — specify: octa label rect `{x:b.x+b.w*0.3,y:b.y+b.h*0.5,w:b.w*0.4,h:b.h*0.2}`, shipping rect `{x:b.x+b.w*0.32,y:b.y+b.h*0.28,w:b.w*0.36,h:b.h*0.18}`, void rect `{x:b.x+b.w*0.34,y:b.y+b.h*0.36,w:b.w*0.32,h:b.h*0.3}` (all inside the diamond). Prism top/bottom use `faceSquare` (a triangle drawn in the square): add markers tests that a prism with `bottomless` shows a marker on the bottom inside the face square (spun by `shown.spin`), a prism torn tape on a side marker stays a side marker, nothing on its top, and `markerRectFor` for the tetra bottom (`part bottom`, single face) uses the body (unspun) like the old tetra; octa lower faces use the body (unspun). Keep the existing 'every marker stays inside the canvas for every kind/flipPos/turn' test and extend its kind list with `octa` and all four ring positions for `prism`.
  `shapeGuide(day)` entries: `Boxes and parcels`, `Cans, jars and tubes`, `Tents and wedges`, `Pyraminxes and caltrops`, `Diamonds and pyrites`, gated by `kindsForDay(day)` (octa from day 7), in that order; descriptions per the spec amendment (box and cylinder text unchanged); no geometry words.
- [ ] **Steps 2-4:** fail, implement (`SHAPE_TEXT`, `SHAPE_ORDER` include `octa`; geometry switch cases; `markers.ts` underside branch: area is the body for `tetra` and `octa`, the face square (spun) otherwise, which now includes prisms), green. **Step 5: Commit** `"Place and describe the new shapes"`.

---
### Task 3: Art, visual check, squash
**Files:** `src/ui/packageArt.ts`.
- [ ] **Step 1:** Draw: (a) octahedron body as a diamond (rhombus path; colour `#8fb8e8`-ish), its labels/void at the Task 2 rects, up faces plain with the usual labels, lower faces drawn as the old tetra underside (darker, inner frame, tape cross unless the void) clipped to the diamond; (b) prism top and bottom as triangles inside `faceSquare` (spun by `shown.spin`, like the box top/bottom but triangular; top shows the tape seam line if a torn tape placement is on the top — prisms never place it there, so a plain triangular top with a ridge line is enough; bottom with the taped cross unless `bottomless`, then the void); the prism side keeps `drawPrismLook`; upside-down sides turn 180° like boxes; (c) the tetrahedron bottom: its triangular underside (the old down-face drawing, one face, unspun). `flat()` etc. stay consistent for the new kind. Keep everything inside the canvas and readable.
- [ ] **Step 2:** `yarn test && yarn tsc --noEmit && yarn build`. **Step 3 (controller): visual check** — gallery of every shape position: prism at flip 0-3 (turns 0,1), tetra at pos 0/1, octa at pos 0/1 (turn 0, 2), with labels and a void, each with the marker rects overlaid; plus the real Shapes tab on day 7. **Step 4: Commit** `"Draw the prism's top and bottom, the tetrahedron's bottom and the octahedron"`, then squash everything on the branch into one commit: `git reset --soft main && git commit` with a message summarising the whole of build 1 including these shapes.
