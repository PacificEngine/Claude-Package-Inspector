# PackInspect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser game where you inspect packages (physical defects and address labels) against daily rule cards, repair and ship or reject them, and earn money that is spent in an end-of-day shop.

**Architecture:** A pure-TypeScript game core in `src/game/` (no DOM, seeded RNG, fully unit-tested with TDD) holds all rules, generation, inspection, repair, economy, shop, shift and campaign logic. A thin UI layer in `src/ui/` renders campaign state with DOM elements plus a Canvas drawing of the current package, and forwards clicks to the core. State transitions are immutable functions.

**Tech Stack:** TypeScript (strict), Vite, Vitest, yarn. No runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-10-08-pack-inspect-design.md`

## Global Constraints

- Package manager is `yarn` only. Never use npm, pnpm, or bun.
- TDD always: write the failing test, watch it fail, write minimal code, watch it pass, commit.
- Work on branch `feature/pack-inspect-game`. Never commit to `main`.
- Commit after each red-green cycle. Commit messages explain *why*, not *what*. Never sign commits with the Claude signature and add no Co-Authored-By trailer.
- Never refactor and change behavior in the same step. Green bar first, then refactor.
- No runtime dependencies. Dev dependencies only: `typescript`, `vite`, `vitest`.
- `src/game/` must not import from `src/ui/` and must not touch the DOM.
- Game runs over 7 days (`LAST_DAY = 7`), 3 strikes end a shift (`MAX_STRIKES = 3`), 8 + 2×day packages per day.
- Day 1 shop is empty; the shop opens at the end of each day, after settlement; items unlock per the schedule in Task 9.
- Money is only settled at end of day: payout = fees earned − fines. Tools cost nothing to use. Fine for opening a box that does not need repair = 2 × the package's fee.
- Inspection tools are a one-time purchase; repair tools are bought per unit and consumed on use. In debt (bank < 0) nothing can be bought.
- Build UI text with `textContent` / DOM APIs only (no `innerHTML`).

## File Structure

```
package.json, tsconfig.json, vite.config.ts, index.html, .gitignore
.claude/launch.json                  dev-server config for previews
src/main.ts                          entry: seed + mount
src/styles.css
src/game/rng.ts                      seeded RNG
src/game/types.ts                    shared types
src/game/testing.ts                  test fixtures (makePackage, goodAddress, inventoryWith)
src/game/handling.ts                 newHandling()
src/game/defects.ts                  defect catalog
src/game/address.ts                  addresses: generate / detect / format
src/game/rules.ts                    rule cards, problems, shippability, verdicts
src/game/packages.ts                 package generator
src/game/inspection.ts               clues + revealed defects
src/game/repair.ts                   applying repairs
src/game/economy.ts                  fines and settlement
src/game/shop.ts                     items, prices, unlocks, purchase, inventory
src/game/shift.ts                    one day's play
src/game/campaign.ts                 7-day flow: shift → day end → shop → next day
src/game/*.test.ts                   tests alongside each module
src/ui/dom.ts                        el() and button() helpers
src/ui/packageArt.ts                 canvas drawing of packages and defects
src/ui/app.ts                        screens and wiring
```

---

### Task 1: Project scaffold and seeded RNG

**Files:**
- Create: `package.json` (via yarn), `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`, `src/main.ts`
- Create: `src/game/rng.ts`
- Test: `src/game/rng.test.ts`

**Interfaces:**
- Produces: `interface Rng { next(): number; int(maxExclusive: number): number; pick<T>(items: readonly T[]): T; chance(probability: number): boolean }` and `createRng(seed: number): Rng`

- [ ] **Step 1: Scaffold tooling**

```bash
cd /Users/joe.salomone/Claude-PackInspect
yarn init -y
yarn add -D typescript vite vitest
```

Then edit `package.json` so it contains these fields (keep the versions yarn wrote):

```json
{
  "name": "pack-inspect",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "types": ["vite/client"]
  },
  "include": ["src", "vite.config.ts"]
}
```

Create `vite.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['src/**/*.test.ts'] },
});
```

Create `.gitignore`:

```
node_modules
dist
.DS_Store
```

Create `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PackInspect</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

Create `src/main.ts` (temporary until Task 12):

```ts
const root = document.getElementById('app');
if (root) root.textContent = 'PackInspect';
```

- [ ] **Step 2: Write the failing RNG test**

`src/game/rng.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createRng } from './rng';

describe('createRng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
  });

  it('produces different sequences for different seeds', () => {
    expect(createRng(1).next()).not.toEqual(createRng(2).next());
  });

  it('int stays within [0, max)', () => {
    const rng = createRng(7);
    for (let i = 0; i < 500; i++) {
      const n = rng.int(5);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(5);
    }
  });

  it('pick returns a member of the list', () => {
    const rng = createRng(3);
    const items = ['a', 'b', 'c'];
    for (let i = 0; i < 50; i++) expect(items).toContain(rng.pick(items));
  });

  it('chance(0) is never true and chance(1) is always true', () => {
    const rng = createRng(9);
    for (let i = 0; i < 50; i++) {
      expect(rng.chance(0)).toBe(false);
      expect(rng.chance(1)).toBe(true);
    }
  });
});
```

- [ ] **Step 3: Run it and see it fail**

Run: `yarn test`
Expected: FAIL, cannot resolve `./rng`.

- [ ] **Step 4: Implement `src/game/rng.ts`**

```ts
export interface Rng {
  next(): number;
  int(maxExclusive: number): number;
  pick<T>(items: readonly T[]): T;
  chance(probability: number): boolean;
}

// mulberry32: small, fast, deterministic. Determinism makes generation testable.
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (maxExclusive) => Math.floor(next() * maxExclusive),
    pick: (items) => items[Math.floor(next() * items.length)],
    chance: (probability) => next() < probability,
  };
}
```

- [ ] **Step 5: Run tests, typecheck, commit**

Run: `yarn test && yarn tsc --noEmit`
Expected: PASS, no type errors.

```bash
git add -A
git commit -m "Scaffold Vite/TypeScript/Vitest project with a seeded RNG

Seeded randomness keeps package generation deterministic so game rules can be tested."
```

---

### Task 2: Shared types and defect catalog

**Files:**
- Create: `src/game/types.ts`, `src/game/handling.ts`, `src/game/testing.ts`, `src/game/defects.ts`
- Test: `src/game/defects.test.ts`

**Interfaces:**
- Produces (types.ts): `PackageKind`, `InspectionTool`, `RepairTool`, `DefectId`, `AddressIssue`, `Verdict`, `Address`, `Package`, `Handling`, `Inventory`
- Produces (defects.ts): `DefectDef`, `DEFECTS: Record<DefectId, DefectDef>`, `ALL_DEFECT_IDS: DefectId[]`
- Produces (handling.ts): `newHandling(): Handling`
- Produces (testing.ts): `goodAddress: Address`, `makePackage(over?: Partial<Package>): Package`, `inventoryWith(supplies?: Partial<Record<RepairTool, number>>, tools?: InspectionTool[]): Inventory`

- [ ] **Step 1: Write `src/game/types.ts`**

```ts
export type PackageKind = 'box' | 'can' | 'parcel' | 'jar' | 'tube';

export type InspectionTool =
  | 'look'
  | 'rotate'
  | 'scale'
  | 'shake'
  | 'uv'
  | 'pebble'
  | 'stethoscope';

export type RepairTool = 'tape' | 'sealant' | 'relabel' | 'valve' | 'foam';

export type DefectId =
  | 'leaking'
  | 'crushed_corner'
  | 'torn_tape'
  | 'bulging'
  | 'wet_cardboard'
  | 'wrong_weight'
  | 'rattling'
  | 'missing_label'
  | 'bottomless'
  | 'humming'
  | 'whispering'
  | 'ticking'
  | 'scorching'
  | 'future_contents'
  | 'heavier_inside'
  | 'tiny_weather';

export type AddressIssue =
  | 'missing_field'
  | 'smudged'
  | 'zip_mismatch'
  | 'po_box'
  | 'restricted_zone'
  | 'nowhere'
  | 'underwater'
  | 'lunar';

export type Verdict = 'ship' | 'reject';

export interface Address {
  recipient: string;
  street: string;
  city: string;
  zip: string;
  returnAddress: string;
}

export interface Package {
  id: number;
  kind: PackageKind;
  defects: DefectId[];
  address: Address;
  declaredWeightKg: number;
  actualWeightKg: number;
  fee: number;
}

// What the player has done to the package currently on the desk.
export interface Handling {
  opened: boolean;
  used: InspectionTool[];
  repaired: DefectId[];
  relabeled: boolean;
}

export interface Inventory {
  tools: InspectionTool[];
  supplies: Record<RepairTool, number>;
}
```

- [ ] **Step 2: Write `src/game/handling.ts`**

```ts
import type { Handling } from './types';

export function newHandling(): Handling {
  return { opened: false, used: ['look'], repaired: [], relabeled: false };
}
```

- [ ] **Step 3: Write `src/game/testing.ts`**

```ts
import type { Address, InspectionTool, Inventory, Package, RepairTool } from './types';

export const goodAddress: Address = {
  recipient: 'A. Pemberton',
  street: '12 Elm Street',
  city: 'Maplewood',
  zip: '10001',
  returnAddress: '9 Oak Road, Riverton',
};

export function makePackage(over: Partial<Package> = {}): Package {
  return {
    id: 1,
    kind: 'box',
    defects: [],
    address: goodAddress,
    declaredWeightKg: 2,
    actualWeightKg: 2,
    fee: 20,
    ...over,
  };
}

export function inventoryWith(
  supplies: Partial<Record<RepairTool, number>> = {},
  tools: InspectionTool[] = ['look'],
): Inventory {
  return {
    tools,
    supplies: { tape: 0, sealant: 0, relabel: 0, valve: 0, foam: 0, ...supplies },
  };
}
```

- [ ] **Step 4: Write the failing defects test**

`src/game/defects.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ALL_DEFECT_IDS, DEFECTS } from './defects';

describe('defect catalog', () => {
  it('keys each entry by its own id', () => {
    for (const id of ALL_DEFECT_IDS) expect(DEFECTS[id].id).toBe(id);
  });

  it('gives every defect at least one clue and one compatible package kind', () => {
    for (const id of ALL_DEFECT_IDS) {
      expect(Object.keys(DEFECTS[id].clues).length).toBeGreaterThan(0);
      expect(DEFECTS[id].kinds.length).toBeGreaterThan(0);
    }
  });

  it('can be fixed with duct tape when bottomless', () => {
    expect(DEFECTS.bottomless.repairedBy).toBe('tape');
  });

  it('has a pebble clue for the bottomless box', () => {
    expect(DEFECTS.bottomless.clues.pebble).toMatch(/never lands/);
  });

  it('leaves some defects unrepairable', () => {
    expect(DEFECTS.future_contents.repairedBy).toBeNull();
    expect(DEFECTS.scorching.repairedBy).toBeNull();
  });

  it('marks the fantastical ones', () => {
    expect(DEFECTS.bottomless.fantastical).toBe(true);
    expect(DEFECTS.leaking.fantastical).toBe(false);
  });
});
```

- [ ] **Step 5: Run it and see it fail**

Run: `yarn test src/game/defects.test.ts`
Expected: FAIL, cannot resolve `./defects`.

- [ ] **Step 6: Implement `src/game/defects.ts`**

```ts
import type { DefectId, InspectionTool, PackageKind, RepairTool } from './types';

export interface DefectDef {
  id: DefectId;
  label: string;
  kinds: readonly PackageKind[];
  // Which inspection tools reveal it, with the text the player reads.
  clues: Partial<Record<InspectionTool, string>>;
  repairedBy: RepairTool | null;
  fantastical: boolean;
  // First day this defect may appear (see consistency test in Task 9).
  minDay: number;
}

const ANY: readonly PackageKind[] = ['box', 'can', 'parcel', 'jar', 'tube'];
const FLAT: readonly PackageKind[] = ['box', 'parcel'];

export const DEFECTS: Record<DefectId, DefectDef> = {
  leaking: {
    id: 'leaking',
    label: 'Leak',
    kinds: ['can', 'jar', 'tube'],
    clues: {
      look: 'A dark drip trails down the side.',
      uv: 'UV shows a glowing wet streak.',
    },
    repairedBy: 'sealant',
    fantastical: false,
    minDay: 1,
  },
  crushed_corner: {
    id: 'crushed_corner',
    label: 'Crushed corner',
    kinds: FLAT,
    clues: {
      look: 'One corner is crushed flat.',
      rotate: 'The crushed corner caves in when you turn it.',
    },
    repairedBy: 'tape',
    fantastical: false,
    minDay: 1,
  },
  torn_tape: {
    id: 'torn_tape',
    label: 'Torn tape',
    kinds: FLAT,
    clues: { look: 'The sealing tape is torn and peeling.' },
    repairedBy: 'tape',
    fantastical: false,
    minDay: 1,
  },
  bulging: {
    id: 'bulging',
    label: 'Bulging',
    kinds: ['can', 'jar'],
    clues: {
      look: 'The sides are swollen outward.',
      rotate: 'It rocks on its bulging base.',
    },
    repairedBy: 'valve',
    fantastical: false,
    minDay: 1,
  },
  wet_cardboard: {
    id: 'wet_cardboard',
    label: 'Wet cardboard',
    kinds: FLAT,
    clues: {
      rotate: 'The underside is soggy.',
      uv: 'UV lights up a damp patch.',
    },
    repairedBy: 'sealant',
    fantastical: false,
    minDay: 2,
  },
  wrong_weight: {
    id: 'wrong_weight',
    label: 'Wrong weight',
    kinds: ANY,
    clues: { scale: 'The scale disagrees with the label.' },
    repairedBy: 'relabel',
    fantastical: false,
    minDay: 3,
  },
  rattling: {
    id: 'rattling',
    label: 'Rattling contents',
    kinds: ANY,
    clues: { shake: 'Something loose clatters inside.' },
    repairedBy: null,
    fantastical: false,
    minDay: 4,
  },
  missing_label: {
    id: 'missing_label',
    label: 'Missing contents label',
    kinds: ANY,
    clues: { look: 'There is no contents label.' },
    repairedBy: 'relabel',
    fantastical: false,
    minDay: 1,
  },
  bottomless: {
    id: 'bottomless',
    label: 'No bottom',
    kinds: FLAT,
    clues: {
      rotate: 'You flip it over. There is no bottom, only darkness.',
      pebble: 'The pebble drops in... and never lands.',
    },
    repairedBy: 'tape',
    fantastical: true,
    minDay: 3,
  },
  humming: {
    id: 'humming',
    label: 'Humming',
    kinds: ANY,
    clues: { stethoscope: 'A low, steady hum from within.' },
    repairedBy: 'foam',
    fantastical: true,
    minDay: 6,
  },
  whispering: {
    id: 'whispering',
    label: 'Whispering',
    kinds: ANY,
    clues: { stethoscope: 'Faint whispers. They know your name.' },
    repairedBy: 'foam',
    fantastical: true,
    minDay: 6,
  },
  ticking: {
    id: 'ticking',
    label: 'Ticking',
    kinds: ANY,
    clues: { stethoscope: 'Tick. Tick. Tick. There should not be a clock in here.' },
    repairedBy: 'foam',
    fantastical: true,
    minDay: 6,
  },
  scorching: {
    id: 'scorching',
    label: 'Hotter than the sun',
    kinds: ANY,
    clues: { uv: 'It glows white-hot. Hotter than the sun.' },
    repairedBy: null,
    fantastical: true,
    minDay: 4,
  },
  future_contents: {
    id: 'future_contents',
    label: 'Contents from the future',
    kinds: ANY,
    clues: { shake: 'It sloshes before you shake it.' },
    repairedBy: null,
    fantastical: true,
    minDay: 4,
  },
  heavier_inside: {
    id: 'heavier_inside',
    label: 'Heavier inside than outside',
    kinds: ANY,
    clues: { scale: 'It weighs far more than it could possibly hold.' },
    repairedBy: null,
    fantastical: true,
    minDay: 3,
  },
  tiny_weather: {
    id: 'tiny_weather',
    label: 'Tiny weather inside',
    kinds: ['box', 'jar'],
    clues: {
      uv: 'A tiny storm flashes inside.',
      shake: 'You hear distant thunder.',
    },
    repairedBy: 'sealant',
    fantastical: true,
    minDay: 4,
  },
};

export const ALL_DEFECT_IDS = Object.keys(DEFECTS) as DefectId[];
```

- [ ] **Step 7: Run tests, typecheck, commit**

Run: `yarn test && yarn tsc --noEmit`
Expected: PASS.

```bash
git add -A
git commit -m "Add shared types and defect catalog

Defects are data (clues, repair, first day) so rules, inspection and art can all derive from one source."
```

---

### Task 3: Address generation and detection

**Files:**
- Create: `src/game/address.ts`
- Test: `src/game/address.test.ts`

**Interfaces:**
- Consumes: `Rng` (Task 1), `Address`, `AddressIssue` (Task 2), `goodAddress` (Task 2 testing)
- Produces:
  - `addressIssues(address: Address): AddressIssue[]`
  - `generateAddress(rng: Rng, issue: AddressIssue | null): Address`
  - `isRepairableAddressIssue(issue: AddressIssue): boolean` (true for `missing_field`, `smudged`, `zip_mismatch`)
  - `addressLines(address: Address): string[]`
  - `ADDRESS_ISSUE_MIN_DAY: Record<AddressIssue, number>`
  - `ALL_ADDRESS_ISSUES: AddressIssue[]`

- [ ] **Step 1: Write the failing test**

`src/game/address.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  ALL_ADDRESS_ISSUES,
  addressIssues,
  addressLines,
  generateAddress,
  isRepairableAddressIssue,
} from './address';
import { createRng } from './rng';
import { goodAddress } from './testing';

describe('addresses', () => {
  it('a good address has no issues', () => {
    expect(addressIssues(goodAddress)).toEqual([]);
  });

  it('generateAddress(null) is always clean', () => {
    for (let seed = 1; seed <= 50; seed++) {
      expect(addressIssues(generateAddress(createRng(seed), null))).toEqual([]);
    }
  });

  it.each(ALL_ADDRESS_ISSUES)('generateAddress(%s) yields exactly that issue', (issue) => {
    for (let seed = 1; seed <= 50; seed++) {
      expect(addressIssues(generateAddress(createRng(seed), issue))).toEqual([issue]);
    }
  });

  it('only malformed issues are repairable with a relabel', () => {
    expect(isRepairableAddressIssue('missing_field')).toBe(true);
    expect(isRepairableAddressIssue('smudged')).toBe(true);
    expect(isRepairableAddressIssue('zip_mismatch')).toBe(true);
    expect(isRepairableAddressIssue('po_box')).toBe(false);
    expect(isRepairableAddressIssue('lunar')).toBe(false);
  });

  it('formats the label as lines', () => {
    expect(addressLines(goodAddress)).toEqual([
      'A. Pemberton',
      '12 Elm Street',
      'Maplewood 10001',
      'Return: 9 Oak Road, Riverton',
    ]);
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `yarn test src/game/address.test.ts`
Expected: FAIL, cannot resolve `./address`.

- [ ] **Step 3: Implement `src/game/address.ts`**

```ts
import type { Rng } from './rng';
import type { Address, AddressIssue } from './types';

export const ALL_ADDRESS_ISSUES: AddressIssue[] = [
  'missing_field',
  'smudged',
  'zip_mismatch',
  'po_box',
  'restricted_zone',
  'nowhere',
  'underwater',
  'lunar',
];

export const ADDRESS_ISSUE_MIN_DAY: Record<AddressIssue, number> = {
  missing_field: 1,
  smudged: 2,
  zip_mismatch: 2,
  po_box: 2,
  restricted_zone: 3,
  nowhere: 4,
  underwater: 5,
  lunar: 5,
};

const CITY_ZIP: Record<string, string> = {
  Maplewood: '10001',
  Riverton: '20002',
  'Port Calloway': '30003',
  Dunmere: '40004',
  'Fort Hush': '99001',
  Atlantis: '00000',
  'Moon Base': 'M0001',
};
const EVERYDAY_CITIES = ['Maplewood', 'Riverton', 'Port Calloway', 'Dunmere'];
const RECIPIENTS = ['A. Pemberton', 'R. Okafor', 'M. Lindqvist', 'T. Navarro', 'J. Whitlock', 'S. Duarte'];
const STREETS = ['Elm Street', 'Oak Road', 'Harbor Lane', 'Mill Court', 'Birch Avenue', 'Quarry Way'];

const REPAIRABLE: readonly AddressIssue[] = ['missing_field', 'smudged', 'zip_mismatch'];

export function isRepairableAddressIssue(issue: AddressIssue): boolean {
  return REPAIRABLE.includes(issue);
}

export function addressIssues(a: Address): AddressIssue[] {
  const issues: AddressIssue[] = [];
  const fields = [a.recipient, a.street, a.city, a.zip];
  if (fields.some((f) => f.trim() === '')) issues.push('missing_field');
  const smudged = fields.some((f) => f.includes('?'));
  if (smudged) issues.push('smudged');
  if (a.city && a.zip && !smudged && CITY_ZIP[a.city] !== a.zip) issues.push('zip_mismatch');
  if (a.street.startsWith('PO Box')) issues.push('po_box');
  if (a.city === 'Fort Hush') issues.push('restricted_zone');
  if (a.street.includes('Nowhere Lane')) issues.push('nowhere');
  if (a.city === 'Atlantis') issues.push('underwater');
  if (a.city === 'Moon Base') issues.push('lunar');
  return issues;
}

function validAddress(rng: Rng): Address {
  const city = rng.pick(EVERYDAY_CITIES);
  return {
    recipient: rng.pick(RECIPIENTS),
    street: `${1 + rng.int(998)} ${rng.pick(STREETS)}`,
    city,
    zip: CITY_ZIP[city],
    returnAddress: `${1 + rng.int(998)} ${rng.pick(STREETS)}, ${rng.pick(EVERYDAY_CITIES)}`,
  };
}

export function generateAddress(rng: Rng, issue: AddressIssue | null): Address {
  const a = validAddress(rng);
  switch (issue) {
    case null:
      return a;
    case 'missing_field': {
      const field = rng.pick(['recipient', 'street', 'zip'] as const);
      return { ...a, [field]: '' };
    }
    case 'smudged':
      return { ...a, street: `???? ${a.street.replace(/^\d+ /, '')}` };
    case 'zip_mismatch': {
      const other = rng.pick(EVERYDAY_CITIES.filter((c) => c !== a.city));
      return { ...a, zip: CITY_ZIP[other] };
    }
    case 'po_box':
      return { ...a, street: `PO Box ${1 + rng.int(9000)}` };
    case 'restricted_zone':
      return { ...a, city: 'Fort Hush', zip: CITY_ZIP['Fort Hush'] };
    case 'nowhere':
      return { ...a, street: '1 Nowhere Lane' };
    case 'underwater':
      return { ...a, city: 'Atlantis', zip: CITY_ZIP['Atlantis'] };
    case 'lunar':
      return { ...a, city: 'Moon Base', zip: CITY_ZIP['Moon Base'] };
  }
}

export function addressLines(a: Address): string[] {
  return [a.recipient, a.street, `${a.city} ${a.zip}`.trim(), `Return: ${a.returnAddress}`];
}
```

- [ ] **Step 4: Run tests, typecheck, commit**

Run: `yarn test && yarn tsc --noEmit`
Expected: PASS.

```bash
git add -A
git commit -m "Add address generation, issue detection and formatting

Each address issue is a pure function of the label fields, so verdicts stay derivable and testable."
```

---

### Task 4: Rule cards and verdict logic

**Files:**
- Create: `src/game/rules.ts`
- Test: `src/game/rules.test.ts`

**Interfaces:**
- Consumes: `DEFECTS`, `ALL_DEFECT_IDS` (Task 2); `addressIssues`, `isRepairableAddressIssue` (Task 3); types
- Produces:
  - `interface RuleCard { day: number; title: string; lines: string[]; rejectDefects: DefectId[]; allowedDefects: DefectId[]; rejectAddress: AddressIssue[]; allowedAddress: AddressIssue[] }`
  - `LAST_DAY = 7`, `ruleCardForDay(day: number): RuleCard`
  - `interface Problem { source: 'defect' | 'address'; id: DefectId | AddressIssue; repairTool: RepairTool | null }`
  - `rejectWorthyProblems(pkg, card): Problem[]`
  - `unresolvedProblems(pkg, handling, card): Problem[]`
  - `isShippable(pkg, handling, card): boolean`
  - `needsRepair(pkg, card): boolean`
  - `isCorrectVerdict(pkg, handling, card, verdict): boolean`

- [ ] **Step 1: Write the failing test**

`src/game/rules.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { newHandling } from './handling';
import {
  LAST_DAY,
  isCorrectVerdict,
  isShippable,
  needsRepair,
  rejectWorthyProblems,
  ruleCardForDay,
  unresolvedProblems,
} from './rules';
import { goodAddress, makePackage } from './testing';

const day1 = ruleCardForDay(1);
const day2 = ruleCardForDay(2);
const day5 = ruleCardForDay(5);

describe('rule cards', () => {
  it('has a card for every day', () => {
    for (let d = 1; d <= LAST_DAY; d++) expect(ruleCardForDay(d).day).toBe(d);
  });

  it('never lists a defect as both rejected and allowed', () => {
    for (let d = 1; d <= LAST_DAY; d++) {
      const c = ruleCardForDay(d);
      for (const id of c.rejectDefects) expect(c.allowedDefects).not.toContain(id);
      for (const id of c.rejectAddress) expect(c.allowedAddress).not.toContain(id);
    }
  });
});

describe('shippability', () => {
  it('ships a clean package with a good address', () => {
    expect(isShippable(makePackage(), newHandling(), day1)).toBe(true);
  });

  it('does not ship a leaking can on day 1', () => {
    const pkg = makePackage({ kind: 'can', defects: ['leaking'] });
    expect(isShippable(pkg, newHandling(), day1)).toBe(false);
  });

  it('tolerates defects the card allows', () => {
    const pkg = makePackage({ defects: ['crushed_corner'] });
    expect(isShippable(pkg, newHandling(), day1)).toBe(true);
  });

  it('becomes shippable once the rejectable defect is repaired', () => {
    const pkg = makePackage({ defects: ['torn_tape'] });
    const repaired = { ...newHandling(), repaired: ['torn_tape' as const] };
    expect(isShippable(pkg, repaired, day1)).toBe(true);
  });

  it('rejects a bad address even on a perfect box', () => {
    const pkg = makePackage({ address: { ...goodAddress, zip: '' } });
    expect(isShippable(pkg, newHandling(), day1)).toBe(false);
  });

  it('a relabel resolves a malformed address', () => {
    const pkg = makePackage({ address: { ...goodAddress, zip: '' } });
    expect(isShippable(pkg, { ...newHandling(), relabeled: true }, day1)).toBe(true);
  });

  it('a relabel cannot resolve a forbidden destination', () => {
    const pkg = makePackage({ address: { ...goodAddress, street: 'PO Box 12' } });
    expect(isShippable(pkg, { ...newHandling(), relabeled: true }, day2)).toBe(false);
  });
});

describe('needsRepair', () => {
  it('is true when every rejectable problem is repairable', () => {
    expect(needsRepair(makePackage({ defects: ['torn_tape'] }), day1)).toBe(true);
  });

  it('is false for a clean package', () => {
    expect(needsRepair(makePackage(), day1)).toBe(false);
  });

  it('is false when a rejectable problem cannot be repaired', () => {
    expect(needsRepair(makePackage({ defects: ['future_contents'] }), day5)).toBe(false);
  });

  it('is false when repairable and unrepairable problems are mixed', () => {
    const pkg = makePackage({ defects: ['torn_tape', 'future_contents'] });
    expect(needsRepair(pkg, day5)).toBe(false);
  });

  it('ignores allowed defects', () => {
    expect(needsRepair(makePackage({ defects: ['crushed_corner'] }), day1)).toBe(false);
  });
});

describe('problems', () => {
  it('lists the repair tool for each problem', () => {
    const pkg = makePackage({ defects: ['torn_tape'], address: { ...goodAddress, zip: '' } });
    expect(rejectWorthyProblems(pkg, day1)).toEqual([
      { source: 'defect', id: 'torn_tape', repairTool: 'tape' },
      { source: 'address', id: 'missing_field', repairTool: 'relabel' },
    ]);
  });

  it('drops resolved problems', () => {
    const pkg = makePackage({ defects: ['torn_tape'] });
    const h = { ...newHandling(), repaired: ['torn_tape' as const] };
    expect(unresolvedProblems(pkg, h, day1)).toEqual([]);
  });
});

describe('isCorrectVerdict', () => {
  it('ship is correct only for shippable packages', () => {
    const good = makePackage();
    const bad = makePackage({ defects: ['torn_tape'] });
    expect(isCorrectVerdict(good, newHandling(), day1, 'ship')).toBe(true);
    expect(isCorrectVerdict(bad, newHandling(), day1, 'ship')).toBe(false);
  });

  it('reject is correct only for unshippable packages', () => {
    const good = makePackage();
    const bad = makePackage({ defects: ['torn_tape'] });
    expect(isCorrectVerdict(good, newHandling(), day1, 'reject')).toBe(false);
    expect(isCorrectVerdict(bad, newHandling(), day1, 'reject')).toBe(true);
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `yarn test src/game/rules.test.ts`
Expected: FAIL, cannot resolve `./rules`.

- [ ] **Step 3: Implement `src/game/rules.ts`**

```ts
import { addressIssues, isRepairableAddressIssue } from './address';
import { ALL_DEFECT_IDS, DEFECTS } from './defects';
import type { AddressIssue, DefectId, Handling, Package, RepairTool, Verdict } from './types';

export const LAST_DAY = 7;

export interface RuleCard {
  day: number;
  title: string;
  lines: string[];
  rejectDefects: DefectId[];
  allowedDefects: DefectId[];
  rejectAddress: AddressIssue[];
  allowedAddress: AddressIssue[];
}

const DAY7_ALLOWED: DefectId[] = ['crushed_corner', 'rattling'];

const CARDS: RuleCard[] = [
  {
    day: 1,
    title: 'Day 1: The Basics',
    lines: [
      'Reject leaking, bulging, or torn-tape packages.',
      'Crushed corners and missing contents labels are fine today.',
      'Reject any shipping label with a missing field.',
    ],
    rejectDefects: ['leaking', 'bulging', 'torn_tape'],
    allowedDefects: ['crushed_corner', 'missing_label'],
    rejectAddress: ['missing_field'],
    allowedAddress: [],
  },
  {
    day: 2,
    title: 'Day 2: Neat and Dry',
    lines: [
      'Reject leaks, bulges, torn tape, crushed corners and soggy cardboard.',
      'No PO boxes. The ZIP must match the city.',
      'A smudged label is readable enough today.',
    ],
    rejectDefects: ['leaking', 'bulging', 'torn_tape', 'crushed_corner', 'wet_cardboard'],
    allowedDefects: ['missing_label'],
    rejectAddress: ['missing_field', 'po_box', 'zip_mismatch'],
    allowedAddress: ['smudged'],
  },
  {
    day: 3,
    title: 'Day 3: Something Is Off',
    lines: [
      'Reject anything with no bottom, or that weighs wrong in any way.',
      'Reject leaks, bulges, torn tape and soggy cardboard.',
      'Reject restricted-zone, smudged and mismatched labels. PO boxes are fine.',
    ],
    rejectDefects: [
      'leaking',
      'bulging',
      'torn_tape',
      'wet_cardboard',
      'bottomless',
      'heavier_inside',
      'wrong_weight',
    ],
    allowedDefects: ['crushed_corner', 'missing_label'],
    rejectAddress: ['missing_field', 'zip_mismatch', 'smudged', 'restricted_zone'],
    allowedAddress: ['po_box'],
  },
  {
    day: 4,
    title: 'Day 4: Mind the Contents',
    lines: [
      'Reject rattlers, scorchers and anything from the future.',
      'Reject leaks, torn tape, bottomless boxes and wrong weights.',
      'Bulges, soggy cardboard and tiny weather are fine. No "Nowhere Lane".',
    ],
    rejectDefects: [
      'leaking',
      'torn_tape',
      'bottomless',
      'wrong_weight',
      'rattling',
      'scorching',
      'future_contents',
    ],
    allowedDefects: [
      'bulging',
      'crushed_corner',
      'wet_cardboard',
      'tiny_weather',
      'heavier_inside',
      'missing_label',
    ],
    rejectAddress: ['missing_field', 'zip_mismatch', 'restricted_zone', 'nowhere'],
    allowedAddress: ['po_box', 'smudged'],
  },
  {
    day: 5,
    title: 'Day 5: Below Sea Level',
    lines: [
      'Reject anything addressed below sea level or to the Moon.',
      'Reject leaks, bulges, bottomless boxes, weather, scorchers and futures.',
      'Missing contents labels must be fixed. PO boxes and ZIP slips are fine.',
    ],
    rejectDefects: [
      'leaking',
      'bulging',
      'bottomless',
      'missing_label',
      'future_contents',
      'tiny_weather',
      'scorching',
    ],
    allowedDefects: ['crushed_corner', 'torn_tape', 'wet_cardboard', 'rattling', 'wrong_weight'],
    rejectAddress: ['missing_field', 'smudged', 'underwater', 'lunar'],
    allowedAddress: ['po_box', 'zip_mismatch'],
  },
  {
    day: 6,
    title: 'Day 6: Sound Check',
    lines: [
      'Reject anything that hums, whispers or ticks.',
      'Reject leaks, bulges, soggy cardboard, bottomless boxes and futures.',
      'No PO boxes, no Moon, no sea floor, no "Nowhere Lane".',
    ],
    rejectDefects: [
      'leaking',
      'bulging',
      'wet_cardboard',
      'bottomless',
      'future_contents',
      'humming',
      'whispering',
      'ticking',
    ],
    allowedDefects: ['torn_tape', 'crushed_corner', 'rattling', 'scorching', 'missing_label'],
    rejectAddress: ['missing_field', 'po_box', 'underwater', 'lunar', 'nowhere'],
    allowedAddress: ['zip_mismatch', 'smudged', 'restricted_zone'],
  },
  {
    day: 7,
    title: 'Day 7: Inspector General',
    lines: [
      'Everything is rejectable except crushed corners and rattling.',
      'Every address problem is rejectable except a smudge.',
      'You earned this. Do not ship a thing that is not right.',
    ],
    rejectDefects: ALL_DEFECT_IDS.filter((id) => !DAY7_ALLOWED.includes(id)),
    allowedDefects: DAY7_ALLOWED,
    rejectAddress: [
      'missing_field',
      'zip_mismatch',
      'po_box',
      'restricted_zone',
      'nowhere',
      'underwater',
      'lunar',
    ],
    allowedAddress: ['smudged'],
  },
];

export function ruleCardForDay(day: number): RuleCard {
  const card = CARDS[Math.min(Math.max(day, 1), LAST_DAY) - 1];
  return card;
}

export interface Problem {
  source: 'defect' | 'address';
  id: DefectId | AddressIssue;
  repairTool: RepairTool | null;
}

export function rejectWorthyProblems(pkg: Package, card: RuleCard): Problem[] {
  const defects: Problem[] = pkg.defects
    .filter((id) => card.rejectDefects.includes(id))
    .map((id) => ({ source: 'defect', id, repairTool: DEFECTS[id].repairedBy }));
  const addresses: Problem[] = addressIssues(pkg.address)
    .filter((issue) => card.rejectAddress.includes(issue))
    .map((issue) => ({
      source: 'address',
      id: issue,
      repairTool: isRepairableAddressIssue(issue) ? 'relabel' : null,
    }));
  return [...defects, ...addresses];
}

function isResolved(problem: Problem, handling: Handling): boolean {
  if (problem.source === 'defect') return handling.repaired.includes(problem.id as DefectId);
  return problem.repairTool === 'relabel' && handling.relabeled;
}

export function unresolvedProblems(pkg: Package, handling: Handling, card: RuleCard): Problem[] {
  return rejectWorthyProblems(pkg, card).filter((p) => !isResolved(p, handling));
}

export function isShippable(pkg: Package, handling: Handling, card: RuleCard): boolean {
  return unresolvedProblems(pkg, handling, card).length === 0;
}

export function needsRepair(pkg: Package, card: RuleCard): boolean {
  const problems = rejectWorthyProblems(pkg, card);
  return problems.length > 0 && problems.every((p) => p.repairTool !== null);
}

export function isCorrectVerdict(
  pkg: Package,
  handling: Handling,
  card: RuleCard,
  verdict: Verdict,
): boolean {
  const shippable = isShippable(pkg, handling, card);
  return verdict === 'ship' ? shippable : !shippable;
}
```

- [ ] **Step 4: Run tests, typecheck, commit**

Run: `yarn test && yarn tsc --noEmit`
Expected: PASS.

```bash
git add -A
git commit -m "Add daily rule cards and shippability rules

One source of truth for what counts as a correct verdict, including repairs and address problems."
```

---

### Task 5: Package generator

**Files:**
- Create: `src/game/packages.ts`
- Test: `src/game/packages.test.ts`

**Interfaces:**
- Consumes: `Rng`, `RuleCard`, `DEFECTS`, `generateAddress`, types
- Produces: `generatePackage(rng: Rng, id: number, card: RuleCard): Package`

- [ ] **Step 1: Write the failing test**

`src/game/packages.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEFECTS } from './defects';
import { generatePackage } from './packages';
import { createRng } from './rng';
import { ruleCardForDay } from './rules';

const sample = (day: number, n = 400) => {
  const rng = createRng(day * 101);
  const card = ruleCardForDay(day);
  return Array.from({ length: n }, (_, i) => generatePackage(rng, i + 1, card));
};

describe('generatePackage', () => {
  it('is deterministic for a given seed', () => {
    const card = ruleCardForDay(3);
    expect(generatePackage(createRng(5), 1, card)).toEqual(generatePackage(createRng(5), 1, card));
  });

  it('only uses defects from the card that fit the package kind', () => {
    for (let day = 1; day <= 7; day++) {
      const card = ruleCardForDay(day);
      const pool = [...card.rejectDefects, ...card.allowedDefects];
      for (const pkg of sample(day, 150)) {
        for (const d of pkg.defects) {
          expect(pool).toContain(d);
          expect(DEFECTS[d].kinds).toContain(pkg.kind);
        }
      }
    }
  });

  it('never repeats a defect on one package', () => {
    for (const pkg of sample(7)) expect(new Set(pkg.defects).size).toBe(pkg.defects.length);
  });

  it('keeps fantastical defects out of day 1', () => {
    for (const pkg of sample(1)) {
      for (const d of pkg.defects) expect(DEFECTS[d].fantastical).toBe(false);
    }
  });

  it('produces both clean and defective packages', () => {
    const pkgs = sample(2);
    expect(pkgs.some((p) => p.defects.length === 0)).toBe(true);
    expect(pkgs.some((p) => p.defects.length > 0)).toBe(true);
  });

  it('sets weights that match the weight defects', () => {
    for (const pkg of sample(7, 600)) {
      if (pkg.defects.includes('heavier_inside')) {
        expect(pkg.actualWeightKg).toBeGreaterThan(pkg.declaredWeightKg * 5);
      } else if (pkg.defects.includes('wrong_weight')) {
        expect(pkg.actualWeightKg).toBeGreaterThan(pkg.declaredWeightKg);
      } else {
        expect(pkg.actualWeightKg).toBe(pkg.declaredWeightKg);
      }
    }
  });

  it('pays more later in the campaign', () => {
    const avg = (day: number) => {
      const pkgs = sample(day, 200);
      return pkgs.reduce((sum, p) => sum + p.fee, 0) / pkgs.length;
    };
    expect(avg(7)).toBeGreaterThan(avg(1));
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `yarn test src/game/packages.test.ts`
Expected: FAIL, cannot resolve `./packages`.

- [ ] **Step 3: Implement `src/game/packages.ts`**

```ts
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
```

- [ ] **Step 4: Run tests, typecheck, commit**

Run: `yarn test && yarn tsc --noEmit`
Expected: PASS.

```bash
git add -A
git commit -m "Add seeded package generator driven by the day's rule card

Generating from the card's pools keeps each day's mix of defects and addresses in step with its rules."
```

---

### Task 6: Inspection clues

**Files:**
- Create: `src/game/inspection.ts`
- Test: `src/game/inspection.test.ts`

**Interfaces:**
- Consumes: `DEFECTS`, types, `newHandling`, `makePackage`
- Produces:
  - `interface Clue { tool: InspectionTool; defect: DefectId | null; text: string }`
  - `cluesFor(pkg: Package, tool: InspectionTool, repaired?: readonly DefectId[]): Clue[]`
  - `revealedDefects(pkg: Package, handling: Handling): DefectId[]`

- [ ] **Step 1: Write the failing test**

`src/game/inspection.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { newHandling } from './handling';
import { cluesFor, revealedDefects } from './inspection';
import { makePackage } from './testing';

describe('cluesFor', () => {
  it('shows a bottomless box failing the pebble test', () => {
    const clues = cluesFor(makePackage({ defects: ['bottomless'] }), 'pebble');
    expect(clues.map((c) => c.text).join(' ')).toMatch(/never lands/);
    expect(clues[0].defect).toBe('bottomless');
  });

  it('reports a quiet result on a clean package', () => {
    const clues = cluesFor(makePackage(), 'pebble');
    expect(clues).toHaveLength(1);
    expect(clues[0].defect).toBeNull();
    expect(clues[0].text).toMatch(/plink/);
  });

  it('always reports the scale numbers', () => {
    const pkg = makePackage({ declaredWeightKg: 2, actualWeightKg: 2.9, defects: ['wrong_weight'] });
    const text = cluesFor(pkg, 'scale').map((c) => c.text);
    expect(text[0]).toBe('Scale reads 2.9 kg (label says 2 kg).');
    expect(text).toContain('The scale disagrees with the label.');
  });

  it('only reports what that tool can reveal', () => {
    const pkg = makePackage({ kind: 'can', defects: ['leaking'] });
    expect(cluesFor(pkg, 'look')[0].defect).toBe('leaking');
    expect(cluesFor(pkg, 'shake')[0].defect).toBeNull();
  });

  it('stops reporting a defect once it is repaired', () => {
    const pkg = makePackage({ kind: 'can', defects: ['leaking'] });
    const clues = cluesFor(pkg, 'look', ['leaking']);
    expect(clues).toHaveLength(1);
    expect(clues[0].defect).toBeNull();
  });
});

describe('revealedDefects', () => {
  it('reveals defects visible to tools already used', () => {
    const pkg = makePackage({ defects: ['torn_tape', 'bottomless'] });
    expect(revealedDefects(pkg, newHandling())).toEqual(['torn_tape']);
    expect(revealedDefects(pkg, { ...newHandling(), used: ['look', 'rotate'] })).toEqual([
      'torn_tape',
      'bottomless',
    ]);
  });

  it('hides repaired defects', () => {
    const pkg = makePackage({ defects: ['torn_tape'] });
    expect(revealedDefects(pkg, { ...newHandling(), repaired: ['torn_tape'] })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `yarn test src/game/inspection.test.ts`
Expected: FAIL, cannot resolve `./inspection`.

- [ ] **Step 3: Implement `src/game/inspection.ts`**

```ts
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
```

- [ ] **Step 4: Run tests, typecheck, commit**

Run: `yarn test && yarn tsc --noEmit`
Expected: PASS.

```bash
git add -A
git commit -m "Add inspection clues and revealed-defect lookup

Clues live with the defect data; the same lookup drives both the notes panel and the canvas art."
```

---

### Task 7: Repairs

**Files:**
- Create: `src/game/repair.ts`
- Test: `src/game/repair.test.ts`

**Interfaces:**
- Consumes: `DEFECTS`, `addressIssues`, `isRepairableAddressIssue`, `newHandling`, `inventoryWith`, `makePackage`
- Produces:
  - `type RepairResult = { ok: true; handling: Handling; inventory: Inventory; fixed: string[] } | { ok: false; reason: string }`
  - `applyRepair(pkg: Package, handling: Handling, inventory: Inventory, tool: RepairTool): RepairResult`

- [ ] **Step 1: Write the failing test**

`src/game/repair.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { newHandling } from './handling';
import { applyRepair } from './repair';
import { goodAddress, inventoryWith, makePackage } from './testing';

const opened = { ...newHandling(), opened: true };

describe('applyRepair', () => {
  it('requires the box to be opened first', () => {
    const r = applyRepair(makePackage({ defects: ['torn_tape'] }), newHandling(), inventoryWith({ tape: 1 }), 'tape');
    expect(r).toEqual({ ok: false, reason: 'Open the box first.' });
  });

  it('requires supplies', () => {
    const r = applyRepair(makePackage({ defects: ['torn_tape'] }), opened, inventoryWith(), 'tape');
    expect(r).toEqual({ ok: false, reason: 'You are out of that supply.' });
  });

  it('duct tape fixes a bottomless box and uses one roll', () => {
    const pkg = makePackage({ defects: ['bottomless'] });
    const r = applyRepair(pkg, opened, inventoryWith({ tape: 2 }), 'tape');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.handling.repaired).toEqual(['bottomless']);
    expect(r.inventory.supplies.tape).toBe(1);
    expect(r.fixed).toEqual(['No bottom']);
  });

  it('wasting the wrong tool fixes nothing but still uses the supply', () => {
    const pkg = makePackage({ defects: ['bottomless'] });
    const r = applyRepair(pkg, opened, inventoryWith({ foam: 1 }), 'foam');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.handling.repaired).toEqual([]);
    expect(r.inventory.supplies.foam).toBe(0);
    expect(r.fixed).toEqual([]);
  });

  it('does not repeat a defect that is already repaired', () => {
    const pkg = makePackage({ defects: ['torn_tape'] });
    const h = { ...opened, repaired: ['torn_tape' as const] };
    const r = applyRepair(pkg, h, inventoryWith({ tape: 1 }), 'tape');
    expect(r.ok && r.handling.repaired).toEqual(['torn_tape']);
  });

  it('relabel fixes a missing label and a malformed address together', () => {
    const pkg = makePackage({ defects: ['missing_label'], address: { ...goodAddress, zip: '' } });
    const r = applyRepair(pkg, opened, inventoryWith({ relabel: 1 }), 'relabel');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.handling.repaired).toEqual(['missing_label']);
    expect(r.handling.relabeled).toBe(true);
    expect(r.fixed).toEqual(['Missing contents label', 'address label']);
  });

  it('relabel does not mark a good address as relabeled', () => {
    const r = applyRepair(makePackage(), opened, inventoryWith({ relabel: 1 }), 'relabel');
    expect(r.ok && r.handling.relabeled).toBe(false);
  });

  it('relabel does not make a forbidden destination relabeled', () => {
    const pkg = makePackage({ address: { ...goodAddress, street: 'PO Box 9' } });
    const r = applyRepair(pkg, opened, inventoryWith({ relabel: 1 }), 'relabel');
    expect(r.ok && r.handling.relabeled).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `yarn test src/game/repair.test.ts`
Expected: FAIL, cannot resolve `./repair`.

- [ ] **Step 3: Implement `src/game/repair.ts`**

```ts
import { addressIssues, isRepairableAddressIssue } from './address';
import { DEFECTS } from './defects';
import type { Handling, Inventory, Package, RepairTool } from './types';

export type RepairResult =
  | { ok: true; handling: Handling; inventory: Inventory; fixed: string[] }
  | { ok: false; reason: string };

export function applyRepair(
  pkg: Package,
  handling: Handling,
  inventory: Inventory,
  tool: RepairTool,
): RepairResult {
  if (!handling.opened) return { ok: false, reason: 'Open the box first.' };
  if (inventory.supplies[tool] < 1) return { ok: false, reason: 'You are out of that supply.' };

  const fixedDefects = pkg.defects.filter(
    (id) => DEFECTS[id].repairedBy === tool && !handling.repaired.includes(id),
  );
  const relabelsAddress =
    tool === 'relabel' &&
    !handling.relabeled &&
    addressIssues(pkg.address).some(isRepairableAddressIssue);

  return {
    ok: true,
    handling: {
      ...handling,
      repaired: [...handling.repaired, ...fixedDefects],
      relabeled: handling.relabeled || relabelsAddress,
    },
    inventory: {
      ...inventory,
      supplies: { ...inventory.supplies, [tool]: inventory.supplies[tool] - 1 },
    },
    fixed: [...fixedDefects.map((id) => DEFECTS[id].label), ...(relabelsAddress ? ['address label'] : [])],
  };
}
```

- [ ] **Step 4: Run tests, typecheck, commit**

Run: `yarn test && yarn tsc --noEmit`
Expected: PASS.

```bash
git add -A
git commit -m "Add repair application with supplies and address relabeling

Repairs match tools to defects by data, so a wrong guess costs a supply without a special case."
```

---

### Task 8: Economy

**Files:**
- Create: `src/game/economy.ts`
- Test: `src/game/economy.test.ts`

**Interfaces:**
- Consumes: `Package`, `makePackage`
- Produces:
  - `FINE_MULTIPLIER = 2`, `openingFine(pkg: Package): number`
  - `interface DayLedger { earned: number; fines: number }`
  - `settle(ledger: DayLedger, bank: number): { payout: number; bank: number }`

- [ ] **Step 1: Write the failing test**

`src/game/economy.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { openingFine, settle } from './economy';
import { makePackage } from './testing';

describe('economy', () => {
  it('fines twice the shipping fee so needless opening never pays', () => {
    expect(openingFine(makePackage({ fee: 25 }))).toBe(50);
  });

  it('settles earnings minus fines into the bank', () => {
    expect(settle({ earned: 120, fines: 30 }, 10)).toEqual({ payout: 90, bank: 100 });
  });

  it('can settle into debt', () => {
    expect(settle({ earned: 10, fines: 80 }, 20)).toEqual({ payout: -70, bank: -50 });
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `yarn test src/game/economy.test.ts`
Expected: FAIL, cannot resolve `./economy`.

- [ ] **Step 3: Implement `src/game/economy.ts`**

```ts
import type { Package } from './types';

export const FINE_MULTIPLIER = 2;

export function openingFine(pkg: Package): number {
  return pkg.fee * FINE_MULTIPLIER;
}

export interface DayLedger {
  earned: number;
  fines: number;
}

export function settle(ledger: DayLedger, bank: number): { payout: number; bank: number } {
  const payout = ledger.earned - ledger.fines;
  return { payout, bank: bank + payout };
}
```

- [ ] **Step 4: Run tests, typecheck, commit**

Run: `yarn test && yarn tsc --noEmit`
Expected: PASS.

```bash
git add -A
git commit -m "Add fines and end-of-day settlement

Fine is a multiple of the fee so opening boxes speculatively is always a net loss."
```

---

### Task 9: Shop, unlocks and rule/unlock consistency

**Files:**
- Create: `src/game/shop.ts`
- Test: `src/game/shop.test.ts`, `src/game/consistency.test.ts`

**Interfaces:**
- Consumes: types, `inventoryWith`, `ruleCardForDay`, `DEFECTS`, `ADDRESS_ISSUE_MIN_DAY`
- Produces:
  - `type PurchasableTool = Exclude<InspectionTool, 'look'>`, `type ShopItem = PurchasableTool | RepairTool`
  - `INSPECTION_ITEMS`, `REPAIR_ITEMS`, `PRICES: Record<ShopItem, number>`, `ITEM_NAMES: Record<ShopItem, string>`
  - `UNLOCKS_AFTER_DAY: Record<number, ShopItem[]>`, `unlockedItems(completedDay: number): ShopItem[]`
  - `isInspectionItem(item: ShopItem): item is PurchasableTool`
  - `newInventory(): Inventory`
  - `type PurchaseResult = { ok: true; bank: number; inventory: Inventory } | { ok: false; reason: string }`
  - `purchase(inventory: Inventory, bank: number, completedDay: number, item: ShopItem, quantity?: number): PurchaseResult`

- [ ] **Step 1: Write the failing shop test**

`src/game/shop.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { inventoryWith } from './testing';
import { PRICES, newInventory, purchase, unlockedItems } from './shop';

describe('unlocks', () => {
  it('has nothing for sale before day 1 is complete', () => {
    expect(unlockedItems(0)).toEqual([]);
  });

  it('unlocks rotate and tape after day 1, and keeps them afterwards', () => {
    expect(unlockedItems(1)).toEqual(['rotate', 'tape']);
    expect(unlockedItems(2)).toEqual(['rotate', 'tape', 'scale', 'sealant']);
  });

  it('has every item unlocked after day 6', () => {
    expect(unlockedItems(6)).toHaveLength(11);
  });
});

describe('newInventory', () => {
  it('starts with only the base kit', () => {
    expect(newInventory()).toEqual(inventoryWith());
  });
});

describe('purchase', () => {
  it('refuses items that are not unlocked yet', () => {
    expect(purchase(newInventory(), 500, 1, 'scale')).toEqual({
      ok: false,
      reason: 'That item is not on sale yet.',
    });
  });

  it('buys an inspection tool once', () => {
    const r = purchase(newInventory(), 500, 1, 'rotate');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.bank).toBe(500 - PRICES.rotate);
    expect(r.inventory.tools).toEqual(['look', 'rotate']);
    expect(purchase(r.inventory, r.bank, 1, 'rotate')).toEqual({
      ok: false,
      reason: 'You already own that.',
    });
  });

  it('buys repair supplies by the unit', () => {
    const r = purchase(newInventory(), 500, 1, 'tape', 5);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.bank).toBe(500 - 5 * PRICES.tape);
    expect(r.inventory.supplies.tape).toBe(5);
  });

  it('refuses when the player cannot afford it', () => {
    expect(purchase(newInventory(), 1, 1, 'rotate')).toEqual({
      ok: false,
      reason: 'You cannot afford that.',
    });
  });

  it('refuses everything while in debt', () => {
    expect(purchase(newInventory(), -5, 1, 'tape')).toEqual({
      ok: false,
      reason: 'You are in debt. The shop will not serve you.',
    });
  });

  it('refuses a quantity below one', () => {
    expect(purchase(newInventory(), 500, 1, 'tape', 0)).toEqual({
      ok: false,
      reason: 'Quantity must be at least 1.',
    });
  });
});
```

- [ ] **Step 2: Write the failing consistency test**

`src/game/consistency.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ADDRESS_ISSUE_MIN_DAY } from './address';
import { DEFECTS } from './defects';
import { LAST_DAY, ruleCardForDay } from './rules';
import { isInspectionItem, unlockedItems } from './shop';
import type { InspectionTool } from './types';

// A defect may only appear on a day when the player can plausibly detect it:
// either the free base kit shows it, or the tool that shows it could have been bought.
function toolsPossiblyOwned(day: number): InspectionTool[] {
  return ['look', ...unlockedItems(day - 1).filter(isInspectionItem)];
}

describe('rule cards stay in step with the shop', () => {
  for (let day = 1; day <= LAST_DAY; day++) {
    it(`day ${day}: every defect is introduced late enough and is detectable`, () => {
      const card = ruleCardForDay(day);
      const tools = toolsPossiblyOwned(day);
      for (const id of [...card.rejectDefects, ...card.allowedDefects]) {
        const def = DEFECTS[id];
        expect(def.minDay, `${id} minDay`).toBeLessThanOrEqual(day);
        const detectable = (Object.keys(def.clues) as InspectionTool[]).some((t) => tools.includes(t));
        expect(detectable, `${id} detectable on day ${day}`).toBe(true);
      }
    });

    it(`day ${day}: address issues are introduced late enough`, () => {
      const card = ruleCardForDay(day);
      for (const issue of [...card.rejectAddress, ...card.allowedAddress]) {
        expect(ADDRESS_ISSUE_MIN_DAY[issue], issue).toBeLessThanOrEqual(day);
      }
    });
  }

  it('lists every address issue as rejectable or allowed on day 7', () => {
    const card = ruleCardForDay(LAST_DAY);
    expect([...card.rejectAddress, ...card.allowedAddress]).toHaveLength(8);
  });
});
```

- [ ] **Step 3: Run them and see them fail**

Run: `yarn test src/game/shop.test.ts src/game/consistency.test.ts`
Expected: FAIL, cannot resolve `./shop`.

- [ ] **Step 4: Implement `src/game/shop.ts`**

```ts
import type { InspectionTool, Inventory, RepairTool } from './types';

export type PurchasableTool = Exclude<InspectionTool, 'look'>;
export type ShopItem = PurchasableTool | RepairTool;

export const INSPECTION_ITEMS: readonly PurchasableTool[] = [
  'rotate',
  'scale',
  'shake',
  'uv',
  'pebble',
  'stethoscope',
];
export const REPAIR_ITEMS: readonly RepairTool[] = ['tape', 'sealant', 'relabel', 'valve', 'foam'];

export const PRICES: Record<ShopItem, number> = {
  rotate: 40,
  scale: 60,
  shake: 80,
  uv: 100,
  pebble: 120,
  stethoscope: 150,
  tape: 8,
  sealant: 12,
  relabel: 10,
  valve: 15,
  foam: 20,
};

export const ITEM_NAMES: Record<ShopItem, string> = {
  rotate: 'Rotate / flip',
  scale: 'Scale',
  shake: 'Shake',
  uv: 'UV light',
  pebble: 'Drop-test pebble',
  stethoscope: 'Stethoscope',
  tape: 'Duct tape',
  sealant: 'Sealant',
  relabel: 'Relabel kit',
  valve: 'Pressure valve',
  foam: 'Soundproof foam',
};

// Keys are the day that just ended; those items go on sale that night.
export const UNLOCKS_AFTER_DAY: Record<number, ShopItem[]> = {
  1: ['rotate', 'tape'],
  2: ['scale', 'sealant'],
  3: ['shake', 'uv'],
  4: ['pebble', 'relabel'],
  5: ['stethoscope', 'foam'],
  6: ['valve'],
};

export function unlockedItems(completedDay: number): ShopItem[] {
  return Object.entries(UNLOCKS_AFTER_DAY)
    .filter(([day]) => Number(day) <= completedDay)
    .flatMap(([, items]) => items);
}

export function isInspectionItem(item: ShopItem): item is PurchasableTool {
  return (INSPECTION_ITEMS as readonly string[]).includes(item);
}

export function newInventory(): Inventory {
  return {
    tools: ['look'],
    supplies: { tape: 0, sealant: 0, relabel: 0, valve: 0, foam: 0 },
  };
}

export type PurchaseResult =
  | { ok: true; bank: number; inventory: Inventory }
  | { ok: false; reason: string };

const fail = (reason: string): PurchaseResult => ({ ok: false, reason });

export function purchase(
  inventory: Inventory,
  bank: number,
  completedDay: number,
  item: ShopItem,
  quantity = 1,
): PurchaseResult {
  if (!unlockedItems(completedDay).includes(item)) return fail('That item is not on sale yet.');
  if (!Number.isInteger(quantity) || quantity < 1) return fail('Quantity must be at least 1.');
  if (bank < 0) return fail('You are in debt. The shop will not serve you.');

  if (isInspectionItem(item)) {
    if (inventory.tools.includes(item)) return fail('You already own that.');
    if (PRICES[item] > bank) return fail('You cannot afford that.');
    return {
      ok: true,
      bank: bank - PRICES[item],
      inventory: { ...inventory, tools: [...inventory.tools, item] },
    };
  }

  const cost = PRICES[item] * quantity;
  if (cost > bank) return fail('You cannot afford that.');
  return {
    ok: true,
    bank: bank - cost,
    inventory: {
      ...inventory,
      supplies: { ...inventory.supplies, [item]: inventory.supplies[item] + quantity },
    },
  };
}
```

- [ ] **Step 5: Run all tests, typecheck, commit**

Run: `yarn test && yarn tsc --noEmit`
Expected: PASS. If the consistency test fails for a day, fix the `minDay` in `defects.ts`, the card, or `UNLOCKS_AFTER_DAY`, not the test.

```bash
git add -A
git commit -m "Add shop with unlock schedule and rule/unlock consistency checks

The consistency test guarantees a defect never appears before the player could detect it."
```

---

### Task 10: Shift (one day's play)

**Files:**
- Create: `src/game/shift.ts`
- Test: `src/game/shift.test.ts`

**Interfaces:**
- Consumes: everything above
- Produces:
  - `MAX_STRIKES = 3`, `packagesForDay(day: number): number`
  - `interface ShiftState { day; card: RuleCard; queue: Package[]; index; handling: Handling; inventory: Inventory; strikes; earned; fines; shipped; rejected; done: boolean }`
  - `interface ActionResult { state: ShiftState; message: string }`
  - `startShift(day: number, inventory: Inventory, seed: number): ShiftState`
  - `currentPackage(s): Package | null`, `currentClues(s): Clue[]`
  - `inspect(s, tool: InspectionTool): ActionResult`, `openBox(s): ActionResult`, `repair(s, tool: RepairTool): ActionResult`, `stamp(s, verdict: Verdict): ActionResult`

- [ ] **Step 1: Write the failing test**

`src/game/shift.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { newInventory } from './shop';
import { ruleCardForDay } from './rules';
import {
  MAX_STRIKES,
  currentClues,
  currentPackage,
  inspect,
  openBox,
  packagesForDay,
  repair,
  stamp,
  startShift,
  type ShiftState,
} from './shift';
import { inventoryWith, makePackage } from './testing';
import type { Package } from './types';

function shiftWith(queue: Package[], day = 1, inventory = newInventory()): ShiftState {
  return { ...startShift(day, inventory, 1), card: ruleCardForDay(day), queue, index: 0 };
}

const clean = makePackage({ fee: 20 });
const tornBox = makePackage({ id: 2, defects: ['torn_tape'], fee: 20 });

describe('startShift', () => {
  it('builds a queue sized for the day', () => {
    const s = startShift(2, newInventory(), 1);
    expect(s.queue).toHaveLength(packagesForDay(2));
    expect(s.strikes).toBe(0);
    expect(s.done).toBe(false);
  });

  it('is deterministic for the same seed', () => {
    expect(startShift(3, newInventory(), 9).queue).toEqual(startShift(3, newInventory(), 9).queue);
  });
});

describe('stamp', () => {
  it('pays the fee for shipping a good package', () => {
    const r = stamp(shiftWith([clean, clean]), 'ship');
    expect(r.state.earned).toBe(20);
    expect(r.state.strikes).toBe(0);
    expect(r.state.shipped).toBe(1);
    expect(r.state.index).toBe(1);
  });

  it('pays nothing for rejecting a bad package', () => {
    const r = stamp(shiftWith([tornBox, clean]), 'reject');
    expect(r.state.earned).toBe(0);
    expect(r.state.strikes).toBe(0);
    expect(r.state.rejected).toBe(1);
  });

  it('gives a strike and no pay for shipping a bad package', () => {
    const r = stamp(shiftWith([tornBox, clean]), 'ship');
    expect(r.state.earned).toBe(0);
    expect(r.state.strikes).toBe(1);
  });

  it('gives a strike for rejecting a good package', () => {
    expect(stamp(shiftWith([clean, clean]), 'reject').state.strikes).toBe(1);
  });

  it('resets handling for the next package', () => {
    const opened = openBox(shiftWith([tornBox, clean])).state;
    const next = stamp(opened, 'reject').state;
    expect(next.handling.opened).toBe(false);
    expect(next.handling.used).toEqual(['look']);
  });

  it('ends the shift on the last package', () => {
    const r = stamp(shiftWith([clean]), 'ship');
    expect(r.state.done).toBe(true);
    expect(currentPackage(r.state)).toBeNull();
  });

  it('ends the shift at the strike limit', () => {
    let s = shiftWith([clean, clean, clean, clean, clean]);
    for (let i = 0; i < MAX_STRIKES; i++) s = stamp(s, 'reject').state;
    expect(s.strikes).toBe(MAX_STRIKES);
    expect(s.done).toBe(true);
  });
});

describe('inspect', () => {
  it('refuses a tool the player does not own', () => {
    const r = inspect(shiftWith([clean]), 'scale');
    expect(r.message).toBe('You do not own that tool.');
    expect(r.state.handling.used).toEqual(['look']);
  });

  it('uses an owned tool and surfaces its clues', () => {
    const inv = inventoryWith({}, ['look', 'rotate']);
    const bottomless = makePackage({ defects: ['bottomless'] });
    const r = inspect(shiftWith([bottomless], 3, inv), 'rotate');
    expect(r.state.handling.used).toEqual(['look', 'rotate']);
    expect(currentClues(r.state).map((c) => c.text).join(' ')).toMatch(/no bottom/);
  });

  it('does not reuse a tool on the same package', () => {
    const inv = inventoryWith({}, ['look', 'rotate']);
    const once = inspect(shiftWith([clean], 3, inv), 'rotate').state;
    expect(inspect(once, 'rotate').message).toBe('You already checked that.');
  });
});

describe('openBox', () => {
  it('fines opening a box that needs no repair', () => {
    const r = openBox(shiftWith([clean]));
    expect(r.state.handling.opened).toBe(true);
    expect(r.state.fines).toBe(40);
    expect(r.message).toBe('Fined $40: that box needed no repair.');
  });

  it('is free for a box that needs repair', () => {
    const r = openBox(shiftWith([tornBox]));
    expect(r.state.fines).toBe(0);
  });

  it('only fines once per box', () => {
    const once = openBox(shiftWith([clean])).state;
    expect(openBox(once).state.fines).toBe(40);
  });
});

describe('repair', () => {
  it('needs the box opened first', () => {
    const inv = inventoryWith({ tape: 1 });
    const r = repair(shiftWith([tornBox], 2, inv), 'tape');
    expect(r.message).toBe('Open the box first.');
  });

  it('repairs, spends a supply, and then the package ships for pay', () => {
    const inv = inventoryWith({ tape: 1 });
    let s = shiftWith([tornBox], 2, inv);
    s = openBox(s).state;
    const r = repair(s, 'tape');
    expect(r.message).toBe('Fixed: Torn tape.');
    expect(r.state.inventory.supplies.tape).toBe(0);
    const shipped = stamp(r.state, 'ship').state;
    expect(shipped.earned).toBe(20);
    expect(shipped.strikes).toBe(0);
  });

  it('says so when a supply was wasted', () => {
    const inv = inventoryWith({ foam: 1 });
    const s = openBox(shiftWith([tornBox], 2, inv)).state;
    expect(repair(s, 'foam').message).toBe('Nothing to fix with that. Supply wasted.');
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `yarn test src/game/shift.test.ts`
Expected: FAIL, cannot resolve `./shift`.

- [ ] **Step 3: Implement `src/game/shift.ts`**

```ts
import { openingFine } from './economy';
import { newHandling } from './handling';
import { cluesFor, type Clue } from './inspection';
import { generatePackage } from './packages';
import { createRng } from './rng';
import { applyRepair } from './repair';
import {
  isCorrectVerdict,
  needsRepair,
  ruleCardForDay,
  unresolvedProblems,
  type RuleCard,
} from './rules';
import type { Handling, InspectionTool, Inventory, Package, RepairTool, Verdict } from './types';

export const MAX_STRIKES = 3;
export const packagesForDay = (day: number): number => 8 + day * 2;

export interface ShiftState {
  day: number;
  card: RuleCard;
  queue: Package[];
  index: number;
  handling: Handling;
  inventory: Inventory;
  strikes: number;
  earned: number;
  fines: number;
  shipped: number;
  rejected: number;
  done: boolean;
}

export interface ActionResult {
  state: ShiftState;
  message: string;
}

export function startShift(day: number, inventory: Inventory, seed: number): ShiftState {
  const card = ruleCardForDay(day);
  const rng = createRng(seed * 31 + day);
  const queue = Array.from({ length: packagesForDay(day) }, (_, i) =>
    generatePackage(rng, i + 1, card),
  );
  return {
    day,
    card,
    queue,
    index: 0,
    handling: newHandling(),
    inventory,
    strikes: 0,
    earned: 0,
    fines: 0,
    shipped: 0,
    rejected: 0,
    done: false,
  };
}

export function currentPackage(s: ShiftState): Package | null {
  return s.done ? null : (s.queue[s.index] ?? null);
}

export function currentClues(s: ShiftState): Clue[] {
  const pkg = currentPackage(s);
  if (!pkg) return [];
  return s.handling.used.flatMap((tool) => cluesFor(pkg, tool, s.handling.repaired));
}

const idle = (s: ShiftState): ActionResult => ({ state: s, message: 'The shift is over.' });

export function inspect(s: ShiftState, tool: InspectionTool): ActionResult {
  const pkg = currentPackage(s);
  if (!pkg) return idle(s);
  if (!s.inventory.tools.includes(tool)) return { state: s, message: 'You do not own that tool.' };
  if (s.handling.used.includes(tool)) return { state: s, message: 'You already checked that.' };
  return {
    state: { ...s, handling: { ...s.handling, used: [...s.handling.used, tool] } },
    message: cluesFor(pkg, tool, s.handling.repaired)
      .map((c) => c.text)
      .join(' '),
  };
}

export function openBox(s: ShiftState): ActionResult {
  const pkg = currentPackage(s);
  if (!pkg) return idle(s);
  if (s.handling.opened) return { state: s, message: 'Already open.' };
  const fine = needsRepair(pkg, s.card) ? 0 : openingFine(pkg);
  return {
    state: { ...s, handling: { ...s.handling, opened: true }, fines: s.fines + fine },
    message: fine > 0 ? `Fined $${fine}: that box needed no repair.` : 'Box opened.',
  };
}

export function repair(s: ShiftState, tool: RepairTool): ActionResult {
  const pkg = currentPackage(s);
  if (!pkg) return idle(s);
  const result = applyRepair(pkg, s.handling, s.inventory, tool);
  if (!result.ok) return { state: s, message: result.reason };
  return {
    state: { ...s, handling: result.handling, inventory: result.inventory },
    message:
      result.fixed.length > 0
        ? `Fixed: ${result.fixed.join(', ')}.`
        : 'Nothing to fix with that. Supply wasted.',
  };
}

export function stamp(s: ShiftState, verdict: Verdict): ActionResult {
  const pkg = currentPackage(s);
  if (!pkg) return idle(s);
  const correct = isCorrectVerdict(pkg, s.handling, s.card, verdict);
  const strikes = s.strikes + (correct ? 0 : 1);
  const earned = s.earned + (correct && verdict === 'ship' ? pkg.fee : 0);
  const index = s.index + 1;

  let message: string;
  if (correct) {
    message = verdict === 'ship' ? `Shipped. +$${pkg.fee} at day's end.` : 'Rejected.';
  } else if (verdict === 'ship') {
    const why = unresolvedProblems(pkg, s.handling, s.card)
      .map((p) => p.id)
      .join(', ');
    message = `Shipped a package that broke the rules (${why}). Strike!`;
  } else {
    message = 'That package was fine to ship. Strike!';
  }

  return {
    state: {
      ...s,
      strikes,
      earned,
      index,
      handling: newHandling(),
      shipped: s.shipped + (verdict === 'ship' ? 1 : 0),
      rejected: s.rejected + (verdict === 'reject' ? 1 : 0),
      done: strikes >= MAX_STRIKES || index >= s.queue.length,
    },
    message,
  };
}
```

- [ ] **Step 4: Run tests, typecheck, commit**

Run: `yarn test && yarn tsc --noEmit`
Expected: PASS.

```bash
git add -A
git commit -m "Add shift actions: inspect, open, repair and stamp

Immutable action functions return a message with each new state so the UI never re-derives outcomes."
```

---

### Task 11: Campaign flow

**Files:**
- Create: `src/game/campaign.ts`
- Test: `src/game/campaign.test.ts`

**Interfaces:**
- Consumes: `startShift`, `settle`, `purchase`, `newInventory`, `LAST_DAY`, `isShippable`, `currentPackage`, `stamp`
- Produces:
  - `type Phase = 'shift' | 'dayEnd' | 'shop' | 'finished'`
  - `interface DaySummary { day; earned; fines; payout; bankAfter; strikes; shipped; rejected; failed: boolean }`
  - `interface Campaign { seed; day; bank; inventory: Inventory; shift: ShiftState | null; phase: Phase; summary: DaySummary | null }`
  - `startCampaign(seed: number): Campaign`, `endDay(c): Campaign`, `toShop(c): Campaign`, `buy(c, item: ShopItem, quantity?: number): { campaign: Campaign; message: string }`, `nextDay(c): Campaign`

- [ ] **Step 1: Write the failing test**

`src/game/campaign.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buy, endDay, nextDay, startCampaign, toShop, type Campaign } from './campaign';
import { LAST_DAY, isShippable } from './rules';
import { currentPackage, stamp } from './shift';

// Plays the whole shift perfectly using the true verdict.
function playShift(c: Campaign): Campaign {
  let s = c.shift!;
  while (!s.done) {
    const pkg = currentPackage(s)!;
    s = stamp(s, isShippable(pkg, s.handling, s.card) ? 'ship' : 'reject').state;
  }
  return { ...c, shift: s };
}

describe('campaign', () => {
  it('starts on day 1 with an empty bank and the base kit', () => {
    const c = startCampaign(1);
    expect(c.phase).toBe('shift');
    expect(c.day).toBe(1);
    expect(c.bank).toBe(0);
    expect(c.inventory.tools).toEqual(['look']);
  });

  it('cannot end the day before the shift is over', () => {
    expect(() => endDay(startCampaign(1))).toThrow('The shift is not over yet.');
  });

  it('settles pay into the bank only when the day ends', () => {
    let c = playShift(startCampaign(1));
    expect(c.bank).toBe(0);
    c = endDay(c);
    expect(c.phase).toBe('dayEnd');
    expect(c.bank).toBe(c.shift!.earned - c.shift!.fines);
    expect(c.summary).toMatchObject({ day: 1, bankAfter: c.bank, strikes: 0, failed: false });
  });

  it('opens the shop after day end with the first unlocks on sale', () => {
    const c = toShop(endDay(playShift(startCampaign(1))));
    expect(c.phase).toBe('shop');
    const bought = buy({ ...c, bank: 100 }, 'rotate');
    expect(bought.campaign.inventory.tools).toContain('rotate');
    expect(bought.campaign.bank).toBe(60);
  });

  it('reports shop refusals without changing state', () => {
    const c = toShop(endDay(playShift(startCampaign(1))));
    const r = buy({ ...c, bank: 100 }, 'scale');
    expect(r.message).toBe('That item is not on sale yet.');
    expect(r.campaign.bank).toBe(100);
  });

  it('only allows buying while the shop is open', () => {
    expect(() => buy(startCampaign(1), 'rotate')).toThrow('The shop is closed.');
  });

  it('carries the inventory into the next day', () => {
    let c = toShop(endDay(playShift(startCampaign(1))));
    c = buy({ ...c, bank: 100 }, 'tape', 3).campaign;
    c = nextDay(c);
    expect(c.phase).toBe('shift');
    expect(c.day).toBe(2);
    expect(c.inventory.supplies.tape).toBe(3);
    expect(c.shift!.inventory.supplies.tape).toBe(3);
  });

  it('finishes after the last day instead of opening a shop', () => {
    let c: Campaign = { ...startCampaign(1), day: LAST_DAY };
    c = { ...c, shift: { ...c.shift!, day: LAST_DAY } };
    c = toShop(endDay(playShift(c)));
    expect(c.phase).toBe('finished');
  });

  it('marks a shift ended by strikes as failed but still settles', () => {
    const c0 = startCampaign(1);
    const s = { ...c0.shift!, strikes: 3, done: true, earned: 10, fines: 5 };
    const c = endDay({ ...c0, shift: s });
    expect(c.summary).toMatchObject({ failed: true, payout: 5, bankAfter: 5 });
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `yarn test src/game/campaign.test.ts`
Expected: FAIL, cannot resolve `./campaign`.

- [ ] **Step 3: Implement `src/game/campaign.ts`**

```ts
import { settle } from './economy';
import { LAST_DAY } from './rules';
import { MAX_STRIKES, startShift, type ShiftState } from './shift';
import { newInventory, purchase, type ShopItem } from './shop';
import type { Inventory } from './types';

export type Phase = 'shift' | 'dayEnd' | 'shop' | 'finished';

export interface DaySummary {
  day: number;
  earned: number;
  fines: number;
  payout: number;
  bankAfter: number;
  strikes: number;
  shipped: number;
  rejected: number;
  failed: boolean;
}

export interface Campaign {
  seed: number;
  day: number;
  bank: number;
  inventory: Inventory;
  shift: ShiftState | null;
  phase: Phase;
  summary: DaySummary | null;
}

export function startCampaign(seed: number): Campaign {
  const inventory = newInventory();
  return {
    seed,
    day: 1,
    bank: 0,
    inventory,
    shift: startShift(1, inventory, seed),
    phase: 'shift',
    summary: null,
  };
}

export function endDay(c: Campaign): Campaign {
  const shift = c.shift;
  if (!shift || !shift.done) throw new Error('The shift is not over yet.');
  const { payout, bank } = settle({ earned: shift.earned, fines: shift.fines }, c.bank);
  return {
    ...c,
    bank,
    inventory: shift.inventory,
    phase: 'dayEnd',
    summary: {
      day: c.day,
      earned: shift.earned,
      fines: shift.fines,
      payout,
      bankAfter: bank,
      strikes: shift.strikes,
      shipped: shift.shipped,
      rejected: shift.rejected,
      failed: shift.strikes >= MAX_STRIKES,
    },
  };
}

export function toShop(c: Campaign): Campaign {
  if (c.phase !== 'dayEnd') throw new Error('The day has not ended yet.');
  return { ...c, phase: c.day >= LAST_DAY ? 'finished' : 'shop' };
}

export function buy(
  c: Campaign,
  item: ShopItem,
  quantity = 1,
): { campaign: Campaign; message: string } {
  if (c.phase !== 'shop') throw new Error('The shop is closed.');
  const result = purchase(c.inventory, c.bank, c.day, item, quantity);
  if (!result.ok) return { campaign: c, message: result.reason };
  return {
    campaign: { ...c, bank: result.bank, inventory: result.inventory },
    message: 'Purchased.',
  };
}

export function nextDay(c: Campaign): Campaign {
  if (c.phase !== 'shop') throw new Error('Visit the shop before starting the next day.');
  const day = c.day + 1;
  return {
    ...c,
    day,
    shift: startShift(day, c.inventory, c.seed),
    phase: 'shift',
    summary: null,
  };
}
```

- [ ] **Step 4: Run tests, typecheck, commit**

Run: `yarn test && yarn tsc --noEmit`
Expected: PASS.

```bash
git add -A
git commit -m "Add campaign flow: shift, settlement, shop, next day

Keeping phase transitions in the core means the UI only renders phase and forwards clicks."
```

---

### Task 12: Playthrough integration test

**Files:**
- Test: `src/game/playthrough.test.ts`

**Interfaces:**
- Consumes: `campaign`, `shift`, `rules`, `shop`, `repair` modules

This test proves the whole core loop (buying, opening, repairing, shipping) works end to end. A bot that knows the true answer plays all 7 days.

- [ ] **Step 1: Write the test**

`src/game/playthrough.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buy, endDay, nextDay, startCampaign, toShop, type Campaign } from './campaign';
import { LAST_DAY, needsRepair, rejectWorthyProblems } from './rules';
import { currentPackage, openBox, repair, stamp, type ShiftState } from './shift';
import { unlockedItems } from './shop';
import { isShippable } from './rules';

function playShiftPerfectly(initial: ShiftState): ShiftState {
  let s = initial;
  while (!s.done) {
    const pkg = currentPackage(s)!;
    if (needsRepair(pkg, s.card)) {
      const tools = new Set(rejectWorthyProblems(pkg, s.card).map((p) => p.repairTool!));
      const allStocked = [...tools].every((t) => s.inventory.supplies[t] > 0);
      if (allStocked) {
        s = openBox(s).state;
        for (const t of tools) s = repair(s, t).state;
      }
    }
    s = stamp(s, isShippable(pkg, s.handling, s.card) ? 'ship' : 'reject').state;
  }
  return s;
}

function stockUp(c: Campaign): Campaign {
  for (const item of unlockedItems(c.day)) {
    c = buy(c, item, 5).campaign;
  }
  return c;
}

describe('a perfect inspector playing all seven days', () => {
  for (const seed of [1, 2, 3]) {
    it(`finishes the campaign with no strikes (seed ${seed})`, () => {
      let c = startCampaign(seed);
      while (c.phase !== 'finished') {
        c = { ...c, shift: playShiftPerfectly(c.shift!) };
        c = endDay(c);
        expect(c.summary!.strikes).toBe(0);
        expect(c.summary!.fines).toBe(0);
        c = toShop(c);
        if (c.phase === 'shop') c = nextDay(stockUp(c));
      }
      expect(c.day).toBe(LAST_DAY);
      expect(c.bank).toBeGreaterThan(0);
    });
  }
});
```

- [ ] **Step 2: Run it**

Run: `yarn test src/game/playthrough.test.ts`
Expected: PASS. If it fails, the failure points to a real inconsistency in the core (for example a package whose problems cannot be resolved by the tools the bot owns). Fix the core module that is wrong, with its own failing unit test first. Do not weaken this test.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "Add end-to-end playthrough test

A perfect bot across seeds guards the loop against rules/unlock/repair mismatches."
```

---

### Task 13: UI helpers and package art

**Files:**
- Create: `src/ui/dom.ts`, `src/ui/packageArt.ts`, `src/styles.css`

**Interfaces:**
- Produces:
  - `el(tag, opts?, children?)`, `button(label, onClick, disabled?)`
  - `drawPackage(ctx: CanvasRenderingContext2D, pkg: Package, handling: Handling): void`

UI is verified visually (Task 15); there are no unit tests here. Typecheck must stay green.

- [ ] **Step 1: Write `src/ui/dom.ts`**

```ts
interface ElOptions {
  cls?: string;
  text?: string;
  attrs?: Record<string, string>;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  opts: ElOptions = {},
  children: Node[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (opts.cls) node.className = opts.cls;
  if (opts.text !== undefined) node.textContent = opts.text;
  for (const [k, v] of Object.entries(opts.attrs ?? {})) node.setAttribute(k, v);
  for (const child of children) node.append(child);
  return node;
}

export function button(label: string, onClick: () => void, disabled = false, cls = ''): HTMLButtonElement {
  const b = el('button', { text: label, cls });
  b.type = 'button';
  b.disabled = disabled;
  b.addEventListener('click', onClick);
  return b;
}
```

- [ ] **Step 2: Write `src/ui/packageArt.ts`**

```ts
import { revealedDefects } from '../game/inspection';
import type { DefectId, Handling, Package, PackageKind } from '../game/types';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const BODY_COLOR: Record<PackageKind, string> = {
  box: '#c9a26b',
  parcel: '#d8b98a',
  can: '#9aa7b1',
  jar: '#a8d0c7',
  tube: '#d99aa0',
};

function bodyRect(kind: PackageKind, w: number, h: number): Rect {
  const floor = h - 40;
  switch (kind) {
    case 'box':
      return { x: w / 2 - 80, y: floor - 130, w: 160, h: 130 };
    case 'parcel':
      return { x: w / 2 - 95, y: floor - 90, w: 190, h: 90 };
    case 'can':
      return { x: w / 2 - 50, y: floor - 120, w: 100, h: 120 };
    case 'jar':
      return { x: w / 2 - 55, y: floor - 110, w: 110, h: 110 };
    case 'tube':
      return { x: w / 2 - 35, y: floor - 150, w: 70, h: 150 };
  }
}

const MARKS: Partial<Record<DefectId, (ctx: CanvasRenderingContext2D, b: Rect) => void>> = {
  leaking: (ctx, b) => {
    ctx.fillStyle = '#2b6cb0';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(b.x + b.w * (0.25 + i * 0.25), b.y + b.h + 8 + i * 5, 5, 9, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  crushed_corner: (ctx, b) => {
    ctx.fillStyle = '#5a4630';
    ctx.beginPath();
    ctx.moveTo(b.x + b.w, b.y);
    ctx.lineTo(b.x + b.w - 40, b.y);
    ctx.lineTo(b.x + b.w, b.y + 40);
    ctx.fill();
  },
  torn_tape: (ctx, b) => {
    ctx.strokeStyle = '#f5f5f0';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y + 6);
    for (let x = b.x + 12; x <= b.x + b.w; x += 12) ctx.lineTo(x, b.y + (x % 24 === 0 ? 0 : 12));
    ctx.stroke();
  },
  bulging: (ctx, b) => {
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(b.x + b.w / 2, b.y + b.h / 2, b.w * 0.62, b.h * 0.52, 0, 0, Math.PI * 2);
    ctx.stroke();
  },
  wet_cardboard: (ctx, b) => {
    ctx.fillStyle = 'rgba(40, 50, 70, 0.45)';
    ctx.fillRect(b.x, b.y + b.h * 0.6, b.w, b.h * 0.4);
  },
  bottomless: (ctx, b) => {
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(b.x + b.w / 2, b.y + b.h, b.w * 0.4, 14, 0, 0, Math.PI * 2);
    ctx.fill();
  },
  scorching: (ctx, b) => {
    const g = ctx.createRadialGradient(b.x + b.w / 2, b.y + b.h / 2, 10, b.x + b.w / 2, b.y + b.h / 2, b.w);
    g.addColorStop(0, 'rgba(255, 220, 120, 0.7)');
    g.addColorStop(1, 'rgba(255, 80, 0, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w * 2, b.h * 2);
  },
  tiny_weather: (ctx, b) => {
    ctx.fillStyle = '#cbd5e0';
    ctx.beginPath();
    ctx.arc(b.x + b.w / 2 - 12, b.y - 14, 12, 0, Math.PI * 2);
    ctx.arc(b.x + b.w / 2 + 6, b.y - 18, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ecc94b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.x + b.w / 2, b.y - 4);
    ctx.lineTo(b.x + b.w / 2 - 6, b.y + 8);
    ctx.lineTo(b.x + b.w / 2 + 2, b.y + 8);
    ctx.lineTo(b.x + b.w / 2 - 4, b.y + 20);
    ctx.stroke();
  },
};

export function drawPackage(ctx: CanvasRenderingContext2D, pkg: Package, handling: Handling): void {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);

  // Conveyor belt
  ctx.fillStyle = '#3a3f47';
  ctx.fillRect(0, height - 40, width, 40);
  ctx.fillStyle = '#4b515b';
  for (let x = 0; x < width; x += 24) ctx.fillRect(x, height - 40, 12, 6);

  const b = bodyRect(pkg.kind, width, height);
  ctx.fillStyle = BODY_COLOR[pkg.kind];
  ctx.beginPath();
  if (pkg.kind === 'box' || pkg.kind === 'parcel') ctx.rect(b.x, b.y, b.w, b.h);
  else ctx.roundRect(b.x, b.y, b.w, b.h, 18);
  ctx.fill();

  // Seal tape strip, drawn unless the tape is torn
  if ((pkg.kind === 'box' || pkg.kind === 'parcel') && !pkg.defects.includes('torn_tape')) {
    ctx.fillStyle = '#b08a52';
    ctx.fillRect(b.x, b.y + 4, b.w, 8);
  }

  // Contents label, absent when the defect is present and unrepaired
  const labelMissing = pkg.defects.includes('missing_label') && !handling.repaired.includes('missing_label');
  if (!labelMissing) {
    ctx.fillStyle = '#fdfdf5';
    ctx.fillRect(b.x + b.w * 0.2, b.y + b.h * 0.4, b.w * 0.6, b.h * 0.3);
    ctx.fillStyle = '#718096';
    ctx.fillRect(b.x + b.w * 0.25, b.y + b.h * 0.47, b.w * 0.5, 3);
    ctx.fillRect(b.x + b.w * 0.25, b.y + b.h * 0.56, b.w * 0.35, 3);
  }

  for (const id of revealedDefects(pkg, handling)) MARKS[id]?.(ctx, b);

  // Applied repairs show as a duct-tape patch
  if (handling.repaired.length > 0) {
    ctx.fillStyle = '#9aa0a6';
    ctx.fillRect(b.x + b.w * 0.1, b.y + b.h * 0.1, b.w * 0.3, 14);
  }

  if (handling.opened) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.fillRect(b.x, b.y, b.w, 10);
  }
}
```

- [ ] **Step 3: Write `src/styles.css`**

```css
:root { color-scheme: dark; font-family: system-ui, sans-serif; }
body { margin: 0; background: #1a1d23; color: #e8e8ea; }
#app { max-width: 980px; margin: 0 auto; padding: 16px; }
h1, h2, h3 { margin: 0 0 8px; }
.hud { display: flex; flex-wrap: wrap; gap: 16px; padding: 8px 12px; background: #262a33; border-radius: 8px; margin-bottom: 12px; }
.grid { display: grid; grid-template-columns: 340px 1fr; gap: 16px; }
.panel { background: #262a33; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
.panel ul { margin: 0; padding-left: 18px; }
.label-card { background: #fdfdf5; color: #222; padding: 10px; border-radius: 4px; font-family: ui-monospace, monospace; }
.row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
button { background: #3a4150; color: inherit; border: 0; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 14px; }
button:hover:not(:disabled) { background: #4a5368; }
button:disabled { opacity: 0.4; cursor: default; }
button.ship { background: #2f855a; }
button.reject { background: #c53030; }
.message { min-height: 1.4em; color: #f6e05e; }
canvas { background: #20242c; border-radius: 8px; width: 100%; max-width: 320px; }
.muted { color: #a0a6b2; }
```

- [ ] **Step 4: Typecheck and commit**

Run: `yarn tsc --noEmit`
Expected: no errors.

```bash
git add -A
git commit -m "Add DOM helpers, canvas package art and styles

Art draws only defects the player has revealed, so the picture is itself a clue."
```

---

### Task 14: App screens and wiring

**Files:**
- Create: `src/ui/app.ts`
- Modify: `src/main.ts`
- Create: `.claude/launch.json`

**Interfaces:**
- Consumes: `campaign`, `shift`, `shop`, `address`, `inspection`, `packageArt`, `dom`
- Produces: `mount(root: HTMLElement, seed: number): void`

- [ ] **Step 1: Write `src/ui/app.ts`**

```ts
import { addressLines } from '../game/address';
import {
  buy,
  endDay,
  nextDay,
  startCampaign,
  toShop,
  type Campaign,
} from '../game/campaign';
import {
  MAX_STRIKES,
  currentClues,
  currentPackage,
  inspect,
  openBox,
  repair,
  stamp,
  type ActionResult,
  type ShiftState,
} from '../game/shift';
import {
  INSPECTION_ITEMS,
  ITEM_NAMES,
  PRICES,
  REPAIR_ITEMS,
  isInspectionItem,
  unlockedItems,
} from '../game/shop';
import { button, el } from './dom';
import { drawPackage } from './packageArt';

export function mount(root: HTMLElement, seed: number): void {
  let campaign = startCampaign(seed);
  let message = '';

  const update = (next: Campaign, msg = ''): void => {
    campaign = next;
    message = msg;
    render();
  };

  const act = (fn: (s: ShiftState) => ActionResult) => (): void => {
    const result = fn(campaign.shift!);
    update({ ...campaign, shift: result.state }, result.message);
  };

  function shiftScreen(): HTMLElement {
    const s = campaign.shift!;
    const pkg = currentPackage(s);

    const hud = el('div', { cls: 'hud' }, [
      el('span', { text: `Day ${s.day}` }),
      el('span', { text: `Package ${Math.min(s.index + 1, s.queue.length)}/${s.queue.length}` }),
      el('span', { text: `Strikes ${s.strikes}/${MAX_STRIKES}` }),
      el('span', { text: `Earned today $${s.earned}` }),
      el('span', { text: `Fines $${s.fines}` }),
      el('span', { text: `Bank $${campaign.bank}` }),
    ]);

    const card = el('div', { cls: 'panel' }, [
      el('h3', { text: s.card.title }),
      el('ul', {}, s.card.lines.map((line) => el('li', { text: line }))),
    ]);

    if (!pkg) {
      return el('div', {}, [
        hud,
        card,
        el('div', { cls: 'panel' }, [
          el('h2', { text: s.strikes >= MAX_STRIKES ? 'Three strikes. Shift over.' : 'Shift complete.' }),
          el('p', { text: message, cls: 'message' }),
          button('Settle up', () => update(endDay(campaign))),
        ]),
      ]);
    }

    const canvas = el('canvas', { attrs: { width: '320', height: '260' } });
    const ctx = canvas.getContext('2d');
    if (ctx) drawPackage(ctx, pkg, s.handling);

    const label = el('div', { cls: 'label-card' }, [
      ...addressLines(pkg.address).map((line) => el('div', { text: line })),
      el('div', { text: `Declared weight: ${pkg.declaredWeightKg} kg` }),
    ]);

    const notes = el('div', { cls: 'panel' }, [
      el('h3', { text: 'Notes' }),
      el('ul', {}, currentClues(s).map((c) => el('li', { text: c.text }))),
    ]);

    const owned = INSPECTION_ITEMS.filter((t) => s.inventory.tools.includes(t));
    const inspectRow = el('div', { cls: 'row' }, [
      ...owned.map((t) => button(ITEM_NAMES[t], act((st) => inspect(st, t)), s.handling.used.includes(t))),
      ...(owned.length === 0 ? [el('span', { cls: 'muted', text: 'No inspection tools yet.' })] : []),
    ]);

    const stocked = REPAIR_ITEMS.filter((t) => s.inventory.supplies[t] > 0);
    const repairRow = el('div', { cls: 'row' }, [
      button('Open box', act(openBox), s.handling.opened),
      ...stocked.map((t) =>
        button(`${ITEM_NAMES[t]} (${s.inventory.supplies[t]})`, act((st) => repair(st, t))),
      ),
    ]);

    const stampRow = el('div', { cls: 'row' }, [
      button('SHIP', act((st) => stamp(st, 'ship')), false, 'ship'),
      button('REJECT', act((st) => stamp(st, 'reject')), false, 'reject'),
    ]);

    return el('div', {}, [
      hud,
      el('div', { cls: 'grid' }, [
        el('div', {}, [canvas, label]),
        el('div', {}, [
          card,
          notes,
          el('div', { cls: 'panel' }, [
            el('h3', { text: 'Inspect' }),
            inspectRow,
            el('h3', { text: 'Repair' }),
            repairRow,
            el('h3', { text: 'Decide' }),
            stampRow,
            el('p', { cls: 'message', text: message }),
          ]),
        ]),
      ]),
    ]);
  }

  function dayEndScreen(): HTMLElement {
    const sum = campaign.summary!;
    return el('div', { cls: 'panel' }, [
      el('h2', { text: `Day ${sum.day} complete${sum.failed ? ' (cut short by strikes)' : ''}` }),
      el('ul', {}, [
        el('li', { text: `Shipped ${sum.shipped}, rejected ${sum.rejected}` }),
        el('li', { text: `Strikes: ${sum.strikes}` }),
        el('li', { text: `Earned: $${sum.earned}` }),
        el('li', { text: `Fines: -$${sum.fines}` }),
        el('li', { text: `Payout: $${sum.payout}` }),
        el('li', { text: `Bank: $${sum.bankAfter}` }),
      ]),
      button('Continue', () => update(toShop(campaign))),
    ]);
  }

  function shopScreen(): HTMLElement {
    const rows = unlockedItems(campaign.day).map((item) => {
      const price = `$${PRICES[item]}`;
      if (isInspectionItem(item)) {
        const owned = campaign.inventory.tools.includes(item);
        return el('div', { cls: 'row' }, [
          el('span', { text: `${ITEM_NAMES[item]} (one-time, ${price})` }),
          button(owned ? 'Owned' : 'Buy', () => {
            const r = buy(campaign, item);
            update(r.campaign, r.message);
          }, owned),
        ]);
      }
      const have = campaign.inventory.supplies[item];
      return el('div', { cls: 'row' }, [
        el('span', { text: `${ITEM_NAMES[item]} (${price} each, you have ${have})` }),
        ...[1, 5].map((qty) =>
          button(`Buy ${qty}`, () => {
            const r = buy(campaign, item, qty);
            update(r.campaign, r.message);
          }),
        ),
      ]);
    });

    return el('div', { cls: 'panel' }, [
      el('h2', { text: 'Supply Shop' }),
      el('p', { text: `Bank: $${campaign.bank}` }),
      ...rows,
      el('p', { cls: 'message', text: message }),
      button(`Start day ${campaign.day + 1}`, () => update(nextDay(campaign))),
    ]);
  }

  function finishedScreen(): HTMLElement {
    return el('div', { cls: 'panel' }, [
      el('h2', { text: 'Campaign complete!' }),
      el('p', { text: `Final bank: $${campaign.bank}` }),
      button('Play again', () => update(startCampaign(Math.floor(Math.random() * 100000)))),
    ]);
  }

  function render(): void {
    const screens = {
      shift: shiftScreen,
      dayEnd: dayEndScreen,
      shop: shopScreen,
      finished: finishedScreen,
    };
    root.replaceChildren(el('h1', { text: 'PackInspect' }), screens[campaign.phase]());
  }

  render();
}
```

- [ ] **Step 2: Replace `src/main.ts`**

```ts
import './styles.css';
import { mount } from './ui/app';

const root = document.getElementById('app');
if (!root) throw new Error('#app element is missing');

const seedParam = Number(new URLSearchParams(location.search).get('seed'));
mount(root, seedParam || Date.now() % 100000);
```

- [ ] **Step 3: Create `.claude/launch.json`**

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "pack-inspect",
      "runtimeExecutable": "yarn",
      "runtimeArgs": ["dev"],
      "port": 5173
    }
  ]
}
```

- [ ] **Step 4: Typecheck, test, build**

Run: `yarn tsc --noEmit && yarn test && yarn build`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add app screens wired to the campaign core

Screens are plain DOM built with textContent, so no untrusted HTML paths exist."
```

---

### Task 15: Visual verification

**Files:** none (fix anything found in the files above, with a failing test first when the bug is in `src/game/`)

- [ ] **Step 1: Start the dev server**

Use `preview_start` with name `pack-inspect`, then open `/?seed=1`.

- [ ] **Step 2: Play day 1 and check**

Using `preview_snapshot` / `preview_screenshot` / `preview_click`:
- HUD shows Day 1, strikes 0/3, Bank $0.
- Rule card is visible; the label card shows address lines and declared weight.
- No inspection tools and no repair buttons appear (base kit only); "Open box" is present.
- A package with a visible defect (drip, torn tape) shows it on the canvas and in Notes.
- Opening a clean box shows the fine message and Fines increases by 2× fee.
- SHIP/REJECT advance the queue; wrong calls show a strike message.
- After the last package, "Settle up" shows the day summary; "Continue" opens the shop with Rotate / flip and Duct tape; buying lowers the bank; "Start day 2" begins day 2.
- Check `preview_console_logs` with level `error`: expect none.

- [ ] **Step 3: Check later-day visuals**

Load `/?seed=1`, play quickly (or temporarily test with a different seed) through to a day with fantastical defects. Confirm that a bottomless box shows the black void after Rotate, that Repair with duct tape removes the clue, and that a ship after repair pays.

- [ ] **Step 4: Fix anything wrong**

Any logic bug found gets a failing unit test in `src/game/` first. Commit each fix separately.

- [ ] **Step 5: Stop the server**

Use `preview_stop`.

---

### Task 16: Security scan and wrap-up

**Files:** none new

- [ ] **Step 1: Run the Snyk code scan**

Run the `snyk_code_scan` tool (load it with ToolSearch if needed) on `/Users/joe.salomone/Claude-PackInspect`. Fix any issues in `src/` using the scan results, then rescan until clean.

- [ ] **Step 2: Final full check**

Run: `yarn test && yarn build`
Expected: all green.

- [ ] **Step 3: Squash into a single meaningful commit**

Interactive rebase is not available here, so squash by resetting softly to the root commit and amending it:

```bash
git log --oneline
git reset --soft $(git rev-list --max-parents=0 HEAD)
git commit --amend -m "Build PackInspect: a package inspection game

Players inspect packages and shipping labels against daily rule cards, repair
what can be saved, and are paid at day's end. A pure, tested game core keeps
rules, economy, shop unlocks and escalating fantastical defects consistent."
git log --oneline   # expect exactly one commit
```

The spec commit is the root commit, so this folds the spec and plan into the single commit, which is intended.

- [ ] **Step 4: Offer to push / open a PR**

Per CLAUDE.md, present the PR title and body in separate fenced code blocks so they can be copied.
