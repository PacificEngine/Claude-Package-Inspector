import { generateAddress } from './address';
import { DEFECTS } from './defects';
import type { Rng } from './rng';
import type { RuleCard } from './rules';
import { SURFACE_DEFECTS, faceCount, isUndersideDefect } from './shapes';
import type { DefectId, Package, PackageKind, Placement } from './types';

const BASE_KINDS: readonly PackageKind[] = ['box', 'can', 'parcel', 'jar', 'tube'];

// New shapes arrive as the days go on.
export function kindsForDay(day: number): PackageKind[] {
  return [...BASE_KINDS, ...(day >= 4 ? (['prism'] as const) : []), ...(day >= 6 ? (['tetra'] as const) : [])];
}

// From day 2 the Rotate / flip tool is on sale, so defects start hiding on other faces.
function placeDefects(rng: Rng, kind: PackageKind, defects: DefectId[], day: number): Package['placements'] {
  if (day < 2) return undefined;
  const placements: Partial<Record<DefectId, Placement>> = {};
  for (const id of defects) {
    if (SURFACE_DEFECTS.includes(id)) {
      placements[id] = { side: 'up', face: rng.int(faceCount(kind, 'up')) };
    } else if (isUndersideDefect(id) && faceCount(kind, 'down') > 0) {
      placements[id] = { side: 'down', face: rng.int(faceCount(kind, 'down')) };
    }
  }
  return Object.keys(placements).length > 0 ? placements : undefined;
}

const BASE_WEIGHT_KG: Record<PackageKind, number> = {
  box: 2.5,
  can: 0.4,
  parcel: 1.2,
  jar: 0.6,
  tube: 0.3,
  prism: 1.0,
  tetra: 0.8,
};

const round1 = (n: number): number => Math.round(n * 10) / 10;

export function generatePackage(rng: Rng, id: number, card: RuleCard): Package {
  const kind = rng.pick(kindsForDay(card.day));

  const pool = [...card.rejectDefects, ...card.allowedDefects].filter((d) =>
    DEFECTS[d].kinds.includes(kind),
  );
  const defects: DefectId[] = [];
  if (pool.length > 0 && rng.chance(0.55)) {
    defects.push(rng.pick(pool));
    if (rng.chance(0.25)) {
      const second = rng.pick(pool);
      if (!defects.includes(second)) defects.push(second);
    }
  }

  const placements = placeDefects(rng, kind, defects, card.day);

  const addressPool = [...card.rejectAddress, ...card.allowedAddress];
  const issue = addressPool.length > 0 && rng.chance(0.3) ? rng.pick(addressPool) : null;

  const declaredWeightKg = round1(BASE_WEIGHT_KG[kind] + rng.int(10) / 10);
  let actualWeightKg = declaredWeightKg;
  if (defects.includes('heavier_inside')) {
    actualWeightKg = round1(declaredWeightKg * 6);
  } else if (defects.includes('wrong_weight')) {
    actualWeightKg = round1(declaredWeightKg + 0.8 + rng.int(5) / 10);
  }

  return {
    id,
    kind,
    defects,
    address: generateAddress(rng, issue),
    declaredWeightKg,
    actualWeightKg,
    fee: 15 + card.day * 5 + rng.int(10),
    ...(placements ? { placements } : {}),
  };
}
