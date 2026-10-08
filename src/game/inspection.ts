import { DEFECTS } from './defects';
import type { DefectId, Handling, InspectionTool, Package, View } from './types';

export type ClueChannel = 'visual' | 'sound' | 'reading';
export type ClueSource = InspectionTool | 'inside';

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

// The tools that can show something on each side of the package.
const VIEW_TOOLS: Record<'front' | 'back', readonly InspectionTool[]> = {
  front: ['look', 'uv', 'pebble'],
  back: ['rotate'],
};

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

// Defects the player knows about: found by a tool they used, or visible because the box is open.
export function revealedDefects(pkg: Package, handling: Handling): DefectId[] {
  return pkg.defects.filter(
    (id) =>
      !handling.repaired.includes(id) &&
      (Object.keys(DEFECTS[id].clues).some((tool) => handling.used.includes(tool as InspectionTool)) ||
        (handling.opened && DEFECTS[id].insideClue !== undefined)),
  );
}

// Defects with a drawn marker in the given view.
export function visibleDefects(pkg: Package, handling: Handling, view: View): DefectId[] {
  return pkg.defects.filter((id) => {
    if (handling.repaired.includes(id)) return false;
    const def = DEFECTS[id];
    if (view === 'inside') return def.insideClue !== undefined;
    return VIEW_TOOLS[view].some((t) => def.clues[t] !== undefined && handling.used.includes(t));
  });
}

// What clicking a defect's marker in this view records.
export function markerClues(
  pkg: Package,
  handling: Handling,
  defect: DefectId,
  view: View,
): Clue[] {
  if (view === 'inside') {
    return insideCluesFor(pkg, handling.repaired).filter((c) => c.defect === defect);
  }
  return VIEW_TOOLS[view]
    .filter((t) => handling.used.includes(t))
    .flatMap((t) => cluesFor(pkg, t, handling.repaired))
    .filter((c) => c.defect === defect);
}

// The clues the player has recorded, in the order they recorded them.
export function notedClues(pkg: Package, handling: Handling): Clue[] {
  const known = [
    ...handling.used.flatMap((t) => cluesFor(pkg, t, handling.repaired)),
    ...insideCluesFor(pkg, handling.repaired),
  ];
  return handling.notes
    .map((key) => known.find((c) => c.key === key))
    .filter((c): c is Clue => c !== undefined);
}
