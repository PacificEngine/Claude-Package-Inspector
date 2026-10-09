import type { Handling, Side, View } from './types';

export function newHandling(): Handling {
  return {
    opened: false,
    flipped: false,
    fined: false,
    face: 0,
    visited: ['up:0'],
    used: ['look'],
    repaired: [],
    relabeled: false,
    notes: ['shape'], // the shape is always the first note
  };
}

export function viewOf(h: Handling): View {
  return h.opened ? 'inside' : h.flipped ? 'back' : 'front';
}

export const sideOf = (h: Handling): Side => (h.flipped ? 'down' : 'up');
