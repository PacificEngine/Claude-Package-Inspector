import { revealedDefects } from '../game/inspection';
import type { DefectId, Handling, Package, PackageKind } from '../game/types';
import type { PackageAction } from './animation';
import { contentsFor, type Contents, type ContentsItem } from './contents';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const BODY_COLOR: Record<PackageKind, string> = {
  box: '#c9a26b',
  parcel: '#d8b98a',
  can: '#9aa7b1',
  jar: '#a8d0c7',
  tube: '#d99aa0',
};

function bodyRect(kind: PackageKind, w: number, h: number): Rect {
  const floor = h - 40;
  switch (kind) {
    case 'box':
      return { x: w / 2 - 80, y: floor - 130, w: 160, h: 130 };
    case 'parcel':
      return { x: w / 2 - 95, y: floor - 90, w: 190, h: 90 };
    case 'can':
      return { x: w / 2 - 50, y: floor - 120, w: 100, h: 120 };
    case 'jar':
      return { x: w / 2 - 55, y: floor - 110, w: 110, h: 110 };
    case 'tube':
      return { x: w / 2 - 35, y: floor - 150, w: 70, h: 150 };
  }
}

const MARKS: Partial<Record<DefectId, (ctx: CanvasRenderingContext2D, b: Rect) => void>> = {
  leaking: (ctx, b) => {
    ctx.fillStyle = '#2b6cb0';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(b.x + b.w * (0.25 + i * 0.25), b.y + b.h + 8 + i * 5, 5, 9, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  crushed_corner: (ctx, b) => {
    ctx.fillStyle = '#5a4630';
    ctx.beginPath();
    ctx.moveTo(b.x + b.w, b.y);
    ctx.lineTo(b.x + b.w - 40, b.y);
    ctx.lineTo(b.x + b.w, b.y + 40);
    ctx.fill();
  },
  torn_tape: (ctx, b) => {
    ctx.strokeStyle = '#f5f5f0';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y + 6);
    for (let i = 1; i * 12 <= b.w; i++) ctx.lineTo(b.x + i * 12, b.y + (i % 2 === 0 ? 0 : 12));
    ctx.stroke();
  },
  bulging: (ctx, b) => {
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(b.x + b.w / 2, b.y + b.h / 2, b.w * 0.62, b.h * 0.52, 0, 0, Math.PI * 2);
    ctx.stroke();
  },
  wet_cardboard: (ctx, b) => {
    ctx.fillStyle = 'rgba(40, 50, 70, 0.45)';
    ctx.fillRect(b.x, b.y + b.h * 0.6, b.w, b.h * 0.4);
  },
  bottomless: (ctx, b) => {
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(b.x + b.w / 2, b.y + b.h, b.w * 0.4, 14, 0, 0, Math.PI * 2);
    ctx.fill();
  },
  scorching: (ctx, b) => {
    const g = ctx.createRadialGradient(b.x + b.w / 2, b.y + b.h / 2, 10, b.x + b.w / 2, b.y + b.h / 2, b.w);
    g.addColorStop(0, 'rgba(255, 220, 120, 0.7)');
    g.addColorStop(1, 'rgba(255, 80, 0, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w * 2, b.h * 2);
  },
  tiny_weather: (ctx, b) => {
    ctx.fillStyle = '#cbd5e0';
    ctx.beginPath();
    ctx.arc(b.x + b.w / 2 - 12, b.y - 14, 12, 0, Math.PI * 2);
    ctx.arc(b.x + b.w / 2 + 6, b.y - 18, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ecc94b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.x + b.w / 2, b.y - 4);
    ctx.lineTo(b.x + b.w / 2 - 6, b.y + 8);
    ctx.lineTo(b.x + b.w / 2 + 2, b.y + 8);
    ctx.lineTo(b.x + b.w / 2 - 4, b.y + 20);
    ctx.stroke();
  },
};

export interface View {
  action: PackageAction | null;
  progress: number; // 0..1 through the action's animation
}

const REST: View = { action: null, progress: 1 };

const flat = (kind: PackageKind): boolean => kind === 'box' || kind === 'parcel';
const ease = (t: number): number => 1 - (1 - t) * (1 - t);

function darken(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (shift: number): number => Math.round(((n >> shift) & 255) * factor);
  return `rgb(${c(16)}, ${c(8)}, ${c(0)})`;
}

function drawBelt(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.fillStyle = '#3a3f47';
  ctx.fillRect(0, height - 40, width, 40);
  ctx.fillStyle = '#4b515b';
  for (let x = 0; x < width; x += 24) ctx.fillRect(x, height - 40, 12, 6);
}

function bodyPath(ctx: CanvasRenderingContext2D, pkg: Package, b: Rect): void {
  ctx.beginPath();
  if (flat(pkg.kind)) ctx.rect(b.x, b.y, b.w, b.h);
  else ctx.roundRect(b.x, b.y, b.w, b.h, 18);
}

// ---- contents ----------------------------------------------------------------

function drawItem(ctx: CanvasRenderingContext2D, item: ContentsItem, cx: number, base: number): void {
  ctx.fillStyle = item.color;
  switch (item.art) {
    case 'dome':
      ctx.beginPath();
      ctx.arc(cx, base, 34, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (const dx of [-16, 0, 14]) ctx.fillRect(cx + dx, base - 22 - Math.abs(dx) / 3, 5, 5);
      break;
    case 'sticks':
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = i % 2 === 0 ? item.color : darken(item.color, 0.75);
        ctx.fillRect(cx - 24 + i * 11, base - 36 - (i % 3) * 8, 8, 40 + (i % 3) * 8);
      }
      break;
    case 'cloth':
      ctx.beginPath();
      ctx.roundRect(cx - 30, base - 22, 60, 24, 8);
      ctx.fill();
      ctx.fillStyle = darken(item.color, 0.8);
      ctx.beginPath();
      ctx.roundRect(cx - 24, base - 40, 48, 20, 8);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillRect(cx - 24, base - 32, 48, 4);
      break;
    case 'teapot':
      ctx.beginPath();
      ctx.ellipse(cx, base - 18, 28, 20, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx + 24, base - 22);
      ctx.lineTo(cx + 42, base - 38);
      ctx.lineTo(cx + 30, base - 12);
      ctx.fill();
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(cx - 28, base - 20, 10, Math.PI * 0.5, Math.PI * 1.5);
      ctx.stroke();
      ctx.fillStyle = darken(item.color, 0.8);
      ctx.beginPath();
      ctx.ellipse(cx, base - 40, 10, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'duck':
      ctx.beginPath();
      ctx.ellipse(cx - 4, base - 14, 26, 15, 0, 0, Math.PI * 2);
      ctx.arc(cx + 18, base - 36, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f2994a';
      ctx.beginPath();
      ctx.moveTo(cx + 28, base - 38);
      ctx.lineTo(cx + 40, base - 33);
      ctx.lineTo(cx + 28, base - 30);
      ctx.fill();
      ctx.fillStyle = '#222';
      ctx.fillRect(cx + 20, base - 41, 3, 3);
      break;
    case 'tower':
      ctx.beginPath();
      ctx.moveTo(cx - 16, base);
      ctx.lineTo(cx - 9, base - 52);
      ctx.lineTo(cx + 9, base - 52);
      ctx.lineTo(cx + 16, base);
      ctx.fill();
      ctx.fillStyle = '#d94a38';
      ctx.fillRect(cx - 13, base - 30, 26, 9);
      ctx.fillStyle = '#f2c94c';
      ctx.fillRect(cx - 8, base - 62, 16, 10);
      break;
    case 'book':
      ctx.fillRect(cx - 32, base - 18, 64, 18);
      ctx.fillStyle = '#5a7ea6';
      ctx.fillRect(cx - 26, base - 34, 54, 16);
      ctx.fillStyle = '#fdfdf5';
      ctx.fillRect(cx - 30, base - 12, 58, 3);
      break;
  }
}

function drawExtraBehind(ctx: CanvasRenderingContext2D, extra: Contents['extras'][number], cx: number, rim: number): void {
  switch (extra) {
    case 'glow': {
      const g = ctx.createRadialGradient(cx, rim - 10, 6, cx, rim - 10, 55);
      g.addColorStop(0, 'rgba(255, 240, 160, 0.95)');
      g.addColorStop(1, 'rgba(255, 90, 0, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - 60, rim - 70, 120, 120);
      break;
    }
    case 'storm':
      ctx.fillStyle = '#cbd5e0';
      ctx.beginPath();
      ctx.arc(cx - 12, rim - 40, 13, 0, Math.PI * 2);
      ctx.arc(cx + 8, rim - 46, 17, 0, Math.PI * 2);
      ctx.arc(cx + 24, rim - 38, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ecc94b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx + 4, rim - 30);
      ctx.lineTo(cx - 2, rim - 18);
      ctx.lineTo(cx + 6, rim - 18);
      ctx.lineTo(cx, rim - 4);
      ctx.stroke();
      break;
    case 'clock':
      ctx.fillStyle = '#f7fafc';
      ctx.beginPath();
      ctx.arc(cx, rim - 26, 17, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#2d3748';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, rim - 26);
      ctx.lineTo(cx, rim - 38);
      ctx.moveTo(cx, rim - 26);
      ctx.lineTo(cx + 8, rim - 22);
      ctx.stroke();
      break;
    case 'gadget':
      ctx.save();
      ctx.translate(cx, rim - 20);
      ctx.rotate(-0.25);
      ctx.fillStyle = '#9f7aea';
      ctx.fillRect(-18, -16, 36, 28);
      ctx.fillStyle = '#2d3748';
      ctx.fillRect(-12, -10, 24, 12);
      ctx.fillStyle = '#f56565';
      ctx.fillRect(-12, 6, 6, 4);
      ctx.fillRect(6, 6, 6, 4);
      ctx.strokeStyle = '#9f7aea';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(8, -16);
      ctx.lineTo(14, -34);
      ctx.stroke();
      ctx.restore();
      break;
    case 'waves':
      ctx.strokeStyle = 'rgba(160, 200, 255, 0.8)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        for (let y = 0; y < 48; y += 4) {
          const x = cx - 16 + i * 16 + Math.sin(y / 5 + i) * 5;
          if (y === 0) ctx.moveTo(x, rim - y);
          else ctx.lineTo(x, rim - y);
        }
        ctx.stroke();
      }
      break;
    default:
      break; // 'void' and 'liquid' sit on the rim, drawn after the body
  }
}

function drawInside(ctx: CanvasRenderingContext2D, pkg: Package, b: Rect, contents: Contents, open: number): void {
  const cx = b.x + b.w / 2;
  const rim = b.y + 2;
  const hasVoid = contents.extras.includes('void');
  if (flat(pkg.kind)) {
    // Flaps swing up and out behind the contents.
    ctx.fillStyle = darken(BODY_COLOR[pkg.kind], 0.9);
    const lift = 40 * open;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x + b.w * 0.46, b.y);
    ctx.lineTo(b.x + b.w * 0.46 - 8 * open, b.y - lift);
    ctx.lineTo(b.x - 16 * open, b.y - lift);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(b.x + b.w, b.y);
    ctx.lineTo(b.x + b.w * 0.54, b.y);
    ctx.lineTo(b.x + b.w * 0.54 + 8 * open, b.y - lift);
    ctx.lineTo(b.x + b.w + 16 * open, b.y - lift);
    ctx.fill();
  }
  ctx.save();
  ctx.translate(0, (1 - open) * 40);
  ctx.globalAlpha = open;
  if (!hasVoid) drawItem(ctx, contents.item, cx, rim);
  for (const extra of contents.extras) drawExtraBehind(ctx, extra, cx, rim);
  ctx.restore();
}

function drawRim(ctx: CanvasRenderingContext2D, pkg: Package, b: Rect, contents: Contents, open: number): void {
  const cx = b.x + b.w / 2;
  // The dark inside of the opening, in front of the contents.
  ctx.fillStyle = contents.extras.includes('void') ? '#000' : '#2b2118';
  ctx.beginPath();
  ctx.ellipse(cx, b.y + 4, b.w * 0.42, 9 * open + 1, 0, 0, Math.PI * 2);
  ctx.fill();
  if (contents.extras.includes('liquid')) {
    ctx.fillStyle = '#3b82c4';
    ctx.beginPath();
    ctx.ellipse(cx, b.y + 6, b.w * 0.34, 5 * open + 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (!flat(pkg.kind)) {
    // The lid lifts off and tilts away.
    ctx.fillStyle = darken(BODY_COLOR[pkg.kind], 0.85);
    ctx.beginPath();
    ctx.ellipse(cx + 34 * open, b.y - 10 - 26 * open, b.w * 0.5, 8, -0.35 * open, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---- underside (rotate) --------------------------------------------------------

function drawUnderside(ctx: CanvasRenderingContext2D, pkg: Package, b: Rect, handling: Handling): void {
  ctx.fillStyle = darken(BODY_COLOR[pkg.kind], 0.72);
  bodyPath(ctx, pkg, b);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 3;
  ctx.strokeRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);

  const bottomless = pkg.defects.includes('bottomless') && !handling.repaired.includes('bottomless');
  if (bottomless) {
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(b.x + b.w / 2, b.y + b.h / 2, b.w * 0.36, b.h * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 4;
    ctx.stroke();
  } else {
    ctx.fillStyle = '#b08a52'; // sealed-bottom tape cross
    ctx.fillRect(b.x, b.y + b.h / 2 - 5, b.w, 10);
    ctx.fillRect(b.x + b.w / 2 - 5, b.y, 10, b.h);
  }
  if (pkg.defects.includes('wet_cardboard') && !handling.repaired.includes('wet_cardboard')) {
    ctx.fillStyle = 'rgba(30, 40, 70, 0.55)';
    ctx.beginPath();
    ctx.ellipse(b.x + b.w * 0.3, b.y + b.h * 0.6, b.w * 0.22, b.h * 0.2, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (handling.repaired.length > 0) {
    ctx.fillStyle = '#9aa0a6';
    ctx.fillRect(b.x + b.w * 0.2, b.y + b.h * 0.2, b.w * 0.6, 12);
  }
}

// ---- main body -----------------------------------------------------------------

function drawTopSide(
  ctx: CanvasRenderingContext2D,
  pkg: Package,
  b: Rect,
  handling: Handling,
  revealed: DefectId[],
  contents: Contents,
  open: number,
): void {
  if (open > 0) drawInside(ctx, pkg, b, contents, open);

  ctx.fillStyle = BODY_COLOR[pkg.kind];
  bodyPath(ctx, pkg, b);
  ctx.fill();

  // Seal tape strip, drawn unless the tape is torn
  if (flat(pkg.kind) && !revealed.includes('torn_tape')) {
    ctx.fillStyle = '#b08a52';
    ctx.fillRect(b.x, b.y + 4, b.w, 8);
  }

  // Contents label, absent when the defect is present and unrepaired
  if (!revealed.includes('missing_label')) {
    ctx.fillStyle = '#fdfdf5';
    ctx.fillRect(b.x + b.w * 0.2, b.y + b.h * 0.4, b.w * 0.6, b.h * 0.3);
    ctx.fillStyle = '#718096';
    ctx.fillRect(b.x + b.w * 0.25, b.y + b.h * 0.47, b.w * 0.5, 3);
    ctx.fillRect(b.x + b.w * 0.25, b.y + b.h * 0.56, b.w * 0.35, 3);
  }

  // When open, the inside view replaces the outside storm and glow.
  const skipWhenOpen: DefectId[] = open > 0 ? ['tiny_weather', 'scorching'] : [];
  for (const id of revealed) if (!skipWhenOpen.includes(id)) MARKS[id]?.(ctx, b);

  // Applied repairs show as a duct-tape patch
  if (handling.repaired.length > 0) {
    ctx.fillStyle = '#9aa0a6';
    ctx.fillRect(b.x + b.w * 0.1, b.y + b.h * 0.1, b.w * 0.3, 14);
  }

  if (open > 0) drawRim(ctx, pkg, b, contents, open);
}

// ---- overlays for each interaction ---------------------------------------------

function drawScale(ctx: CanvasRenderingContext2D, pkg: Package, b: Rect, p: number, width: number, height: number): void {
  ctx.fillStyle = '#718096';
  ctx.fillRect(b.x - 16, height - 46, b.w + 32, 8);
  const cx = width - 56;
  const cy = 74;
  ctx.fillStyle = '#f7fafc';
  ctx.beginPath();
  ctx.arc(cx, cy, 40, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#2d3748';
  ctx.lineWidth = 2;
  ctx.stroke();
  const target = Math.min(1, pkg.actualWeightKg / 10);
  const settle = ease(Math.min(1, p / 0.7));
  const wobble = p < 0.7 ? Math.sin(p * 30) * 0.04 * (1 - p / 0.7) : 0;
  const angle = Math.PI + (target * settle + wobble) * Math.PI;
  ctx.strokeStyle = '#e53e3e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(angle) * 34, cy + Math.sin(angle) * 34);
  ctx.stroke();
  if (p > 0.7) {
    ctx.fillStyle = '#f7fafc';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${pkg.actualWeightKg} kg`, cx, cy + 20);
  }
}

function drawUv(ctx: CanvasRenderingContext2D, b: Rect, p: number, width: number, height: number): void {
  const a = Math.sin(p * Math.PI);
  ctx.fillStyle = `rgba(100, 50, 255, ${0.3 * a})`;
  ctx.fillRect(0, 0, width, height - 40);
  ctx.fillStyle = `rgba(190, 150, 255, ${0.22 * a})`;
  ctx.beginPath();
  ctx.moveTo(26, 14);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(b.x + b.w, b.y + b.h * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.shadowColor = '#c4a3ff';
  ctx.shadowBlur = 18 * a;
  ctx.strokeStyle = `rgba(210, 190, 255, ${a})`;
  ctx.lineWidth = 3;
  ctx.strokeRect(b.x, b.y, b.w, b.h);
  ctx.restore();
  ctx.fillStyle = '#6b46c1';
  ctx.fillRect(14, 8, 24, 10);
}

function drawPebble(ctx: CanvasRenderingContext2D, pkg: Package, b: Rect, p: number, height: number): void {
  const cx = b.x + b.w / 2;
  const bottomless = pkg.defects.includes('bottomless');
  const land = b.y + 6;
  let y: number;
  let alpha = 1;
  if (p < 0.4) {
    y = 16 + (land - 16) * (p / 0.4) ** 2;
  } else if (bottomless) {
    const t = (p - 0.4) / 0.6;
    y = land + (height + 40 - land) * t * t;
    alpha = 1 - t;
  } else {
    y = land;
    alpha = Math.max(0, 1 - (p - 0.4) / 0.2);
    const ring = (p - 0.4) / 0.6;
    ctx.strokeStyle = `rgba(255,255,255,${0.7 * (1 - ring)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, land, 10 + ring * 40, 3 + ring * 8, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#a0aec0';
  ctx.beginPath();
  ctx.arc(cx, y, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawStethoscope(ctx: CanvasRenderingContext2D, b: Rect, p: number, width: number): void {
  const px = b.x + b.w + 6;
  const py = b.y + b.h * 0.5;
  ctx.strokeStyle = '#4a5568';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(px + 6, py);
  ctx.bezierCurveTo(width - 10, py + 10, width - 10, 30, width - 50, 20);
  ctx.stroke();
  ctx.fillStyle = '#cbd5e0';
  ctx.beginPath();
  ctx.arc(px, py, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#4a5568';
  ctx.stroke();
  for (let i = 0; i < 3; i++) {
    const t = (p * 1.5 + i / 3) % 1;
    ctx.strokeStyle = `rgba(160, 220, 255, ${0.7 * (1 - t)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(b.x + b.w * 0.5, py, 14 + t * (b.w * 0.5), Math.PI * 1.25, Math.PI * 1.75);
    ctx.stroke();
  }
}

function drawShakeLines(ctx: CanvasRenderingContext2D, b: Rect, p: number): void {
  ctx.strokeStyle = `rgba(255,255,255,${0.6 * (1 - p)})`;
  ctx.lineWidth = 3;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const x = side < 0 ? b.x - 10 - i * 8 : b.x + b.w + 10 + i * 8;
      ctx.beginPath();
      ctx.moveTo(x, b.y + 20 + i * 24);
      ctx.lineTo(x + side * 8, b.y + 34 + i * 24);
      ctx.stroke();
    }
  }
}

function drawRepairFlash(ctx: CanvasRenderingContext2D, b: Rect, p: number): void {
  ctx.save();
  ctx.shadowColor = '#fff';
  ctx.shadowBlur = 24 * (1 - p);
  ctx.fillStyle = `rgba(255,255,255,${0.7 * (1 - p)})`;
  ctx.fillRect(b.x + b.w * 0.1, b.y + b.h * 0.1, b.w * 0.3, 14);
  ctx.restore();
}

export function drawPackage(
  ctx: CanvasRenderingContext2D,
  pkg: Package,
  handling: Handling,
  view: View = REST,
): void {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
  drawBelt(ctx, width, height);

  const b = bodyRect(pkg.kind, width, height);
  const revealed = revealedDefects(pkg, handling);
  const contents = contentsFor(pkg);
  const { action, progress: p } = view;
  const open = handling.opened ? (action === 'open' ? ease(p) : 1) : 0;

  ctx.save();
  if (action === 'shake') ctx.translate(Math.sin(p * Math.PI * 10) * 10 * (1 - p), 0);
  let underside = false;
  if (action === 'rotate') {
    // Tumble over and back: squash flat, show the underside, squash flat, come back.
    const cos = Math.cos(p * Math.PI * 2);
    const cy = b.y + b.h / 2;
    ctx.translate(0, cy);
    ctx.scale(1, Math.max(0.04, Math.abs(cos)));
    ctx.translate(0, -cy);
    underside = cos < 0;
  }
  if (underside) drawUnderside(ctx, pkg, b, handling);
  else drawTopSide(ctx, pkg, b, handling, revealed, contents, open);
  ctx.restore();

  if (p >= 1 && action !== null) return; // finished: the resting pose has no overlay
  switch (action) {
    case 'scale':
      drawScale(ctx, pkg, b, p, width, height);
      break;
    case 'uv':
      drawUv(ctx, b, p, width, height);
      break;
    case 'pebble':
      drawPebble(ctx, pkg, b, p, height);
      break;
    case 'stethoscope':
      drawStethoscope(ctx, b, p, width);
      break;
    case 'shake':
      drawShakeLines(ctx, b, p);
      break;
    case 'repair':
      drawRepairFlash(ctx, b, p);
      break;
    default:
      break;
  }
}
