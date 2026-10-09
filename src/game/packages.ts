import { generateAddress } from './address';
import { CATALOG, MARBLE, PACKAGING_KG, STOWAWAYS, round1, type Item } from './contents';
import { DEFECTS } from './defects';
import type { Rng } from './rng';
import type { RuleCard } from './rules';
import { SURFACE_DEFECTS, faceCount, isUndersideDefect, sideCount, typeNamesFor } from './shapes';
import type { DefectId, Package, PackageKind, Placement } from './types';

const BASE_KINDS: readonly PackageKind[] = ['box', 'can', 'parcel', 'jar', 'tube'];

// New shapes arrive as the days go on.
export function kindsForDay(day: number): PackageKind[] {
  return [
    ...BASE_KINDS,
    ...(day >= 4 ? (['prism'] as const) : []),
    ...(day >= 6 ? (['tetra'] as const) : []),
    ...(day >= 7 ? (['octa'] as const) : []),
  ];
}

// From day 2 the Rotate / flip tool is on sale, so defects start hiding on other faces.
function placeDefects(rng: Rng, kind: PackageKind, defects: DefectId[], day: number): Package['placements'] {
  if (day < 2) return undefined;
  const placements: Partial<Record<DefectId, Placement>> = {};
  for (const id of defects) {
    if (id === 'torn_tape') {
      // The tape seals the top of a box or parcel; elsewhere it is on a side.
      const top = kind === 'box' || kind === 'parcel';
      placements[id] = { side: 'up', face: top ? sideCount(kind) : rng.int(sideCount(kind)) };
    } else if (SURFACE_DEFECTS.includes(id)) {
      placements[id] = { side: 'up', face: rng.int(sideCount(kind)) };
    } else if (isUndersideDefect(id)) {
      placements[id] = { side: 'down', face: rng.int(faceCount(kind, 'down')) };
    }
  }
  return Object.keys(placements).length > 0 ? placements : undefined;
}

// One to three distinct catalog items (one or two for cylinders), each a little heavier or lighter.
function legitItems(rng: Rng, kind: PackageKind): Item[] {
  const pool = [...CATALOG[kind]];
  const cylinder = kind === 'can' || kind === 'jar' || kind === 'tube';
  const count = 1 + rng.int(cylinder ? 2 : 3);
  const items: Item[] = [];
  for (let i = 0; i < count; i++) {
    const [pick] = pool.splice(rng.int(pool.length), 1);
    items.push({
      id: i + 1,
      name: pick.name,
      art: pick.art,
      color: pick.color,
      weightKg: round1(pick.baseKg + rng.int(3) / 10),
    });
  }
  return items;
}

// A wrong weight is one or two stowaways that together weigh the difference.
function stowaways(rng: Rng, firstId: number): Item[] {
  const excess = round1(0.6 + rng.int(7) / 10);
  const kinds = [...STOWAWAYS];
  const take = (weightKg: number, id: number): Item => {
    const [pick] = kinds.splice(rng.int(kinds.length), 1);
    return { id, name: pick.name, art: pick.art, color: pick.color, weightKg, extra: true };
  };
  if (rng.chance(0.5)) {
    const first = round1(Math.floor((excess * 10) / 2) / 10);
    return [take(first, firstId), take(round1(excess - first), firstId + 1)];
  }
  return [take(excess, firstId)];
}

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

  const placed = placeDefects(rng, kind, defects, card.day);
  const sides = sideCount(kind);
  const labelFace = card.day >= 2 && sides > 1 ? rng.int(sides) : 0;
  // A missing contents label is missing from the face the label belongs on.
  const placements =
    defects.includes('missing_label') && card.day >= 2
      ? { ...placed, missing_label: { side: 'up' as const, face: labelFace } }
      : placed;

  const addressPool = [...card.rejectAddress, ...card.allowedAddress];
  const issue = addressPool.length > 0 && rng.chance(0.3) ? rng.pick(addressPool) : null;

  const items = legitItems(rng, kind);
  const packagingKg = PACKAGING_KG[kind];
  const declaredWeightKg = round1(packagingKg + items.reduce((s, i) => s + i.weightKg, 0));
  const contents: Item[] = [...items];
  if (defects.includes('wrong_weight')) contents.push(...stowaways(rng, items.length + 1));
  if (defects.includes('heavier_inside')) {
    contents.push({
      id: contents.length + 1,
      ...MARBLE,
      weightKg: round1(declaredWeightKg * 5),
      extra: true,
    });
  }
  // Half of the soggy cardboard has a leaking item inside as its cause.
  if (defects.includes('wet_cardboard') && rng.chance(0.5)) {
    const victim = rng.int(items.length);
    contents[victim] = { ...contents[victim], leaking: true };
  }
  const actualWeightKg = round1(packagingKg + contents.reduce((s, i) => s + i.weightKg, 0));
  const address = generateAddress(rng, issue);
  const fee = 15 + card.day * 5 + rng.int(10);
  // Only draw for kinds with a choice of names, so the other kinds keep their seeds.
  const names = typeNamesFor(kind);
  const typeName = names.length > 1 ? rng.pick(names) : names[0];

  return {
    id,
    kind,
    typeName,
    defects,
    address,
    declaredWeightKg,
    actualWeightKg,
    contents,
    packagingKg,
    labelFace,
    fee,
    ...(placements ? { placements } : {}),
  };
}
