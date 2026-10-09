# Tools as objects — Design

Replaces the Inspect and Repair button rows with a tray of drawn tool objects used by
select-then-click. Where this disagrees with earlier specs about how repairs are applied, this wins.

## Interaction
- The **tray** lists every owned tool as a small drawn object (canvas, flat style like the package
  art): scale, shake, UV light, drop-test pebble, stethoscope, a turntable (Rotate) and a flip bar
  (Flip) — both from the one Rotate / flip purchase — and each supply that has stock (duct tape,
  sealant, relabel kit, pressure valve, foam) with its remaining count. Each object is a real
  `<button>` with an accessible name; the name also shows as a tooltip (`title`).
- Click an object to **select** it: a thick solid gold border plus glow (`.tool.selected`), and a
  crosshair cursor over the stage. Click it again, or press Esc, to put it down. Selecting another
  tool replaces the selection. The selection clears on a new package, on opening/closing the box,
  and when a supply runs out. It stays selected after a successful use of an inspection tool
  (the player keeps clicking), except an inspection tool that can only be used once per package
  (scale/shake/uv/pebble/stethoscope) which is put down after use.
- **No tool selected:** clicking a marker takes a note and clicking a label reads it, as before.
- **Inspection tools** (scale, shake, UV, pebble, stethoscope), **Rotate** and **Flip**: select, then
  click the package (the canvas, a defect marker or a label — all count as "the package"). The scale
  can also be used on the contents: select it, then click an item inside the box to weigh it.
- **Repair supplies:** select, then click the thing to fix:
  - a defect marker → fixes that one defect (tape, sealant, valve, foam, relabel for a missing label);
  - the shipping label → relabel kit fixes the address;
  - the contents label → relabel kit reprints it (box open, label wrong);
  - a leaking item inside → sealant seals it.
  While a supply is selected, valid targets get a highlighted outline (`.marker.target`).
- Buttons that remain: Open box / Close box, Throw away, SHIP, REJECT.
- Tools needing an upright face (inspection tools, open) still refuse otherwise, with their existing
  messages; Rotate and Flip behave as in the orientation spec.

## Repair rules (game layer)
- `applyRepair(pkg, handling, inventory, tool, target)` fixes only the clicked target.
  `RepairTarget = { kind: 'defect'; id: DefectId } | { kind: 'shippingLabel' } | { kind: 'contentsLabel' } | { kind: 'item'; itemId: number } | { kind: 'package' }`.
- **Inside the open box**, clicking the inside (the `package` target while `handling.opened`) with a supply fixes the first revealed defect that supply repairs and that needs the box open (missing label, bulge, soggy cardboard, etc.), else, for the relabel kit, reprints the contents label when it is wrong; otherwise `Nothing to fix there.` This is because those defects have no marker inside the open box. With the box closed the `package` target with a supply is still refused.
- A target the tool cannot fix (including clicking the closed package with a supply, or tape on a label)
  returns `{ ok: false, reason }` and **spends nothing**. Reasons: defect → `That tool does not fix that.`;
  package → `Click the thing you want to fix.`; shipping label with nothing wrong or already
  relabeled → `Nothing wrong with that label.`; contents label → `That label does not need reprinting.`;
  item not leaking or already sealed → `Nothing to fix there.`
- A defect target must be revealed (as `revealedDefects` today) and match `DEFECTS[id].repairedBy === tool`;
  if it needs the box open and the box is closed → `Open the box first.` (no spend). One use fixes one
  defect (missing_label also prints the label as today).
- Out of stock → `You are out of that supply.` (unchanged). Success spends one supply.
- The `repair()` shift action takes the target: `repair(s, tool, target)`.

## UI architecture
- `src/ui/toolActions.ts` (pure): `ToolId = Exclude<InspectionTool,'look'|'rotate'> | 'rotateTool' | 'flipTool' | RepairTool`; `UseTarget = { kind: 'package' } | RepairTarget-ish` (package, defect, shippingLabel, contentsLabel, item); `useTool(s, tool, target): ActionResult` maps to `inspect`, `rotateBox`, `flipBox`, `weighItem`, `repair`; wrong tool/target combos return a message and the unchanged state. `toggleTool(selected, tool)`; `ownedTools(inventory)`; `canTarget(tool, target)` (used for highlighting).
- `src/ui/toolArt.ts`: `drawTool(ctx, tool, size)` for all twelve objects.
- `src/ui/app.ts`: `selectedTool` state, the tray (replacing the two rows), marker/label/stage/item click routing, Esc handling, highlight class, supply-out deselect.
- `src/styles.css`: `.tray`, `.tool`, `.tool.selected`, `.marker.target`, crosshair cursor.
