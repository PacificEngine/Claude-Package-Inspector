import type { Handling, View } from './types';

export function newHandling(): Handling {
  return {
    opened: false,
    flipped: false,
    fined: false,
    used: ['look'],
    repaired: [],
    relabeled: false,
    notes: [],
  };
}

export function viewOf(h: Handling): View {
  return h.opened ? 'inside' : h.flipped ? 'back' : 'front';
}
