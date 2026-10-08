import { revealedDefects } from '../game/inspection';
import type { DefectId, Handling, Package, PackageKind } from '../game/types';

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

export function drawPackage(ctx: CanvasRenderingContext2D, pkg: Package, handling: Handling): void {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
  const revealed = revealedDefects(pkg, handling);

  // Conveyor belt
  ctx.fillStyle = '#3a3f47';
  ctx.fillRect(0, height - 40, width, 40);
  ctx.fillStyle = '#4b515b';
  for (let x = 0; x < width; x += 24) ctx.fillRect(x, height - 40, 12, 6);

  const b = bodyRect(pkg.kind, width, height);
  ctx.fillStyle = BODY_COLOR[pkg.kind];
  ctx.beginPath();
  if (pkg.kind === 'box' || pkg.kind === 'parcel') ctx.rect(b.x, b.y, b.w, b.h);
  else ctx.roundRect(b.x, b.y, b.w, b.h, 18);
  ctx.fill();

  // Seal tape strip, drawn unless the tape is torn
  if ((pkg.kind === 'box' || pkg.kind === 'parcel') && !revealed.includes('torn_tape')) {
    ctx.fillStyle = '#b08a52';
    ctx.fillRect(b.x, b.y + 4, b.w, 8);
  }

  // Contents label, absent when the defect is present and unrepaired
  const labelMissing = revealed.includes('missing_label');
  if (!labelMissing) {
    ctx.fillStyle = '#fdfdf5';
    ctx.fillRect(b.x + b.w * 0.2, b.y + b.h * 0.4, b.w * 0.6, b.h * 0.3);
    ctx.fillStyle = '#718096';
    ctx.fillRect(b.x + b.w * 0.25, b.y + b.h * 0.47, b.w * 0.5, 3);
    ctx.fillRect(b.x + b.w * 0.25, b.y + b.h * 0.56, b.w * 0.35, 3);
  }

  for (const id of revealed) MARKS[id]?.(ctx, b);

  // Applied repairs show as a duct-tape patch
  if (handling.repaired.length > 0) {
    ctx.fillStyle = '#9aa0a6';
    ctx.fillRect(b.x + b.w * 0.1, b.y + b.h * 0.1, b.w * 0.3, 14);
  }

  if (handling.opened) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.fillRect(b.x, b.y, b.w, 10);
  }
}
