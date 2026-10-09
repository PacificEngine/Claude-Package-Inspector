import { DEFECTS } from './defects';
import { faceKey, isFaceless, placementOf, shapeNote } from './shapes';
import type { DefectId, Handling, InspectionTool, Package, Side, View } from './types';

export type ClueChannel = 'visual' | 'sound' | 'reading';
export type ClueSource = InspectionTool | 'inside' | 'shape';

export interface Clue {
  key: string; // stable id used to record the clue in notes
  source: ClueSource;
  defect: DefectId | null;
  channel: ClueChannel;
  text: string;
}

export const CLUE_CHANNEL: Record<InspectionTool, ClueChannel> = {
  look: 'visual',
  rotate: 'visual',
  uv: 'visual',
  pebble: 'visual',
  scale: 'reading',
  shake: 'sound',
  stethoscope: 'sound',
};

const QUIET: Record<InspectionTool, string> = {
  look: 'Looks fine from the outside.',
  rotate: 'Nothing odd on any side.',
  scale: '',
  shake: 'Quiet. Nothing moves inside.',
  uv: 'Nothing glows under the UV light.',
  pebble: 'The pebble lands with a plink.',
  stethoscope: 'Only silence.',
};

// The tools that reveal a surface defect while its face is showing.
const FACE_TOOLS: Record<'front' | 'back', readonly InspectionTool[]> = {
  front: ['look', 'uv'],
  back: ['rotate', 'uv'],
};
// The tools whose clues a marker can record in each outside view (the pebble works on any up face).
const CLUE_TOOLS: Record<'front' | 'back', readonly InspectionTool[]> = {
  front: ['look', 'uv', 'pebble'],
  back: ['rotate', 'uv'],
};
const SURFACE_TOOLS: readonly InspectionTool[] = ['look', 'uv', 'rotate'];

const shapeClue = (pkg: Package): Clue => ({
  key: 'shape',
  source: 'shape',
  defect: null,
  channel: 'reading',
  text: shapeNote(pkg.kind),
});

const clueKey = (source: ClueSource, defect: DefectId | null): string =>
  `${source}:${defect ?? 'none'}`;

export function cluesFor(
  pkg: Package,
  tool: InspectionTool,
  repaired: readonly DefectId[] = [],
): Clue[] {
  const channel = CLUE_CHANNEL[tool];
  const make = (defect: DefectId | null, text: string): Clue => ({
    key: clueKey(tool, defect),
    source: tool,
    defect,
    channel,
    text,
  });
  const clues: Clue[] = [];
  if (tool === 'scale') {
    clues.push(
      make(null, `Scale reads ${pkg.actualWeightKg} kg (label says ${pkg.declaredWeightKg} kg).`),
    );
  }
  for (const id of pkg.defects) {
    if (repaired.includes(id)) continue;
    const text = DEFECTS[id].clues[tool];
    if (text) clues.push(make(id, text));
  }
  const foundDefect = clues.some((c) => c.defect !== null);
  if (!foundDefect && QUIET[tool]) clues.push(make(null, QUIET[tool]));
  return clues;
}

export function insideCluesFor(pkg: Package, repaired: readonly DefectId[] = []): Clue[] {
  return pkg.defects
    .filter((id) => !repaired.includes(id) && DEFECTS[id].insideClue !== undefined)
    .map((id) => ({
      key: clueKey('inside', id),
      source: 'inside' as const,
      defect: id,
      channel: 'visual' as const,
      text: DEFECTS[id].insideClue as string,
    }));
}

// Defects the player knows about: seen on a face they have shown, found by a non-surface tool,
// or visible because the box is open.
export function revealedDefects(pkg: Package, handling: Handling): DefectId[] {
  return pkg.defects.filter((id) => {
    if (handling.repaired.includes(id)) return false;
    const def = DEFECTS[id];
    const tools = Object.keys(def.clues) as InspectionTool[];
    const p = placementOf(pkg, id);
    const seen = handling.visited.includes(faceKey(p.side, p.face));
    const bySurface = seen && tools.some((t) => SURFACE_TOOLS.includes(t) && handling.used.includes(t));
    const byOther = tools.some((t) => !SURFACE_TOOLS.includes(t) && handling.used.includes(t));
    return bySurface || byOther || (handling.opened && def.insideClue !== undefined);
  });
}

// Defects with a drawn marker in the given view, on the face that is showing.
export function visibleDefects(pkg: Package, handling: Handling, view: View): DefectId[] {
  return pkg.defects.filter((id) => {
    if (handling.repaired.includes(id)) return false;
    const def = DEFECTS[id];
    if (view === 'inside') return def.insideClue !== undefined;
    const side: Side = view === 'front' ? 'up' : 'down';
    const p = placementOf(pkg, id);
    const onThisFace = p.side === side && (p.face === handling.face || (view === 'front' && isFaceless(id)));
    const bySurface =
      onThisFace && FACE_TOOLS[view].some((t) => def.clues[t] !== undefined && handling.used.includes(t));
    const dropped = view === 'front' && def.clues.pebble !== undefined && handling.used.includes('pebble');
    return bySurface || dropped;
  });
}

// What clicking a defect's marker in this view records.
export function markerClues(pkg: Package, handling: Handling, defect: DefectId, view: View): Clue[] {
  if (view === 'inside') {
    return insideCluesFor(pkg, handling.repaired).filter((c) => c.defect === defect);
  }
  if (!visibleDefects(pkg, handling, view).includes(defect)) return [];
  return CLUE_TOOLS[view]
    .filter((t) => handling.used.includes(t))
    .flatMap((t) => cluesFor(pkg, t, handling.repaired))
    .filter((c) => c.defect === defect);
}

// The clues the player has recorded, in the order they recorded them.
export function notedClues(pkg: Package, handling: Handling): Clue[] {
  const known = [
    shapeClue(pkg),
    ...handling.used.flatMap((t) => cluesFor(pkg, t, handling.repaired)),
    ...insideCluesFor(pkg, handling.repaired),
  ];
  return handling.notes
    .map((key) => known.find((c) => c.key === key))
    .filter((c): c is Clue => c !== undefined);
}
