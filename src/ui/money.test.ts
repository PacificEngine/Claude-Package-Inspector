import { describe, expect, it } from 'vitest';
import { money } from './money';

describe('money', () => {
  it('formats positive amounts', () => expect(money(40)).toBe('$40'));
  it('formats zero', () => expect(money(0)).toBe('$0'));
  it('puts the minus sign before the dollar sign', () => expect(money(-40)).toBe('-$40'));
});
