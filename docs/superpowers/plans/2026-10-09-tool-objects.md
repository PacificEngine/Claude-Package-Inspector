# Tool Objects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Tools and supplies become drawn objects in a tray; use one by selecting it then clicking its target; repairs fix only the clicked target and a wrong target spends nothing.

**Architecture:** Repair targeting lives in the game layer (`applyRepair` + `repair` take a `RepairTarget`). A pure `toolActions` module maps (selected tool, clicked target) to existing shift actions. `toolArt` draws the icons; `app.ts` holds `selectedTool` and routes clicks.

**Tech Stack:** TypeScript strict, Vite, Vitest, yarn. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-09-tool-objects-design.md`

## Global Constraints
- `yarn` only. TDD (failing test first, watch it fail). Branch `feature/tool-objects` (exists). Never commit to `main`.
- Commit messages explain *why*. NO `Co-Authored-By`/signature/trailer. Never stage `.superpowers/`.
- No new dependencies. `src/game/` must not import `src/ui`/`src/audio` or touch the DOM. DOM text via `textContent` only (the `el()`/`button()` helpers), never `innerHTML`. Snyk is not required.
- Every task ends with `yarn test && yarn tsc --noEmit && yarn build` green.
- Existing message strings not named in the spec stay unchanged.

## File Structure
```
src/game/repair.ts      RepairTarget; applyRepair(…, tool, target)
src/game/shift.ts       repair(s, tool, target)
src/ui/toolActions.ts   pure: ToolId, UseTarget, useTool, toggleTool, ownedTools, canTarget, ONE_SHOT
src/ui/toolArt.ts       drawTool(ctx, tool, size)
src/ui/app.ts           selectedTool state, tray, click routing
src/styles.css          tray / selected / target styles
```

---
### Task 1: Targeted repairs (game layer)
**Files:** Modify `src/game/repair.ts`, `src/game/shift.ts`; Test `src/game/repair.test.ts`, `src/game/shift.test.ts`, `src/game/playthrough.test.ts`.

**Interfaces — Produces:**
`export type RepairTarget = { kind: 'defect'; id: DefectId } | { kind: 'shippingLabel' } | { kind: 'contentsLabel' } | { kind: 'item'; itemId: number } | { kind: 'package' }`
`applyRepair(pkg, handling, inventory, tool, target): RepairResult` (same result shape as today; `fixed` lists what was fixed).
`repair(s: ShiftState, tool: RepairTool, target: RepairTarget): ActionResult` (message `Fixed: …` on success, else the reason; state unchanged on failure).

- [ ] **Step 1: Write failing tests** in `repair.test.ts` (rewrite the existing applyRepair tests to pass a target; keep each test's intent, drop the "Nothing to fix… Supply wasted" success-with-nothing behaviour). Required cases:
  - defect target with matching revealed defect and tool → `ok`, only that defect in `repaired`, one supply spent; with two tape defects revealed, one use fixes only the clicked one.
  - defect target, wrong tool (e.g. foam on torn_tape) → `{ ok:false, reason:'That tool does not fix that.' }`; defect not revealed → same reason; supplies unchanged (assert via result being not ok).
  - defect needing the box open while closed → `{ ok:false, reason:'Open the box first.' }`; same defect with box open → fixed.
  - `missing_label` defect target with relabel, box open → fixed and `labelItems` set (as today's print behaviour).
  - `shippingLabel` target + relabel with a repairable address issue and `!relabeled` → ok, `relabeled: true`, fixed contains `'address label'`; with nothing wrong or already relabeled → `{ ok:false, reason:'Nothing wrong with that label.' }`; with a non-relabel tool → same not-ok `'That tool does not fix that.'`.
  - `contentsLabel` target + relabel, box open, `missing_label` already repaired and `!labelMatches` → ok, fixed contains `'contents label'`; otherwise `{ ok:false, reason:'That label does not need reprinting.' }`.
  - `item` target + sealant, box open, item leaking and not sealed → ok, `sealed` gains the id, fixed `['the leaking <name>']`; item not leaking / already sealed / box closed → `{ ok:false, reason:'Nothing to fix there.' }`.
  - `package` target with any supply → `{ ok:false, reason:'Click the thing you want to fix.' }`.
  - zero stock → `{ ok:false, reason:'You are out of that supply.' }` (checked first).
  In `shift.test.ts` update `repair` tests to pass targets (success message `Fixed: <labels>.`, failure returns the reason with the **same state object**). Update the perfect-play bot in `playthrough.test.ts` to repair by target: for each revealed defect with a repair tool call `repair(s, tool, {kind:'defect', id})`, relabel the shipping label and reprint the contents label when needed, seal leaking items by item target, and keep every existing assertion (opened>0, repaired>0, refused===0 etc.; refused/wasted counts must still be 0).
- [ ] **Step 2:** `yarn test src/game` → FAIL.
- [ ] **Step 3: Implement.** In `applyRepair`: stock check first; switch on `target.kind`:
  - `package` → not-ok `Click the thing you want to fix.`
  - `defect` → `const def = DEFECTS[target.id]`; require `revealedDefects(pkg, handling).includes(target.id) && def.repairedBy === tool` else `That tool does not fix that.`; if `def.repairNeedsOpen && !handling.opened` → `Open the box first.`; else fixed = [target.id]; printsLabel when id is `missing_label`; return handling with `repaired: [...handling.repaired, id]`, `labelItems` set like today's printsLabel, supplies spent.
  - `shippingLabel` → tool must be `relabel` else `That tool does not fix that.`; require `!handling.relabeled && addressIssues(pkg.address).some(isRepairableAddressIssue)` else `Nothing wrong with that label.`; set `relabeled: true`, fixed `['address label']`.
  - `contentsLabel` → tool must be `relabel` (else `That tool does not fix that.`); require `handling.opened && handling.repaired.includes('missing_label') && !labelMatches(pkg, handling)` else `That label does not need reprinting.`; set `labelItems` to current item ids, fixed `['contents label']`.
  - `item` → tool must be `sealant` (else `That tool does not fix that.`); require opened and the item (from `itemsIn(pkg, handling)`) leaking and not in `sealed` else `Nothing to fix there.`; `sealed` gains the id, fixed `[\`the leaking ${name}\`]`.
  `shift.ts` `repair` passes the target and returns `Fixed: ${result.fixed.join(', ')}.` on success. Remove now-dead code (the old blanket-matching branches).
- [ ] **Step 4:** `yarn test && yarn tsc --noEmit && yarn build`. `src/ui/app.ts` calls `repair(st, t)` and will not compile — change that single call to `repair(st, t, { kind: 'package' })` as a stopgap so the bar is green (Task 4 replaces the UI).
- [ ] **Step 5: Commit** `git add -A` (not .superpowers) then `git commit -m "Repairs fix only what the player points at

Applying a supply to a chosen target lets the UI work by select-then-click; a target
the supply cannot fix is refused without spending the supply."`

---
### Task 2: Tool selection and use (pure UI logic)
**Files:** Create `src/ui/toolActions.ts`, `src/ui/toolActions.test.ts`.

**Interfaces — Consumes:** `inspect`, `rotateBox`, `flipBox`, `weighItem`, `repair` from `../game/shift`; `RepairTarget` from `../game/repair`; `Inventory`, `RepairTool`, `InspectionTool` from `../game/types`; `ShiftState`, `ActionResult`.
**Produces:**
```ts
export type InspectToolId = 'scale' | 'shake' | 'uv' | 'pebble' | 'stethoscope';
export type ToolId = InspectToolId | 'rotateTool' | 'flipTool' | RepairTool;
export type UseTarget = RepairTarget; // 'package' means the package itself
export const TOOL_ORDER: readonly ToolId[]; // scale, shake, uv, pebble, stethoscope, rotateTool, flipTool, tape, sealant, relabel, valve, foam
export const toolName: (t: ToolId) => string; // 'Scale','Shake','UV light','Drop-test pebble','Stethoscope','Rotate','Flip','Duct tape','Sealant','Relabel kit','Pressure valve','Foam'
export function ownedTools(inv: Inventory): ToolId[]; // owned inspection tools (rotate -> rotateTool AND flipTool) then supplies with stock > 0, in TOOL_ORDER
export const isSupply: (t: ToolId) => t is RepairTool;
export const isOneShot: (t: ToolId) => boolean; // the five inspect tools: true
export const toggleTool: (selected: ToolId | null, tool: ToolId) => ToolId | null; // same tool -> null, else tool
export function canTarget(tool: ToolId, target: UseTarget): boolean; // highlight rule, see tests
export function useTool(s: ShiftState, tool: ToolId, target: UseTarget): ActionResult;
```
`useTool`: inspect tools: `package` → `inspect(s, tool)`; `item` + `scale` → `weighItem(s, itemId)`; other targets for an inspect tool → treated as package (markers and labels overlay the package) EXCEPT `item` with a non-scale inspect tool → `{ state: s, message: 'Use that on the package.' }`. `rotateTool` → `rotateBox(s)`, `flipTool` → `flipBox(s)` for any non-item target (item → `Use that on the package.`). Supplies → `repair(s, tool, target)`.
`canTarget(tool, target)`: inspect tools / rotateTool / flipTool true for `package`, `defect`, `shippingLabel`, `contentsLabel`; scale also true for `item`; supplies: `defect`, `shippingLabel` (relabel only), `contentsLabel` (relabel only), `item` (sealant only); false otherwise (and false for `package` with a supply).

- [ ] **Step 1: Write failing tests** covering: `ownedTools` for an inventory with `tools:['look','rotate','scale']` and tape 2/foam 0 → `['scale','rotateTool','flipTool','tape']`; `look` never listed; `toggleTool`; `isOneShot`; `canTarget` table (one assertion per row above); `useTool` delegations using a started shift (`startShift(1, inv, 1)` helper pattern from `shift.test.ts`/`testing.ts`): scale on package reads weight (state `used` includes `'scale'`), scale on an item with the box open weighs (notes include `item:<id>`), shake on an item → `Use that on the package.`, rotateTool rotates (`handling.turn` 1), flipTool flips (`flipPos` 1), tape on `package` → `Click the thing you want to fix.` with the same state object, a supply on a valid defect target repairs (use `makePackage` with a revealed torn_tape as in `repair.test.ts`).
- [ ] **Step 2:** run → FAIL. **Step 3:** implement as above (no DOM). **Step 4:** full suite green.
- [ ] **Step 5: Commit** `"Map a selected tool and a clicked target onto the existing actions"`.

---
### Task 3: Tool art
**Files:** Create `src/ui/toolArt.ts`, `src/ui/toolArt.test.ts`.
**Produces:** `export function drawTool(ctx: CanvasRenderingContext2D, tool: ToolId, size: number): void` — draws the object centred in a `size`×`size` square on a transparent background using simple flat shapes (match the package art's style: `fillRect`, `arc`, `roundRect`, a few strokes). Objects: scale (grey platform with a dial), shake (box with motion lines), UV light (purple torch with a beam), drop-test pebble (brown rock), stethoscope (tube loop with chest piece), rotateTool (turntable disc with a circular arrow), flipTool (a bar with a two-way curved arrow), tape (roll, silver with a ring), sealant (tube with a nozzle, blue), relabel (small label sheet with a pen/line), valve (round gauge with a nozzle), foam (spray can, yellow). Each must draw something distinctive (different colours).
- [ ] **Step 1: Failing test** with a fake recording context (an object whose methods are `vi.fn()`; reuse any existing canvas-mock pattern in the repo tests, else a Proxy that records calls): for every `ToolId` in `TOOL_ORDER`, `drawTool` makes at least 3 drawing calls (`fill`/`fillRect`/`stroke`/`arc`…) and does not throw; the set of `fillStyle` values recorded differs between tools (no two tools identical).
- [ ] **Steps 2–4:** fail, implement, green. **Step 5: Commit** `"Draw each tool as the object it is"`.

---
### Task 4: The tray, selection and click routing; visual check; squash
**Files:** Modify `src/ui/app.ts`, `src/styles.css`.
- [ ] **Step 1: State and tray.** In `mount`, add `let selectedTool: ToolId | null = null;`. Replace `inspectRow` and the supply buttons in `repairRow` with a `tray`: `ownedTools(s.inventory)` rendered as `<button class="tool" title=name aria-label=name aria-pressed=selected>` each containing a 48×48 canvas drawn by `drawTool` and, for supplies, a count badge `<span class="count">` (textContent). Add class `selected` to the selected one. If nothing is owned show the muted `No tools yet.`. Keep `Open box`/`Close box` as the only button in the old repair row (its row heading becomes `Box`); headings: `Tools` (tray), `Box`, `Decide`. Esc (keydown on `document` while a shift is active) clears the selection. Selection is cleared when the package changes (`s.index` differs from the last render), when `view` changes (open/close), and when a selected supply's stock is 0.
- [ ] **Step 2: Routing.** Write `const use = (target: UseTarget) => () => { if (!selectedTool) return <existing note/read behavior>; … }`: with a tool selected, a marker/label/stage/item click calls `act((st) => useTool(st, selectedTool!, target), actionFor(tool))` where `actionFor` returns `'repair'` for supplies and the tool id for inspect tools (existing `PackageAction` values; map `rotateTool`/`flipTool` to no animation), then clears `selectedTool` when `isOneShot(tool)` and the use succeeded (`result.state !== previous`), or when the supply ran out. Without a selection the markers keep their note/read behaviour. The canvas (`.stage canvas`) gets a click handler that uses the `package` target when a tool is selected. Defect markers pass `{kind:'defect', id}`; label markers pass `shippingLabel`/`contentsLabel`; leak markers and the contents-list item rows (make each row's name a button while a tool is selected) pass `{kind:'item', itemId}`. Add class `target` to markers/rows for which `canTarget(selectedTool, target)` holds while a tool is selected, and set `.stage` data attribute `data-tool="1"` while selected (for the cursor).
- [ ] **Step 3: Styles.** `.tray{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}`; `.tool{position:relative;padding:4px;border:3px solid transparent;border-radius:10px;background:#3a4150}`; `.tool.selected{border-color:#f6e05e;box-shadow:0 0 0 2px rgba(246,224,94,.35),0 0 12px rgba(246,224,94,.6);background:#4a5368}`; `.tool .count{position:absolute;right:-4px;bottom:-4px;background:#1a1d23;border-radius:10px;padding:0 6px;font-size:12px}`; `.stage[data-tool] canvas, .stage[data-tool] .marker{cursor:crosshair}`; `.marker.target{border-color:#68d391;background:rgba(104,211,145,.14)}` (solid, visible without hover).
- [ ] **Step 4:** `yarn test && yarn tsc --noEmit && yarn build` → green. Fix the two button tests nothing covers; there is no DOM test seam in app.ts, so do not invent one.
- [ ] **Step 5: Visual check (controller).** Start `pack-inspect` preview; in `preview_eval` import `/src/ui/toolArt.ts` (cache-bust `?t=`) and render all twelve tools at 48px and 96px on a dark swatch, plus a selected-border mock via the real stylesheet class; verify each is recognizable and distinct. Then drive the real UI: `import('/src/main.ts')` is the app; to reach tools, in `preview_eval` build a campaign state is not exposed, so instead run the app and use `localStorage`-free steps: play Day 1, buy tools in the shop, start Day 2, and via real clicks: select scale (gold border), click the package (note appears, tool put down), select tape and click the package (message `Click the thing you want to fix.`, no supply spent), select tape and click a torn-tape marker (fixed, count decrements). Console must have no errors. Stop the server.
- [ ] **Step 6: Commit** `"Use tools as objects: pick one up, then click what to use it on"`, then squash: `git reset --soft main && git commit -m "Tools are objects you pick up and click onto things

Inspection tools and repair supplies are drawn objects in a tray. Selecting one gives
it a gold border; clicking the package, a defect, a label or an item uses it there.
Repairs now fix only the clicked target and a wrong target spends nothing."`
