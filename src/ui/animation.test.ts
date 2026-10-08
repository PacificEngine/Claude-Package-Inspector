import { describe, expect, it } from 'vitest';
import { ANIMATION_MS, PACKAGE_ACTIONS, animationProgress } from './animation';

describe('animationProgress', () => {
  it('gives every action a positive duration', () => {
    for (const action of PACKAGE_ACTIONS) expect(ANIMATION_MS[action]).toBeGreaterThan(0);
  });

  it('starts at 0 and finishes at 1', () => {
    for (const action of PACKAGE_ACTIONS) {
      expect(animationProgress(action, 0, false)).toBe(0);
      expect(animationProgress(action, ANIMATION_MS[action], false)).toBe(1);
    }
  });

  it('moves forward in between and clamps outside the range', () => {
    const half = animationProgress('rotate', ANIMATION_MS.rotate / 2, false);
    expect(half).toBeGreaterThan(0);
    expect(half).toBeLessThan(1);
    expect(animationProgress('rotate', -50, false)).toBe(0);
    expect(animationProgress('rotate', 99999, false)).toBe(1);
  });

  it('jumps to the end pose when the player prefers reduced motion', () => {
    for (const action of PACKAGE_ACTIONS) expect(animationProgress(action, 0, true)).toBe(1);
  });
});
