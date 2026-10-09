# Reference Tabs, Labels and Restricted Items — Design

Extends `2026-10-08-contents-design.md`, `2026-10-08-faces-and-shapes-design.md` and
`2026-10-08-views-and-notes-design.md`. Where they disagree, this document wins for the
shape note, the weight rule, the labels on the package and the rule panel.

## Reference tabs
Under the rule card, four buttons switch what one panel shows. **Rules** is the default.
- **Rules:** today's card, as before.
- **Shapes:** one entry per package shape that can appear today (cuboid always, cylinder always,
  triangular prism from Day 4, tetrahedron from Day 6), with the kinds that use it and its
  description: faces to rotate, whether it flips and what flip shows.
- **Addresses:** shown on a day when the card has an address-format rule (missing field,
  smudged label, ZIP must match the city). It explains each such rule and whether it is
  *rejected* or *tolerated* today, and shows the table of matching cities and ZIP codes when a
  ZIP rule is on the card.
- **Restrictions:** shown on a day when the card names a restricted destination (PO boxes, Fort
  Hush, "Nowhere Lane", below sea level, the Moon) or a restricted item. It lists the rejected
  destinations and the restricted items.
The chosen tab is kept from package to package. If it disappears on a new day, Rules is shown.

## Shape note
The first note of a package names its shape only: "Shape: cuboid", "Shape: cylinder",
"Shape: triangular prism", "Shape: tetrahedron". The description lives in the Shapes tab, so
the player has to look there to learn how the shape turns.

## Restricted items (new rule)
From Day 4 a rule card can list **restricted items** (by name). A package holding a restricted
item must not ship as it is. It is fixed by opening the box and throwing that item away (free).
- Days: 4 candles; 5 honey and cheese wedges; 6 peaches and dice; 7 candles, rubber ducks and
  strawberry jam. Days 1 to 3 have none.
- It is a reject-worthy *problem* of its own kind (`restricted_item`), repairable by discarding,
  needing the box open, so opening such a box is free. The strike message names it
  ("restricted candles").
- The generator needs no change: items come from the catalogs, so restricted ones turn up by chance.
- A box emptied by throwing away its only item has nothing left to restrict or label and is shippable at the usual fee; this follows the rule that an emptied box needs no label and is a rule to revisit.

## Weight rule (tightened)
Throwing away a legit item no longer helps or hurts a wrong-weight package. The weight is
compared with the declared weight **minus the legit items thrown away**, so exactly the
stowaways must go. (This replaces the earlier "any weight-restoring discard" ruling and keeps
a package that also holds a restricted item solvable.)

## Labels on the package
A package carries two labels, each shown only when its face is showing:
- **Shipping label:** on up face 1. Clicking it reads the address and declared weight into the
  panel under the picture.
- **Contents label:** on a per-package up face (`labelFace`; random from Day 2, face 1 on Day 1
  and on shapes with one up face). Clicking it reads the contents list into the panel. When the
  contents label is missing, a dashed outline marks its place on that face, as before; the
  missing-label defect always sits on `labelFace`.
- **Nothing is shown until read.** The panel under the picture shows a hint for each label until
  it is clicked. Reading is free, needs no tool, and works only face up with the box closed
  and the right face showing. A reprinted contents label can be read again.
- A player without the Rotate / flip tool may never reach the contents label's face; that is accepted, because its information is never required (the inside Contents list names every item).
- The scale's note quotes the declared weight, so that figure is visible once the scale is used even before the shipping label is read; the scale compares against the label.

## Architecture
- `src/game/shapes.ts`: `shapeNote` returns only the name.
- `src/game/rules.ts`: `RuleCard.restrictedItems`; `Problem` gains source `'item'`, id
  `'restricted_item'`, `itemId`; card text for Days 4 to 7.
- `src/game/contents.ts`: weight comparison uses the declared weight minus discarded legit items.
- `src/game/types.ts`, `packages.ts`: `Package.labelFace`; `Handling.addressRead`, `.contentsRead`.
- `src/game/shift.ts`: `readLabel`.
- `src/ui/reference.ts` (pure): which tabs exist and what each shows.
- `src/ui/geometry.ts`, `markers.ts`, `packageArt.ts`, `app.ts`: label rectangles and drawing,
  label markers, the tab buttons and the label panels.
