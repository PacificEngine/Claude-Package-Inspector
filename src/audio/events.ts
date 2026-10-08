import { DEFECTS } from '../game/defects';
import { CLUE_CHANNEL, type ClueChannel } from '../game/inspection';
import { currentPackage } from '../game/shift';
import type { Campaign } from '../game/campaign';
import type { ShiftState } from '../game/shift';
import type { DefectId } from '../game/types';
import type { SoundEvent } from './sfx';

const suppliesLeft = (s: ShiftState): number =>
  Object.values(s.inventory.supplies).reduce((sum, n) => sum + n, 0);

const SOUND_OF_DEFECT: Partial<Record<DefectId, SoundEvent>> = {
  rattling: 'rattle',
  humming: 'hum',
  whispering: 'whisper',
  ticking: 'tick',
  future_contents: 'slosh',
  tiny_weather: 'thunder',
};

// Sounds for the sound tools the player has just used on this package.
function soundClues(b: ShiftState, a: ShiftState): SoundEvent[] {
  const pkg = currentPackage(b);
  if (!pkg || a.index !== b.index) return [];
  const sounds: SoundEvent[] = [];
  for (const tool of a.handling.used) {
    if (b.handling.used.includes(tool) || CLUE_CHANNEL[tool] !== 'sound') continue;
    for (const id of pkg.defects) {
      const sound = SOUND_OF_DEFECT[id];
      if (sound && DEFECTS[id].clues[tool] && !a.handling.repaired.includes(id)) sounds.push(sound);
    }
  }
  return sounds;
}

// Derives what to play by comparing states, so the game rules never know about sound.
export function soundsFor(before: Campaign, after: Campaign): SoundEvent[] {
  if (before.phase === 'shift' && after.phase === 'dayEnd') return ['dayEnd'];

  const events: SoundEvent[] = [];
  const b = before.shift;
  const a = after.shift;
  if (before.phase === 'shift' && after.phase === 'shift' && b && a && a !== b) {
    events.push(...soundClues(b, a));
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
