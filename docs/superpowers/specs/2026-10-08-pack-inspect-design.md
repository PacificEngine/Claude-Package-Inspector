# PackInspect — Design

A browser game (TypeScript + Canvas, Vite, vitest, yarn). You are a package inspector.
Packages arrive on a conveyor; you examine them with tools, check them against the
day's rule card, then SHIP, REJECT, or REPAIR-then-ship.

## Core loop
1. A package arrives. Hidden truths: a set of defects (maybe none).
2. Use inspection tools to reveal clues. Inspection is not time-limited; the constraints are money (tool purchases, supplies, fines).
3. Optionally apply repair tools (each costs supplies).
4. Stamp SHIP or REJECT. Wrong call = strike. 3 strikes ends the shift.

## Packages and defects
Package types: box, can, parcel, jar, tube. A defect has: id, severity, which inspection
tools reveal it, how it is drawn, and `repairs` (which repair tools fix it, if any).

Realistic: leaking can, crushed corner, torn tape, wrong weight, rattling contents,
bulging can, wet cardboard, missing label.
Fantastical: bottomless box, humming, hotter than the sun, heavier inside than outside,
contents slightly in the future, whispering, ticking, tiny weather inside.

## Inspection tools
Base kit (free, always available): look at the package and read its label.
Purchasable one-time tools: Rotate/flip, Shake, Scale, Drop-test pebble, UV light,
Stethoscope. Once bought they are owned permanently and free to use.

## Repair tools (added at review)
Repairs let you rescue a rejectable package and ship it safely.
- Duct tape: bottomless box (tape over the hole), torn tape, crushed corner (splint).
- Sealant: leaking can, wet cardboard.
- Relabel kit: missing label, wrong declared weight.
- Pressure valve: bulging can.
- Soundproofing foam: humming, whispering, ticking.
- Ice pack / Void anchor etc. may be added for other fantastical defects.

Rules:
- Each repair tool fixes a specific set of defects. Applying the wrong tool wastes
  supplies but is not a strike by itself.
- Repair tools are supplies: you buy units in the shop, and each use consumes one unit.
  With zero units you cannot repair with that tool.
- Repairing requires opening the box (see Opening and fines).
- A repair only fixes defects already revealed by inspection; you must know what you
  are fixing. Trying a tool on an unrevealed defect is allowed but wastes the supply
  and fixes nothing.
- Some defects are unrepairable (e.g. contents slightly in the future); they must be rejected.
- A repaired package is shippable iff every reject-worthy defect under today's rules
  is fixed. Shipping a package with an unfixed reject-worthy defect = strike.
- Rejecting is always safe but earns nothing; repairing earns the shipping fee minus the
  repair cost, so repair is only worth it when the fee exceeds the cost.
- Nothing is purchasable on Day 1; new tools appear in the shop each night (see Economy).

## Economy
- Each package has a shipping fee. You earn it only when you successfully ship the
  package (clean, or fully repaired). Rejecting earns nothing. Shipping a bad package
  is a strike and earns nothing.
- Using a tool during the day costs no money. Money is spent only in the shop.
- Fines are charged for opening a box that did not need repair (see Opening and fines).
- Settlement happens once, at the end of each day: payout = fees earned − fines. The
  HUD shows a running tally during the day, but the bank only changes at settlement.
- The bank carries over between days and may go negative (debt) after heavy fines.
  While in debt you cannot buy anything.
- The strike limit ending a shift still triggers settlement for that day.

### Shop (end of day only)
- The shop opens only after settlement at the end of a day. It is the only place to buy.
- Day 1 starts with an empty shop: you play it with the base kit only. The shop first
  opens at the end of Day 1 with the first unlocks.
- Each end of day unlocks new items into the shop; unlocked items stay available.
- Inspection tools: one-time purchase, owned forever.
- Repair tools: supply purchase. Buy any number of units (priced per unit); units are
  consumed on use and carry over between days.
- Prices live in one tuning table. Higher days pay higher fees and unlock pricier tools.
- Unlock schedule (tuning table, initial): end of Day 1 → Rotate/flip, Duct tape;
  Day 2 → Scale, Sealant; Day 3 → Shake, UV light; Day 4 → Pebble, Relabel kit;
  Day 5 → Stethoscope, Soundproofing foam; Day 6 → Pressure valve.
- Out of scope for v1: selling items, upgrades beyond the above.

### Opening and fines
- Repairing requires an explicit Open action on the package first.
- Opening a box that does not need repair under today's rules incurs a fine, charged at
  settlement. A box needs repair only if it has at least one reject-worthy problem and
  every reject-worthy problem is repairable. A box with ANY unrepairable reject-worthy
  problem "does not need repair" (it must be rejected), so opening it is fined even if
  it also has repairable problems. Opening a box that does need repair is free.
- Fines scale with the package's shipping fee so that fishing is never profitable.
- Opening reveals nothing for free; it only enables repair tools.

## Address checking
- Every package carries a shipping label: recipient name, street, city, zone/ZIP, and
  a return address. The label is readable with the base kit (no purchase needed).
- Address problems are label defects checked against the day's rule card, alongside
  physical defects:
  - Malformed: missing field, ZIP that does not match the city, illegible/smudged line.
    Fixable with the Relabel kit, then shippable.
  - Forbidden destination: violates a rule (e.g. PO boxes, a restricted zone, a
    destination on the day's banned list). Unrepairable; must be rejected.
  - Fantastical: Atlantis, "Nowhere Lane", the Moon on weekdays, a return address that
    is the recipient's own future home. Rules decide whether these are rejected.
- Address rules appear on the daily rule card, e.g. "Day 2: No PO boxes. ZIP must match
  city." "Day 5: Reject anything addressed below sea level." Rules accumulate in
  difficulty but a day's card lists exactly what is checked that day.
- A package is correctly shipped only if physical AND address checks both pass (after
  repairs). A bad address on a physically perfect box is still a reject.
- Address data comes from small seeded tables (names, streets, cities, ZIP-to-city
  mapping, banned lists) so generation is deterministic and testable.
- `game/address.ts` owns address generation, validation, and rule predicates;
  `shouldReject` / `isShippable` in rules.ts combine physical and address verdicts.

## Rule cards
Each day has a card that changes which defects are reject-worthy
(e.g. "Cans may have dents but NEVER bulges. Reject anything that hums.").
`shouldReject(package, rules)` is the single source of truth for correct verdicts;
`isShippable(package, rules)` accounts for applied repairs.

## Progression
~7 days. Day 1 is realistic defects and one simple address rule, base kit. A defect only appears
on a day when the player could have bought a tool that detects it (or the base kit shows
it), so fantastical defects phase in from Day 3 onward in step with the unlock schedule.
Repair tools may unlock later; rejecting is always correct.
Each later day adds new shop items and trickier rules. End-of-day summary with accuracy
and a flavor note from your boss. Out of scope for v1: audio, saving, endless mode.

## Architecture
- game/defects.ts — defect catalog (incl. repair mappings)
- game/packages.ts — seeded generator (deterministic for tests)
- game/address.ts — label addresses, validation, address rules
- game/rules.ts — rule cards, shouldReject, isShippable
- game/inspection.ts — what each inspection tool reveals
- game/repair.ts — repair tools, supplies, applying repairs
- game/economy.ts — fees, fines, end-of-day settlement
- game/shop.ts — shop catalog, unlock schedule, purchases, inventory
- game/shift.ts — shift state, strikes, day progression
- render/ — Canvas drawing and input
- main.ts — loop and wiring

## Testing
TDD on everything in game/. Rendering verified visually in the browser.
