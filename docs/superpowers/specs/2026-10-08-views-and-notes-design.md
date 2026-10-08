# Views, Notes and Closing — Design (Phase 1)

Extends `2026-10-08-pack-inspect-design.md`. Where the two disagree, this document wins
for the sections it covers (inspection tools, notes, opening, closing, fines, repair rules).

Phase 2 (a separate spec): packages hold several individually weighable items, items can
leak, wrong weight is fixed by discarding items, and a missing contents label must be
rewritten to match the contents. Nothing in Phase 2 is built here.

## Three views of the package
Only one view is on screen at a time. The view is derived from the handling state:
`opened` -> **inside**, else `flipped` -> **back**, else **front**. A package is never both
open and flipped.

- **Front (default):** the closed package. Exterior markers and exterior repairs live here.
  Inspection tools (scale, shake, UV light, pebble, stethoscope) can only be used in this view.
- **Back:** the other side of the box, shown until the player clicks Flip box again. Back
  markers: no bottom (void), damp stain, crushed corner, bulging base.
- **Inside:** a separate screen showing the open box and its contents, larger than the old
  overlay. Interior markers: void, tiny storm, liquid, clock, glow, odd gadget, wavy lines.

### Moving between views
- **Open box** (front only) switches to Inside. **Close box** returns to Front.
- **Flip box** toggles Front and Back and stays on the back until clicked again. It is the
  purchased "Rotate / flip" tool: without it there is no Flip button. The first flip counts
  as using the tool (its clues become available). Flip is refused while the box is open and
  Open is refused while flipped.
- There is no open or flip animation; the screen cuts to the new view. Tool animations
  (shake, scale, UV, pebble, stethoscope, repair) still play on the front view.

## Closing before shipping
SHIP is disabled while the box is open, and `stamp(…, 'ship')` refuses an open box with the
message "Close the box before shipping." without a strike. REJECT is always allowed.

## Notes
Notes start empty. What gets recorded depends on the clue's channel (by tool):
- **Visual** (look, flip, UV light, pebble): recorded only when the player clicks the
  drawn marker of that defect in the current view. Clicking records every visual clue of that
  defect revealed so far (front/back) or its inside clue (inside view). Noted markers keep a faint outline so the player can see what they have recorded. Each marker is also a real button, so keyboard and screen-reader users
  can record it too.
- **Sound** (shake, stethoscope): using the tool plays a generated noise for each defect it
  reveals (rattle, hum, whisper, tick, slosh, thunder) and records the clues automatically.
  A quiet result is recorded too, with no sound.
- **Reading** (scale): recorded automatically when the scale is used.
- Quiet visual results ("looks fine") are never recorded.
- Notes never show clues of repaired defects.

## Inside clues
Defects that show when the box is opened carry an `insideClue`: no bottom, tiny weather,
leaking, ticking, hotter than the sun, contents from the future, humming, whispering.
While the box is open these defects count as revealed, so they can be repaired without the
tool that normally detects them.

## Repairs and opening
Each defect declares whether repairing it needs the box open (`repairNeedsOpen`):
- **No:** torn tape and crushed corner (duct tape from the outside). The address label can
  be relabeled from the outside.
- **Yes:** every other defect.

With the box closed a repair fixes only the defects that can be repaired from outside (and relabels the address). It is refused ('Open the box first.') only when it would fix nothing outside while a revealed defect that needs the box open exists for that tool; a tool with nothing to fix still wastes a supply.

## Fines
A package "needs opening" when it has at least one reject-worthy problem, every reject-worthy
problem is repairable, and at least one of them needs the box open. Opening a package that
does not need opening is fined 2x its shipping fee, once per package: closing and reopening
never charges again. Opening a package that needs opening is free.

## Contents
Every opened package shows an item. A bottomless box shows its item sinking into the void.
The text under the label names only the item; anything wrong inside must be spotted by
clicking its marker. Contents of repaired defects disappear (the void closes, the storm clears).

## Architecture
- `src/game/handling.ts`: `viewOf(handling)`; handling gains `flipped`, `fined`, `notes`.
- `src/game/defects.ts`: `repairNeedsOpen`, `insideClue`.
- `src/game/inspection.ts`: clue channels and keys, inside clues, noted clues, visible defects per view.
- `src/game/rules.ts`: `needsOpening` replaces `needsRepair`.
- `src/game/shift.ts`: `closeBox`, `flipBox`, `noteDefect`, `currentNotes`; rules above.
- `src/audio/`: six new sound events, detected from newly used sound tools.
- `src/ui/geometry.ts`, `src/ui/markers.ts`: shared geometry and the pure marker regions.
- `src/ui/packageArt.ts`: front, back and inside drawings.
- `src/ui/app.ts`: view-dependent buttons, marker overlay buttons, notes list.

## Testing
TDD on everything in `src/game/`, the pure marker geometry, the audio event detection and the
sfx specs. Drawing and layout are verified visually in the browser preview.
