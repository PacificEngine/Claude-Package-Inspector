import { describe, expect, it, vi } from 'vitest';
import { drawTool } from './toolArt';
import { TOOL_ORDER } from './toolActions';

const DRAWS = ['fill', 'fillRect', 'stroke', 'strokeRect', 'arc', 'ellipse'];

function recordingContext() {
  const calls: string[] = [];
  const fills = new Set<string>();
  const strokes = new Set<string>();
  const state: Record<string, unknown> = {};
  const ctx = new Proxy(state, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      return vi.fn(() => { calls.push(prop); });
    },
    set(target, prop: string, value) {
      target[prop] = value;
      if (prop === 'fillStyle') fills.add(String(value));
      if (prop === 'strokeStyle') strokes.add(String(value));
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, calls, fills, strokes };
}

describe('drawTool', () => {
  const signature = (tool: (typeof TOOL_ORDER)[number]) => {
    const r = recordingContext();
    drawTool(r.ctx, tool, 96);
    return { ...r, key: [...r.fills].sort().join('|') + '#' + [...r.strokes].sort().join('|') };
  };

  for (const tool of TOOL_ORDER) {
    it(`draws ${tool} with several drawing calls`, () => {
      const { calls } = signature(tool);
      expect(calls.filter((c) => DRAWS.includes(c)).length).toBeGreaterThanOrEqual(3);
    });
  }

  it('gives every tool a distinct palette', () => {
    const keys = TOOL_ORDER.map((t) => signature(t).key);
    expect(new Set(keys).size).toBe(TOOL_ORDER.length);
  });
});
