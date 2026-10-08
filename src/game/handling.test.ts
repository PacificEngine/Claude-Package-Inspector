import { describe, expect, it } from 'vitest';
import { newHandling, viewOf } from './handling';

describe('newHandling', () => {
  it('starts closed, face up, unfined, with no notes', () => {
    expect(newHandling()).toEqual({
      opened: false,
      flipped: false,
      fined: false,
      used: ['look'],
      repaired: [],
      relabeled: false,
      notes: [],
    });
  });
});

describe('viewOf', () => {
  it('is front by default, back when flipped, inside when open', () => {
    expect(viewOf(newHandling())).toBe('front');
    expect(viewOf({ ...newHandling(), flipped: true })).toBe('back');
    expect(viewOf({ ...newHandling(), opened: true })).toBe('inside');
  });
});
