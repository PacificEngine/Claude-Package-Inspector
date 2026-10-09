# Orientation: Flip and Rotate — Design

Extends `2026-10-08-faces-and-shapes-design.md`. Where they disagree, this document wins for
Flip, Rotate, the faces a package has, what the player is told about them, and where repair
patches are drawn.

## The model
A package's orientation is two counters:
- **flip position** `flipPos`: where it is in the shape's flip cycle.
- **turn** `turn`: a running count of rotations (positive or negative).

The face on show is a pure function of the shape, the flip position and the turn.

### Boxes and parcels (cuboid) and cans, jars and tubes (cylinder)
The flip cycle has four positions. With S = the side the package was upright on (`turn` modulo
the number of sides):

| position | what you see |
|---|---|
| 0 | side S, upright |
| 1 | the top (spun by the turn) |
| 2 | side S + 2 (the opposite side), **upside-down** |
| 3 | the bottom (spun the other way) |

Flip moves to the next position (0, 1, 2, 3, 0, …).

A cuboid has four sides, so S is one of four. A cylinder has one round side, so S makes no
visible difference and the cycle reads: side, top, side upside-down, bottom, side.

### Rotate
Rotate always works (while the box is closed). It changes the turn by **+1 in positions 0 and 1
and by -1 in positions 2 and 3** (the package is upside-down there, so it spins the other way).
- On a side it turns to the next side (cuboids and prisms).
- On the top or bottom it only spins the picture, and changes which side comes next when you
  flip.
- Upside-down it stays upside-down and turns to a different side.

Worked examples (cuboid, sides numbered 1 to 4):
- Face 1, flip: top. Flip: upside-down face 3. Flip: bottom. Flip: face 1.
- Face 2, flip: top. Flip: upside-down face 4. Flip: bottom. Flip: face 2.
- Face 1, flip: top. Rotate. Flip: upside-down face 4. Flip: bottom. Rotate. Flip: face 1.

### Prisms and tetrahedrons
- **Triangular prism:** three sides; Rotate steps through them; it cannot be flipped.
- **Tetrahedron:** two flip positions: four faces on its up side, four on its down side. Rotate
  steps through the faces on the side showing (always +1); Flip switches sides.

## Nothing says where you are
- No "Side 2 of 4" caption, no "Rotate (2/4)" button label, no numbers in messages ("You turn the
  package.", "You flip the package over."). Flip cannot be used on a prism ("This shape cannot be
  flipped."); there are no other refusals that depend on position beyond the box being open.
- There is no per-face shading. The player tells where they are from what they see: the top shows
  a tape seam, the bottom a taped base, labels are upside-down when the package is.

## Where things sit
Faces are the same placements as before, with the top and bottom made explicit:
- Cuboid: sides `up:0..3`, top `up:4`, bottom `down:0`. Cylinder: side `up:0`, top `up:1`,
  bottom `down:0`. Prism: sides `up:0..2`. Tetrahedron: `up:0..3`, `down:0..3`.
- From Day 2 the generator places: leaks, crushed corners, bulges and the missing contents
  label on a random **side**; the **torn tape on the top** of boxes and parcels (a random side
  on prisms); bottomless and soggy cardboard on the **bottom** (a random down face of a tetrahedron).
  The contents label is on a random side (`labelFace` is a side index). The shipping label is on
  side 1. On Day 1 nothing is placed, so everything starts on side 1.
- Opening, the inspection tools and the labels: Open and the inspection tools need the package
  upright on a side (position 0) and closed. A label can be read whenever its side is showing
  (even upside-down) and the box is closed.

## Patches
A repair patch is drawn only on the face of the defect it fixed, at the defect's own place on
that face, and the repair flash plays only when that face is showing. Defects with no face on the
outside (storms, glows, sounds, inside defects, sealed items) draw no outside patch.

## Architecture
- `src/game/shapes.ts`: ring length, side count, `shownFace`, `rotateDelta`, `orient`.
- `src/game/types.ts`, `handling.ts`: `Handling.flipPos` and `turn` are the source of truth;
  `flipped`, `face`, `upsideDown`, `spin` are derived by `orient` after every move so the
  existing view, marker and visibility code keeps working. `viewOf`: opened is inside; a face
  on the down side (a bottom, a tetrahedron's down faces) is back; every other face is front.
- `src/game/shift.ts`, `packages.ts`: the actions and the placement of the torn-tape top.
- `src/ui/geometry.ts`, `markers.ts`, `packageArt.ts`, `app.ts`: top, bottom, upside-down and
  spun faces, patches where the fix was, no hints, plain Rotate and Flip buttons.
