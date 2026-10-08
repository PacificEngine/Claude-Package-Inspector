# Contents — Design (Phase 2)

Extends `2026-10-08-views-and-notes-design.md` and `2026-10-08-faces-and-shapes-design.md`.
Where they disagree, this document wins for weights, soggy cardboard, the missing contents
label and the inside screen.

## Items
Every package holds one to three **legit items** chosen from a small catalog per kind (for
example a teapot, rubber ducks, peaches, strawberry jam). Each item has an id, a plain-noun
name, a weight in kg, and how it is drawn. Some items carry hidden flags the player must
find out for themselves: **extra** (should not be there) and **leaking**.

- Package weight = packaging + the sum of all items. The label's **declared weight** counts
  only the legit items.
- The label's **contents list** (shown under the address) names the legit items.
- Every package contains something when opened, including bottomless boxes (the contents
  sink toward the void).

## Wrong weight (changed)
A package with the *wrong weight* defect also holds one or two **stowaway** items (a brick,
sandbags, a rock) that weigh the difference. The Relabel kit no longer fixes it.
- With the box open and the Scale tool owned, each item can be **weighed** individually
  (recorded in Notes: "The brick weighs 0.6 kg.").
- **Throw away** removes an item for good. The weight defect is resolved exactly when the
  package's current weight (original weight minus thrown-away items) equals the declared weight
  (within 0.05 kg). The contents list on the label shows which items belong.
  Any set of thrown-away items that brings the weight back to the declared weight resolves the
  defect, even if it is not exactly the stowaways (for example swapping an equal-weight legit
  item). This is accepted: the label's contents list shows which items belong, and a careful
  player is never punished.
- Opening is free when wrong weight is the reject-worthy problem (the box must be opened);
  throwing items away is free.
- *Heavier inside than outside* gets one **impossibly dense marble** item. It stays
  unrepairable (reject), though discarding it does change the scale reading.

## Soggy cardboard (changed)
About half of soggy-cardboard packages also hold a **leaking item** that is the cause.
- The leaking item is drawn with drips; clicking its marker on the inside screen records
  "The <item> is leaking." in Notes.
- **Sealant used on an open box with an unsealed leaking item seals one such item** ("Fixed:
  the leaking teapot.") and does not touch the cardboard that use. Once no unsealed leaking
  item remains, sealant fixes the cardboard as before. A box with no leaking item is fixed
  with one sealant, as before.
- Throwing a leaking item away also removes the cause.

## Missing contents label (changed)
All packages contain something, so a missing label always matters: the Relabel kit, used with
the box open, prints a label from the contents it sees (`labelItems`).
- The defect is resolved when it has been repaired **and** the label still matches the
  contents. Throwing items away afterwards breaks the match; using Relabel again (box open)
  reprints it and costs one more supply.
- If the box has been emptied, no label is needed.
- The address label can still be relabeled from outside, as before.

## Notes and screen
- Weighing and leaks are recorded by the player's actions, never automatically
  (weighing is an action on an item; leaks need a click on the marker).
- The scale reading in Notes follows what has been thrown away.
- The inside screen draws every remaining item spread along the floor; sealed items show a
  patch. Below the label card an inside-only **Contents** list shows each item with a
  **Weigh** button (needs the Scale tool) and a **Throw away** button, and the weight once
  weighed. The label card shows the contents list ("Contents: teapot, rubber ducks"), or
  "(missing)" when the label is missing.

## Architecture
- `src/game/contents.ts`: `Item`, `ContentsArt`, catalogs, packaging weights, `itemsIn`,
  `currentWeightKg`, `weightMatches`, `labelMatches`.
- `src/game/types.ts`: `Package.contents`, `Package.packagingKg`; `Handling.discarded`,
  `.sealed`, `.labelItems`.
- `src/game/defects.ts`: `repairedBy` may be `'discard'` (wrong weight).
- `src/game/packages.ts`: items, weights, stowaways, the marble, leaking items.
- `src/game/rules.ts`: weight and label resolution; `Problem.repairTool` may be `'discard'`.
- `src/game/repair.ts`: sealing an item, contents label printing.
- `src/game/shift.ts`: `weighItem`, `discardItem`, `noteLeak`.
- `src/game/inspection.ts`: item and leak clues; scale reading uses discards.
- `src/ui/*`: multi-item inside drawing, item markers, the Contents list, label card line.
