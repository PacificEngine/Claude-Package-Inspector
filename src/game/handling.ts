import type { Handling } from './types';

export function newHandling(): Handling {
  return { opened: false, used: ['look'], repaired: [], relabeled: false };
}
