import { generateAddress } from './address';
import { DEFECTS } from './defects';
import type { Rng } from './rng';
import type { RuleCard } from './rules';
import type { DefectId, Package, PackageKind } from './types';

const KINDS: readonly PackageKind[] = ['box', 'can', 'parcel', 'jar', 'tube'];
const BASE_WEIGHT_KG: Record<PackageKind, number> = {
  box: 2.5,
  can: 0.4,
  parcel: 1.2,
  jar: 0.6,
  tube: 0.3,
};

const round1 = (n: number): number => Math.round(n * 10) / 10;

export function generatePackage(rng: Rng, id: number, card: RuleCard): Package {
  const kind = rng.pick(KINDS);

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
  };
}
