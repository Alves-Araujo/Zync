/**
 * Scalar "knobs" the 3D timepiece reads. Each shape is a preset of knobs; the
 * intro walks a continuous value `f` in [0,3] and we interpolate between the
 * two nearest presets. The app just pins `f` to one shape.
 */
export interface Knobs {
  caseOuter: number;
  caseInner: number;
  caseDepth: number;
  bezelFace: number;
  fluted: number; // coin-edge bezel intensity (0..1)
  metal: number; // 0 = warm gold, 1 = cool steel
  roughness: number;
  dialWatch: number; // weight of a round watch dial (1) — 0 for hourglass
  markerBold: number; // 0 painted indices … 1 chunky applied blocks (dive)
  handScale: number;
  handWidth: number;
  handLume: number; // 0 dark hands … 1 bright lume
  crownScale: number;
  crownAngleDeg: number; // 90 = top (pocket), 0 = 3 o'clock
  bowScale: number; // pocket-watch loop
  lugScale: number; // wrist lugs
  strapScale: number; // wrist strap
  glassDome: number; // crystal curvature
  bulbScale: number; // hourglass glass bulbs
  postScale: number; // hourglass corner rods
  plateScale: number; // hourglass end plates
  sandShow: number;
  tiltXDeg: number;
  scale: number;
}

const POCKET: Knobs = {
  caseOuter: 1.32,
  caseInner: 1.06,
  caseDepth: 0.34,
  bezelFace: 0.12,
  fluted: 0.15,
  metal: 0.08,
  roughness: 0.2,
  dialWatch: 1,
  markerBold: 0.15,
  handScale: 1,
  handWidth: 0.85,
  handLume: 0.15,
  crownScale: 0, // the pocket crown is part of the pendant (bow group)
  crownAngleDeg: 90,
  bowScale: 1,
  lugScale: 0,
  strapScale: 0,
  glassDome: 0.7,
  bulbScale: 0,
  postScale: 0,
  plateScale: 0,
  sandShow: 0,
  tiltXDeg: 5,
  scale: 1,
};

const WRIST: Knobs = {
  caseOuter: 1.24,
  caseInner: 1.02,
  caseDepth: 0.3,
  bezelFace: 0.1,
  fluted: 0.06,
  metal: 1,
  roughness: 0.3,
  dialWatch: 1,
  markerBold: 0.5,
  handScale: 1,
  handWidth: 1,
  handLume: 0.55,
  crownScale: 0.7,
  crownAngleDeg: 0,
  bowScale: 0,
  lugScale: 1,
  strapScale: 1,
  glassDome: 0.35,
  bulbScale: 0,
  postScale: 0,
  plateScale: 0,
  sandShow: 0,
  tiltXDeg: 5,
  scale: 1,
};

const WALL: Knobs = {
  caseOuter: 1.34,
  caseInner: 1.08,
  caseDepth: 0.4,
  bezelFace: 0.18,
  fluted: 1,
  metal: 1,
  roughness: 0.26,
  dialWatch: 1,
  markerBold: 1,
  handScale: 1.05,
  handWidth: 1.5,
  handLume: 1,
  crownScale: 0.55,
  crownAngleDeg: 0,
  bowScale: 0,
  lugScale: 0,
  strapScale: 0,
  glassDome: 0.28,
  bulbScale: 0,
  postScale: 0,
  plateScale: 0,
  sandShow: 0,
  tiltXDeg: 4,
  scale: 1.04,
};

const HOURGLASS: Knobs = {
  caseOuter: 0.9,
  caseInner: 0.2,
  caseDepth: 0.2,
  bezelFace: 0.05,
  fluted: 0.2,
  metal: 0.3,
  roughness: 0.3,
  dialWatch: 0,
  markerBold: 0,
  handScale: 0,
  handWidth: 0,
  handLume: 0,
  crownScale: 0,
  crownAngleDeg: 0,
  bowScale: 0,
  lugScale: 0,
  strapScale: 0,
  glassDome: 0,
  bulbScale: 1,
  postScale: 1,
  plateScale: 1,
  sandShow: 1,
  tiltXDeg: 0,
  scale: 1.02,
};

const PRESETS: Knobs[] = [POCKET, WRIST, WALL, HOURGLASS];

const smoother = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Sample interpolated knobs at continuous position `f` in [0, 3]. */
export function sampleKnobs(f: number): Knobs {
  const clamped = Math.min(PRESETS.length - 1, Math.max(0, f));
  const i = Math.floor(clamped);
  const j = Math.min(PRESETS.length - 1, i + 1);
  const t = smoother(clamped - i);
  const a = PRESETS[i];
  const b = PRESETS[j];
  const out = {} as Knobs;
  for (const k of Object.keys(a) as (keyof Knobs)[]) {
    out[k] = lerp(a[k], b[k], t);
  }
  return out;
}
