# Faces, Rotate/Flip and Shapes — Design

Extends `2026-10-08-views-and-notes-design.md`. Where they disagree, this document wins for
Flip, the back view, defect visibility and the shape note.

## Shapes and faces
Every package kind has a shape. A shape has some faces on its **up** side (turned with
Rotate) and some on its **down** side (reached with Flip).

| Shape | Kinds | Up faces (Rotate) | Down faces (after Flip) |
|---|---|---|---|
| cuboid | box, parcel | 4 sides | 1 underside |
| cylinder | can, jar, tube | 1 round side | 1 base |
| triangular prism | prism (new) | 3 sides | none: cannot be flipped |
| tetrahedron | tetra (new) | 4 faces | 4 faces |

- **Rotate** turns the package to the next face on the side it is showing and wraps around.
  On a shape with one face on that side it does nothing (message: "This shape has only one
  side to turn.").
- **Flip** toggles between the up side and the down side and shows face 1 of the new side.
  A shape with no down faces refuses ("This shape cannot be flipped.").
- Rotate and Flip are two buttons; both need the purchased "Rotate / flip" tool. Both are
  refused while the box is open ("Close the box first."), and Open is refused while flipped
  (unchanged). Flipping to the down side counts as using the tool (its clues become
  available), as before.
- Inspection tools (scale, shake, UV, pebble, stethoscope) work on any up face with the box
  closed; they are refused on the down side and while open (unchanged).

## New shapes arrive later
Prisms can appear from Day 4 and tetrahedrons from Day 6. Days 1 to 3 use the five existing
kinds. New kinds use these defect kinds: prism: torn tape, crushed corner and every defect
that fits any kind; tetra: bottomless, soggy cardboard and every defect that fits any kind.

## Where defects sit
Each package remembers a placement (`side` and `face`) for the defects that live on a
surface. From Day 2 (the Rotate / flip tool is on sale after Day 1) the generator spreads them:
- **Surface defects** (leaking, crushed corner, torn tape, bulging, missing label) sit on a
  random up face.
- **Underside defects** (bottomless, soggy cardboard) sit on a random down face of shapes that
  have one.
- Everything else (UV-only glows, storms, sounds, readings) has no face.
On Day 1, and for defects without a stored placement, surface defects sit on up face 1 and
underside defects on down face 1.
Faceless defects (UV-only glows, storms) show on every up face once their tool is used.
A player who has not bought the Rotate / flip tool only ever sees up face 1, so from Day 2 they
will miss defects on other faces; that is accepted (it is the cheapest tool and Reject is always
available). The faces caption still shows how many faces a package has.

## Visibility and "seen"
- **Markers:** a defect has a marker in the front view only on the up face currently showing
  and in the back view only on the down face currently showing. Tools that reveal it: front =
  look and UV light; back = flipping (rotate) and UV light. The pebble drop is face-agnostic:
  once used it shows a bottomless defect on whatever up face is showing.
- **Seen faces:** the handling remembers which faces the player has shown (`visited`, starting
  with up face 1). A surface defect only counts as *revealed* (and so repairable) once its face
  has been shown, so a repair can no longer fix a defect on a face the player never looked at.
  Non-surface clues (pebble, sounds, readings, inside) are unaffected.
- Turning to a new face never records a note; the player still clicks markers.

## Notes
The first note of every package is its shape, recorded automatically when the package
arrives: "Shape: cuboid. Four sides to rotate; flip it for the underside." (cylinder: "One
round side; flip it for the base."; prism: "Three sides to rotate; it cannot be flipped.";
tetrahedron: "Four sides to rotate; flip it for four more.").

## Drawing
Prism and tetra get their own colors and outlines (a wide block and a triangle). Every outside
view shows a caption such as "Side 2 of 4" or "Underside 3 of 4" for shapes with more than
one face. The missing-label outline and its marker sit inside the triangle for tetrahedrons.

## Architecture
- `src/game/shapes.ts`: shapes, face counts, `placementOf`, `faceKey`, `shapeNote`.
- `src/game/types.ts`: `PackageKind` gains prism and tetra; `Placement`; `Package.placements`;
  `Handling.face` and `Handling.visited`.
- `src/game/inspection.ts`: face-aware `visibleDefects`, `markerClues`, `revealedDefects`;
  the shape clue.
- `src/game/shift.ts`: `rotateBox`; `flipBox` resets the face and handles shapes.
- `src/game/packages.ts`: kinds by day and placements.
- `src/ui/*`: new shapes' geometry and art, the face caption, a Rotate button.
