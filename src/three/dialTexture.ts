import * as THREE from 'three';
import type { TimepieceShape } from '../clock/skins';

const SIZE = 1024;
const ROMAN = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

interface DialColors {
  face: string;
  faceEdge: string;
  ink: string;
  inkDim: string;
  accent: string;
}

function ring(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  w: number,
  color: string,
) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.stroke();
}

function tickMark(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  angle: number,
  rOuter: number,
  rInner: number,
  w: number,
  color: string,
) {
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(angle) * rInner, cy + Math.sin(angle) * rInner);
  ctx.lineTo(cx + Math.cos(angle) * rOuter, cy + Math.sin(angle) * rOuter);
  ctx.lineCap = 'round';
  ctx.lineWidth = w;
  ctx.strokeStyle = color;
  ctx.stroke();
}

function drawBase(ctx: CanvasRenderingContext2D, c: DialColors) {
  const g = ctx.createRadialGradient(SIZE * 0.42, SIZE * 0.36, 40, SIZE / 2, SIZE / 2, SIZE * 0.62);
  g.addColorStop(0, c.face);
  g.addColorStop(1, c.faceEdge);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // fine sunburst
  ctx.save();
  ctx.translate(SIZE / 2, SIZE / 2);
  ctx.globalAlpha = 0.05;
  ctx.strokeStyle = c.ink;
  ctx.lineWidth = 1;
  for (let i = 0; i < 240; i++) {
    ctx.beginPath();
    ctx.rotate((Math.PI * 2) / 240);
    ctx.moveTo(30, 0);
    ctx.lineTo(SIZE * 0.46, 0);
    ctx.stroke();
  }
  ctx.restore();
}

function wordmark(ctx: CanvasRenderingContext2D, c: DialColors, sub: string) {
  ctx.fillStyle = c.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '600 46px "Space Grotesk", "Helvetica Neue", sans-serif';
  ctx.fillText('ZYNC', SIZE / 2, SIZE * 0.34);
  ctx.fillStyle = c.inkDim;
  ctx.font = '500 24px "Inter", sans-serif';
  ctx.fillText(sub, SIZE / 2, SIZE * 0.4);
}

function drawPocket(ctx: CanvasRenderingContext2D, c: DialColors) {
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  ring(ctx, cx, cy, SIZE * 0.47, 6, c.accent);
  ring(ctx, cx, cy, SIZE * 0.44, 2, c.inkDim);

  // outer month ring
  const months = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
  ctx.fillStyle = c.inkDim;
  ctx.font = '600 22px "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  months.forEach((m, i) => {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * SIZE * 0.405, cy + Math.sin(a) * SIZE * 0.405);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillText(m, 0, 0);
    ctx.restore();
  });

  // minute track
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    tickMark(ctx, cx, cy, a, SIZE * 0.435, SIZE * 0.415, i % 5 === 0 ? 6 : 2, c.ink);
  }

  // roman numerals
  ctx.fillStyle = c.ink;
  ctx.font = '600 64px "Times New Roman", "Georgia", serif';
  ROMAN.forEach((rn, i) => {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    ctx.fillText(rn, cx + Math.cos(a) * SIZE * 0.36, cy + Math.sin(a) * SIZE * 0.36);
  });

  // running-seconds sub-dial at 6
  const sx = cx;
  const sy = cy + SIZE * 0.2;
  ring(ctx, sx, sy, SIZE * 0.09, 3, c.inkDim);
  ctx.fillStyle = c.inkDim;
  ctx.font = '600 18px "Inter", sans-serif';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    tickMark(ctx, sx, sy, a, SIZE * 0.088, SIZE * 0.072, 2, c.inkDim);
  }
  wordmark(ctx, c, 'POCKET · 1901');
}

function drawWrist(ctx: CanvasRenderingContext2D, c: DialColors) {
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  ring(ctx, cx, cy, SIZE * 0.46, 4, c.inkDim);

  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const major = i % 5 === 0;
    tickMark(ctx, cx, cy, a, SIZE * 0.44, major ? SIZE * 0.4 : SIZE * 0.42, major ? 6 : 2, c.ink);
  }

  ctx.fillStyle = c.ink;
  ctx.font = '600 58px "Space Grotesk", "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let n = 1; n <= 12; n++) {
    const a = (n / 12) * Math.PI * 2 - Math.PI / 2;
    ctx.fillText(String(n), cx + Math.cos(a) * SIZE * 0.385, cy + Math.sin(a) * SIZE * 0.385);
  }

  // date window at 3
  ctx.strokeStyle = c.accent;
  ctx.lineWidth = 3;
  ctx.strokeRect(cx + SIZE * 0.27, cy - 26, 58, 52);
  ctx.fillStyle = c.ink;
  ctx.font = '600 30px "Space Grotesk", sans-serif';
  ctx.fillText('25', cx + SIZE * 0.27 + 29, cy);

  wordmark(ctx, c, 'AUTOMATIC · FOCO');
}

function drawWall(ctx: CanvasRenderingContext2D, c: DialColors) {
  const cx = SIZE / 2;
  const cy = SIZE / 2;

  // dive-style outer bezel numbers
  ctx.fillStyle = c.ink;
  ctx.font = '700 40px "Space Grotesk", "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    if (i % 2 === 0 && i !== 0) {
      ctx.fillText(String(i * 5), cx + Math.cos(a) * SIZE * 0.44, cy + Math.sin(a) * SIZE * 0.44);
    } else {
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * SIZE * 0.44, cy + Math.sin(a) * SIZE * 0.44, i === 0 ? 12 : 8, 0, Math.PI * 2);
      ctx.fillStyle = i === 0 ? c.accent : c.ink;
      ctx.fill();
      ctx.fillStyle = c.ink;
    }
  }
  ring(ctx, cx, cy, SIZE * 0.38, 3, c.inkDim);

  // chunky applied indices with lume
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * SIZE * 0.32, cy + Math.sin(a) * SIZE * 0.32);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillStyle = '#e9f4ef';
    if (i === 0) {
      ctx.fillRect(-30, -22, 60, 26);
    } else if (i % 3 === 0) {
      ctx.fillRect(-16, -34, 32, 34);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  wordmark(ctx, c, 'FOCUS · CHRONOMETER');
}

const DRAWERS: Record<Exclude<TimepieceShape, 'hourglass'>, (ctx: CanvasRenderingContext2D, c: DialColors) => void> = {
  pocket: drawPocket,
  wrist: drawWrist,
  wall: drawWall,
};

export function makeDialTexture(shape: TimepieceShape, colors: DialColors): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  drawBase(ctx, colors);
  if (shape !== 'hourglass') DRAWERS[shape](ctx, colors);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export type { DialColors };
