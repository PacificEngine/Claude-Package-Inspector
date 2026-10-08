import type { Campaign } from '../game/campaign';
import type { ShiftState } from '../game/shift';
import type { SoundEvent } from './sfx';

const suppliesLeft = (s: ShiftState): number =>
  Object.values(s.inventory.supplies).reduce((sum, n) => sum + n, 0);

// Derives what to play by comparing states, so the game rules never know about sound.
export function soundsFor(before: Campaign, after: Campaign): SoundEvent[] {
  if (before.phase === 'shift' && after.phase === 'dayEnd') return ['dayEnd'];

  const events: SoundEvent[] = [];
  const b = before.shift;
  const a = after.shift;
  if (before.phase === 'shift' && after.phase === 'shift' && b && a && a !== b) {
    if (a.strikes > b.strikes) events.push('strike');
    else if (a.earned > b.earned) events.push('ship');
    else if (a.rejected > b.rejected) events.push('reject');
    if (a.fines > b.fines) events.push('fine');
    if (suppliesLeft(a) < suppliesLeft(b)) events.push('repair');
  }
  if (before.phase === 'shop' && after.phase === 'shop' && after.bank < before.bank) {
    events.push('buy');
  }
  return events;
}
