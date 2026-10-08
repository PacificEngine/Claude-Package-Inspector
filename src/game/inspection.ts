import { DEFECTS } from './defects';
import type { DefectId, Handling, InspectionTool, Package } from './types';

export interface Clue {
  tool: InspectionTool;
  defect: DefectId | null;
  text: string;
}

const QUIET: Record<InspectionTool, string> = {
  look: 'Looks fine from the outside.',
  rotate: 'Nothing odd on any side.',
  scale: '',
  shake: 'Quiet. Nothing moves inside.',
  uv: 'Nothing glows under the UV light.',
  pebble: 'The pebble lands with a plink.',
  stethoscope: 'Only silence.',
};

export function cluesFor(
  pkg: Package,
  tool: InspectionTool,
  repaired: readonly DefectId[] = [],
): Clue[] {
  const clues: Clue[] = [];
  if (tool === 'scale') {
    clues.push({
      tool,
      defect: null,
      text: `Scale reads ${pkg.actualWeightKg} kg (label says ${pkg.declaredWeightKg} kg).`,
    });
  }
  for (const id of pkg.defects) {
    if (repaired.includes(id)) continue;
    const text = DEFECTS[id].clues[tool];
    if (text) clues.push({ tool, defect: id, text });
  }
  const foundDefect = clues.some((c) => c.defect !== null);
  if (!foundDefect && QUIET[tool]) clues.push({ tool, defect: null, text: QUIET[tool] });
  return clues;
}

export function revealedDefects(pkg: Package, handling: Handling): DefectId[] {
  return pkg.defects.filter(
    (id) =>
      !handling.repaired.includes(id) &&
      Object.keys(DEFECTS[id].clues).some((tool) => handling.used.includes(tool as InspectionTool)),
  );
}
