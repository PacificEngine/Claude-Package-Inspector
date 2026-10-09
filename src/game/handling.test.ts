import { describe, expect, it } from 'vitest';
import { newHandling, sideOf, viewOf } from './handling';

describe('newHandling', () => {
  it('starts closed, face up, unfined, showing face 0, with only the shape noted', () => {
    expect(newHandling()).toEqual({
      opened: false,
      flipped: false,
      fined: false,
      face: 0,
      flipPos: 0,
      turn: 0,
      upsideDown: false,
      spin: 0,
      visited: ['up:0'],
      used: ['look'],
      repaired: [],
      addressRead: false,
      contentsRead: false,
      relabeled: false,
      notes: ['shape'],
      discarded: [],
      sealed: [],
      labelItems: null,
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

describe('sideOf', () => {
  it('is up until the package is flipped', () => {
    expect(sideOf(newHandling())).toBe('up');
    expect(sideOf({ ...newHandling(), flipped: true })).toBe('down');
  });
});
