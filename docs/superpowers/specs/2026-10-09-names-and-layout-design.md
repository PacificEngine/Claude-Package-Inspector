# Names and layout — Design (build 1 of 3)

Part of a larger request split into: (1) this, (2) marker tool and tool-only highlighting,
(3) reject-with-a-rule, progressive fines, strike bonus. Only build 1 is specified here.

## Type names, not shapes
- A package has a cosmetic `typeName`: `box`, `parcel`, `can`, `jar`, `tube` for those kinds;
  a prism-shaped package (`kind: 'prism'`) is a `tent` or a `cheese wedge`; a tetrahedron
  (`kind: 'tetra'`) is a `pyramid` or a `tea pyramid`. Chosen from the seeded rng per package;
  art, flipping and contents still follow the kind.
- The Notes line is `Type: <typeName>` (was `Shape: cuboid`). `shapeName`/`shapeNote` are replaced by
  a `typeName`-based note; no geometry words ("cuboid", "cylinder", "prism", "tetrahedron") appear
  in player-visible text.
- The Shapes tab headings are the item types: `Boxes and parcels`, `Cans, jars and tubes`,
  `Tents and cheese wedges`, `Pyramids and tea pyramids`; the separate "kinds" line goes away.
  Descriptions (how it flips and rotates) are kept, reworded to avoid geometry terms.

## Declared weight on the contents label
The shipping panel shows only the address lines. The contents panel shows `Contents: …` and
`Declared weight: N kg`.

## Cylinders have a backside
A cylinder's round side has two faces (front, back): `sideCount` 2. Faces: sides `up:0`, `up:1`,
top `up:2`, bottom `down:0`. Rotate on a side swaps front and back; flip is side, top,
the same side upside-down, bottom (the opposite side of a two-sided cylinder is the same face).
The shipping label is on the front; the contents label is on a random face (as for boxes);
surface defects are placed on a random face. The back is drawn as a plain face (no shipping
label) unless it carries the contents label. Update the Shapes text.

## Restrictions are people, towns and addresses
- PO boxes stay an address rule but are no longer listed on the Restrictions tab (they are a line on
  the rule card, i.e. the Rules tab, as already worded in the cards).
- New address problem `restricted_person`: the recipient is one of two named restricted people
  (`Z. Blackwood`, `K. Mortimer`), label `Restricted recipient`, minimum day 3, repairable: no.
  Cards: reject on days 3, 4 and 7 (with a line in the card text naming the rule); unused on days
  1, 2, 5, 6 (not generated).
- The Restrictions tab lists, for the day's card: restricted people (names), towns (Fort Hush,
  Atlantis, Moon Base) and addresses ("1 Nowhere Lane"), then restricted items. The tab shows when
  the card rejects any of those or has restricted items. `restrictionGuide(card)` returns
  `{ people: string[]; towns: string[]; addresses: string[]; items: string[] }`.

## Addresses tab: an example, not rules
The Addresses tab shows a completed example address with what each line holds, then the city-ZIP
table when the card mentions the ZIP rule. No rule text. `addressGuide(card)` returns
`{ example: Array<{ line: string; meaning: string }>; cityZips: Array<{ city: string; zip: string }> }`.
Example lines (always the same fixed example):
1. `A. Pemberton` — Recipient: an initial and a surname.
2. `12 Elm Street` — Street: a house number and a street name.
3. `Maplewood 10001` — City and ZIP: the ZIP must belong to the city.
4. `Return: 40 Oak Road, Riverton` — Return address: where the package came from.
The tab appears when the card mentions a missing field, smudged label or ZIP issue (as now).

## Amendment: prism, tetrahedron and octahedron faces (same build)
- **Names:** prism `tent` / `wedge`; tetrahedron `pyraminx` / `caltrops`; new octahedron kind
  `octa` with `diamond` / `pyrite`. Shapes tab headings: `Tents and wedges`,
  `Pyraminxes and caltrops`, `Diamonds and pyrites`. (Replaces `cheese wedge`, `pyramid`, `tea pyramid`.)
- **Prism:** three sides, a top and a bottom (triangular). Flip cycle like a box: side, top, the
  opposite side upside-down, bottom (with three sides the "opposite" side is `turn + 2` mod 3).
  `sideCount` 3, `ringLength` 4, `hasTop`. Faces: sides `up:0..2`, top `up:3`, bottom `down:0`.
  Rotate delta as for boxes (+1 pos 0-1, -1 pos 2-3). Underside defects (bottomless, soggy
  cardboard) may now occur on prisms.
- **Tetrahedron:** four faces and a bottom, no top. `sideCount` 4, `ringLength` 2: position 0 a
  face `up:mod(turn,4)`, position 1 the bottom `down:0`. Faces: `up:0..3`, `down:0`. Rotate always +1.
- **Octahedron:** no top or bottom; four upper faces and four lower faces (the old tetrahedron
  model): `sideCount` 4, `ringLength` 2, position 0 `up:mod(turn,4)`, position 1 `down:mod(turn,4)`
  (view `back`), rotate +1. Drawn as a diamond. Appears from Day 7. Its own catalog items
  (three), packaging 0.3 kg, defect eligibility like the tetrahedron (any-kind defects and underside
  defects, no surface-only ones). Label rects, void rect and underside art behave as the
  tetrahedron's (smaller, inside the shape).
- Existing shape text is updated: prism `Three sides to rotate. Flip tumbles it: side, top, the
  opposite side upside-down, bottom.`; tetrahedron `Four faces to rotate. Flip it to see the bottom.`;
  octahedron `Four faces to rotate; flip it for four more.`
