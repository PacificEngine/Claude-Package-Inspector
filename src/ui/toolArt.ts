import type { ToolId } from './toolActions';

// Every drawing is laid out on a 100x100 grid and scaled to the requested size.
type Draw = (ctx: CanvasRenderingContext2D) => void;

const rect = (ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number, r = 3): void => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
};

const disc = (ctx: CanvasRenderingContext2D, color: string, x: number, y: number, r: number): void => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
};

const line = (ctx: CanvasRenderingContext2D, color: string, width: number, ...pts: number[]): void => {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.stroke();
};

const arcLine = (ctx: CanvasRenderingContext2D, color: string, width: number, x: number, y: number, r: number, from: number, to: number): void => {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(x, y, r, from, to);
  ctx.stroke();
};

const triangle = (ctx: CanvasRenderingContext2D, color: string, ...p: number[]): void => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(p[0], p[1]);
  ctx.lineTo(p[2], p[3]);
  ctx.lineTo(p[4], p[5]);
  ctx.closePath();
  ctx.fill();
};

const ART: Record<ToolId, Draw> = {
  scale: (ctx) => {
    rect(ctx, '#8a949e', 10, 66, 80, 18, 5);
    rect(ctx, '#b8c1c9', 18, 56, 64, 12, 4);
    disc(ctx, '#f4f6f8', 50, 36, 22);
    arcLine(ctx, '#4a5560', 3, 50, 36, 22, 0, Math.PI * 2);
    line(ctx, '#d64545', 3, 50, 36, 62, 24);
    disc(ctx, '#4a5560', 50, 36, 3);
  },
  shake: (ctx) => {
    rect(ctx, '#c9a26b', 28, 28, 44, 44, 4);
    rect(ctx, '#a8854f', 28, 28, 44, 10, 3);
    line(ctx, '#2d3748', 4, 10, 40, 18, 40);
    line(ctx, '#2d3748', 4, 8, 56, 18, 56);
    line(ctx, '#2d3748', 4, 82, 40, 90, 40);
    line(ctx, '#2d3748', 4, 82, 56, 92, 56);
  },
  uv: (ctx) => {
    triangle(ctx, 'rgba(190, 120, 255, 0.45)', 56, 36, 96, 8, 96, 64);
    rect(ctx, '#7b3fbf', 8, 32, 40, 20, 4);
    rect(ctx, '#4b2475', 44, 28, 14, 28, 3);
    rect(ctx, '#c9a6ee', 16, 38, 8, 8, 2);
    disc(ctx, '#e9d5ff', 58, 42, 5);
  },
  pebble: (ctx) => {
    ctx.fillStyle = '#7a5a3a';
    ctx.beginPath();
    ctx.ellipse(50, 56, 34, 24, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#9b7650';
    ctx.beginPath();
    ctx.ellipse(42, 48, 14, 8, -0.4, 0, Math.PI * 2);
    ctx.fill();
    line(ctx, '#4e3822', 2, 58, 58, 66, 66);
  },
  stethoscope: (ctx) => {
    arcLine(ctx, '#4fd1c5', 5, 40, 36, 22, 0.3 * Math.PI, 1.9 * Math.PI);
    arcLine(ctx, '#4fd1c5', 5, 50, 62, 18, 0.9 * Math.PI, 2.1 * Math.PI);
    line(ctx, '#4fd1c5', 5, 22, 20, 22, 36);
    line(ctx, '#4fd1c5', 5, 58, 20, 58, 36);
    disc(ctx, '#a0aec0', 22, 16, 5);
    disc(ctx, '#a0aec0', 58, 16, 5);
    disc(ctx, '#cbd5e0', 68, 62, 14);
    disc(ctx, '#718096', 68, 62, 7);
  },
  rotateTool: (ctx) => {
    ctx.fillStyle = '#5c6b7a';
    ctx.beginPath();
    ctx.ellipse(50, 66, 38, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8ea0b2';
    ctx.beginPath();
    ctx.ellipse(50, 60, 38, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    arcLine(ctx, '#2f855a', 6, 50, 34, 20, 0.2 * Math.PI, 1.7 * Math.PI);
    triangle(ctx, '#2f855a', 62, 12, 78, 24, 58, 28);
  },
  flipTool: (ctx) => {
    rect(ctx, '#c58b4a', 14, 70, 72, 12, 4);
    arcLine(ctx, '#dd6b20', 6, 50, 62, 30, 1.15 * Math.PI, 1.85 * Math.PI);
    triangle(ctx, '#dd6b20', 14, 42, 28, 42, 21, 56);
    triangle(ctx, '#dd6b20', 86, 42, 72, 42, 79, 56);
  },
  tape: (ctx) => {
    disc(ctx, '#aab3bd', 50, 50, 36);
    disc(ctx, '#e2e8f0', 50, 50, 28);
    disc(ctx, '#f7fafc', 50, 50, 14);
    arcLine(ctx, '#718096', 3, 50, 50, 36, 0, Math.PI * 2);
    arcLine(ctx, '#718096', 2, 50, 50, 14, 0, Math.PI * 2);
    rect(ctx, '#aab3bd', 70, 78, 22, 8, 2);
  },
  sealant: (ctx) => {
    ctx.fillStyle = '#2b6cb0';
    ctx.beginPath();
    ctx.moveTo(10, 32);
    ctx.lineTo(62, 28);
    ctx.lineTo(62, 72);
    ctx.lineTo(10, 68);
    ctx.closePath();
    ctx.fill();
    rect(ctx, '#bee3f8', 6, 28, 8, 44, 2);
    triangle(ctx, '#e2e8f0', 62, 38, 84, 47, 62, 62);
    rect(ctx, '#e2e8f0', 82, 46, 10, 6, 2);
    disc(ctx, '#63b3ed', 94, 60, 3);
  },
  relabel: (ctx) => {
    rect(ctx, '#f7fafc', 12, 22, 52, 60, 3);
    ctx.strokeStyle = '#a0aec0';
    ctx.lineWidth = 2;
    ctx.strokeRect(12, 22, 52, 60);
    line(ctx, '#a0aec0', 3, 20, 38, 56, 38);
    line(ctx, '#a0aec0', 3, 20, 50, 56, 50);
    line(ctx, '#a0aec0', 3, 20, 62, 42, 62);
    ctx.save();
    ctx.translate(76, 52);
    ctx.rotate(-0.8);
    rect(ctx, '#d53f8c', -4, -30, 8, 46, 2);
    triangle(ctx, '#2d3748', -4, 16, 4, 16, 0, 26);
    ctx.restore();
  },
  valve: (ctx) => {
    rect(ctx, '#b7791f', 6, 62, 26, 10, 3);
    disc(ctx, '#d69e2e', 58, 50, 32);
    disc(ctx, '#fffaf0', 58, 50, 25);
    arcLine(ctx, '#744210', 3, 58, 50, 32, 0, Math.PI * 2);
    line(ctx, '#e53e3e', 3, 58, 50, 72, 36);
    disc(ctx, '#744210', 58, 50, 3);
    line(ctx, '#744210', 2, 40, 62, 44, 58);
    line(ctx, '#744210', 2, 76, 62, 72, 58);
  },
  foam: (ctx) => {
    rect(ctx, '#f6c90e', 30, 34, 36, 56, 6);
    rect(ctx, '#d69e2e', 30, 34, 36, 8, 3);
    rect(ctx, '#2d3748', 38, 20, 20, 16, 3);
    rect(ctx, '#e2e8f0', 56, 22, 14, 6, 2);
    rect(ctx, '#c53030', 38, 54, 20, 14, 2);
    disc(ctx, '#fffbea', 80, 24, 5);
    disc(ctx, '#fffbea', 88, 32, 4);
  },
};

export function drawTool(ctx: CanvasRenderingContext2D, tool: ToolId, size: number): void {
  ctx.save();
  ctx.scale(size / 100, size / 100);
  ART[tool](ctx);
  ctx.restore();
}
