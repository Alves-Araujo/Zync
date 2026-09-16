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

/** Engine-turned "guilloché" texture: concentric wavy rings, like a real dial. */
function guillocheRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  color: string,
  waves = 44,
  amp = 2.5,
  alpha = 0.3,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  const rings = 7;
  for (let ring = 0; ring < rings; ring++) {
    const r = rInner + ((rOuter - rInner) * ring) / (rings - 1);
    ctx.beginPath();
    for (let i = 0; i <= 360; i += 2) {
      const a = (i / 360) * Math.PI * 2;
      const rr = r + Math.sin(a * waves) * amp;
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
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

  // engine-turned guilloché medallion filling the centre
  guillocheRing(ctx, cx, cy, SIZE * 0.33, SIZE * 0.15, c.ink, 42, 2.6, 0.28);

  // running-seconds sub-dial at 6
  const sx = cx;
  const sy = cy + SIZE * 0.2;
  ring(ctx, sx, sy, SIZE * 0.09, 3, c.inkDim);
  ctx.fillStyle = c.inkDim;
  ctx.font = '600 18px "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    tickMark(ctx, sx, sy, a, SIZE * 0.088, SIZE * 0.072, 2, c.inkDim);
    if (i % 3 === 0) {
      const n = (i / 12) * 60;
      const tx = sx + Math.cos(a) * SIZE * 0.062;
      const ty = sy + Math.sin(a) * SIZE * 0.062;
      ctx.font = '600 13px "Inter", sans-serif';
      ctx.fillText(String(n), tx, ty);
    }
  }
  wordmark(ctx, c, 'POCKET · 1901');
}

function drawWrist(ctx: CanvasRenderingContext2D, c: DialColors, day: number) {
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  // the minute track + hour indices are real 3D parts; print only a fine outer rail
  ring(ctx, cx, cy, SIZE * 0.475, 2, c.inkDim);
  ring(ctx, cx, cy, SIZE * 0.325, 1.5, c.inkDim);

  // numerals sit on an inner ring, clear of the applied indices (which live at ~0.38)
  ctx.fillStyle = c.ink;
  ctx.font = '600 46px "Space Grotesk", "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let n = 1; n <= 12; n++) {
    if (n === 3) continue; // date window lives here
    const a = (n / 12) * Math.PI * 2 - Math.PI / 2;
    ctx.fillText(String(n), cx + Math.cos(a) * SIZE * 0.27, cy + Math.sin(a) * SIZE * 0.27);
  }

  // engine-turned guilloché medallion in the centre
  guillocheRing(ctx, cx, cy, SIZE * 0.2, SIZE * 0.07, c.ink, 36, 2.2, 0.22);

  // date window at 3
  const dx = cx + SIZE * 0.27;
  ctx.fillStyle = '#f3f1ea';
  ctx.fillRect(dx - 28, cy - 24, 56, 48);
  ctx.strokeStyle = c.accent;
  ctx.lineWidth = 3;
  ctx.strokeRect(dx - 28, cy - 24, 56, 48);
  ctx.fillStyle = '#1a1a1f';
  ctx.font = '600 30px "Space Grotesk", sans-serif';
  ctx.fillText(String(day), dx, cy + 1);

  wordmark(ctx, c, 'AUTOMATIC · FOCO');
  ctx.fillStyle = c.inkDim;
  ctx.font = '500 15px "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('WATER RESIST. 50M', cx, cy + SIZE * 0.13);
}

function drawWall(ctx: CanvasRenderingContext2D, c: DialColors) {
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  // the dive scale is on the ceramic bezel insert and the indices are 3D — keep the dial clean
  ring(ctx, cx, cy, SIZE * 0.475, 2, c.inkDim);
  ring(ctx, cx, cy, SIZE * 0.31, 1.5, c.inkDim);

  // small 24h railroad on an inner ring, clear of the applied indices
  ctx.fillStyle = c.inkDim;
  ctx.font = '600 20px "Space Grotesk", "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    ctx.fillText(String(i === 0 ? 24 : i + 12), cx + Math.cos(a) * SIZE * 0.275, cy + Math.sin(a) * SIZE * 0.275);
  }
  for (let i = 0; i < 48; i++) {
    if (i % 4 === 0) continue;
    const a = (i / 48) * Math.PI * 2;
    tickMark(ctx, cx, cy, a, SIZE * 0.305, SIZE * 0.292, 2, c.inkDim);
  }

  // faint engine-turning in the centre
  guillocheRing(ctx, cx, cy, SIZE * 0.22, SIZE * 0.08, c.ink, 48, 2, 0.14);

  wordmark(ctx, c, 'FOCUS · CHRONOMETER');
  ctx.fillStyle = c.inkDim;
  ctx.font = '600 15px "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('300M / 990FT', cx, cy + SIZE * 0.13);
}

const DRAWERS: Record<
  Exclude<TimepieceShape, 'hourglass'>,
  (ctx: CanvasRenderingContext2D, c: DialColors, day: number) => void
> = {
  pocket: drawPocket,
  wrist: drawWrist,
  wall: drawWall,
};

/**
 * Ceramic dive-bezel insert, mapped onto a RingGeometry (planar UVs: the canvas
 * edge is the ring's outer radius). Engraved 60-minute scale with a lumed pip.
 */
export function makeBezelInsertTexture(accent: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const rOut = SIZE / 2;
  const rIn = rOut * 0.849;
  const mid = (rOut + rIn) / 2;

  const g = ctx.createRadialGradient(cx * 0.8, cy * 0.7, 20, cx, cy, rOut);
  g.addColorStop(0, '#26262c');
  g.addColorStop(1, '#101014');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // polished ceramic sheen: faint concentric lines
  ctx.save();
  ctx.globalAlpha = 0.08;
  for (let r = rIn; r < rOut; r += 3) ring(ctx, cx, cy, r, 1, '#ffffff');
  ctx.restore();

  const engraved = '#d9dde4';
  for (let m = 0; m < 60; m++) {
    const a = (m / 60) * Math.PI * 2 - Math.PI / 2;
    if (m === 0) continue;
    if (m % 10 === 0) continue;
    const major = m % 5 === 0;
    const fine = m < 15;
    if (!major && !fine) {
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * mid, cy + Math.sin(a) * mid, 3, 0, Math.PI * 2);
      ctx.fillStyle = engraved;
      ctx.globalAlpha = 0.5;
      ctx.fill();
      ctx.globalAlpha = 1;
      continue;
    }
    tickMark(ctx, cx, cy, a, rOut - 8, major ? rIn + 12 : rIn + 30, major ? 7 : 3, engraved);
  }

  ctx.fillStyle = engraved;
  ctx.font = '700 44px "Space Grotesk", "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let m = 10; m < 60; m += 10) {
    const a = (m / 60) * Math.PI * 2 - Math.PI / 2;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * mid, cy + Math.sin(a) * mid);
    let rot = a + Math.PI / 2;
    if (m > 15 && m < 45) rot += Math.PI; // keep the bottom numbers upright
    ctx.rotate(rot);
    ctx.fillText(String(m), 0, 2);
    ctx.restore();
  }

  // lumed triangle at 12 with a metal surround
  ctx.save();
  ctx.translate(cx, cy - mid);
  ctx.beginPath();
  ctx.moveTo(-24, -20);
  ctx.lineTo(24, -20);
  ctx.lineTo(0, 22);
  ctx.closePath();
  ctx.fillStyle = '#e9eef0';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -4, 7, 0, Math.PI * 2);
  ctx.fillStyle = accent;
  ctx.fill();
  ctx.restore();

  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** `day` is the day of the month shown in the wrist dial's date window. */
export function makeDialTexture(
  shape: TimepieceShape,
  colors: DialColors,
  day = new Date().getDate(),
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  drawBase(ctx, colors);
  if (shape !== 'hourglass') DRAWERS[shape](ctx, colors, day);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export type { DialColors };
