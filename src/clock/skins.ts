export type FaceStyle = 'midnight' | 'porcelain' | 'blueprint' | 'onyx' | 'solar';
export type HandStyle = 'baton' | 'needle' | 'skeleton';
export type TickStyle = 'minimal' | 'dashes' | 'full';
export type StrapStyle = 'none' | 'steel' | 'leather' | 'sport';
export type TimepieceShape = 'pocket' | 'wrist' | 'wall' | 'hourglass';

export interface ClockSkin {
  preset: string;
  shape: TimepieceShape;
  face: FaceStyle;
  accent: string;
  accent2: string;
  hands: HandStyle;
  ticks: TickStyle;
  strap: StrapStyle;
  numerals: boolean;
  glass: boolean;
  /** 3D depth multiplier, 0.5–1.6. */
  depth: number;
}

export const SHAPE_OPTIONS: { value: TimepieceShape; label: string }[] = [
  { value: 'pocket', label: 'Bolso' },
  { value: 'wrist', label: 'Pulso' },
  { value: 'wall', label: 'Parede' },
  { value: 'hourglass', label: 'Ampulheta' },
];

/** Index of a shape along the morph timeline used by the intro (0..3). */
export const SHAPE_INDEX: Record<TimepieceShape, number> = {
  pocket: 0,
  wrist: 1,
  wall: 2,
  hourglass: 3,
};

export interface SkinPreset extends ClockSkin {
  id: string;
  name: string;
}

export const SKIN_PRESETS: SkinPreset[] = [
  {
    id: 'midnight',
    name: 'Meia-noite',
    preset: 'midnight',
    shape: 'wrist',
    face: 'midnight',
    accent: '#7c5cff',
    accent2: '#3ecf8e',
    hands: 'baton',
    ticks: 'dashes',
    strap: 'steel',
    numerals: false,
    glass: true,
    depth: 1,
  },
  {
    id: 'porcelain',
    name: 'Porcelana',
    preset: 'porcelain',
    shape: 'pocket',
    face: 'porcelain',
    accent: '#b8860b',
    accent2: '#2f6fed',
    hands: 'needle',
    ticks: 'full',
    strap: 'leather',
    numerals: true,
    glass: true,
    depth: 0.85,
  },
  {
    id: 'blueprint',
    name: 'Blueprint',
    preset: 'blueprint',
    shape: 'wall',
    face: 'blueprint',
    accent: '#38bdf8',
    accent2: '#a78bfa',
    hands: 'skeleton',
    ticks: 'full',
    strap: 'none',
    numerals: true,
    glass: false,
    depth: 1.2,
  },
  {
    id: 'onyx',
    name: 'Ônix',
    preset: 'onyx',
    shape: 'wrist',
    face: 'onyx',
    accent: '#ededed',
    accent2: '#f59e0b',
    hands: 'baton',
    ticks: 'minimal',
    strap: 'steel',
    numerals: false,
    glass: true,
    depth: 1.15,
  },
  {
    id: 'solar',
    name: 'Solar',
    preset: 'solar',
    shape: 'hourglass',
    face: 'solar',
    accent: '#fb923c',
    accent2: '#f43f5e',
    hands: 'needle',
    ticks: 'dashes',
    strap: 'sport',
    numerals: false,
    glass: true,
    depth: 1,
  },
];

export const DEFAULT_SKIN: ClockSkin = { ...SKIN_PRESETS[0] };

export const ACCENT_SWATCHES = [
  '#7c5cff',
  '#38bdf8',
  '#3ecf8e',
  '#fb923c',
  '#f43f5e',
  '#eab308',
  '#ec4899',
  '#e5e5e5',
];

export const HAND_OPTIONS: { value: HandStyle; label: string }[] = [
  { value: 'baton', label: 'Bastão' },
  { value: 'needle', label: 'Agulha' },
  { value: 'skeleton', label: 'Vazado' },
];

export const TICK_OPTIONS: { value: TickStyle; label: string }[] = [
  { value: 'minimal', label: 'Mínimo' },
  { value: 'dashes', label: 'Traços' },
  { value: 'full', label: 'Completo' },
];

export const STRAP_OPTIONS: { value: StrapStyle; label: string }[] = [
  { value: 'none', label: 'Nenhuma' },
  { value: 'steel', label: 'Aço' },
  { value: 'leather', label: 'Couro' },
  { value: 'sport', label: 'Esporte' },
];

export function hexToRgb(hex: string): string {
  const m = hex.replace('#', '');
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const int = parseInt(full, 16);
  if (Number.isNaN(int)) return '124, 92, 255';
  return `${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}`;
}

/** Returns a legible foreground (#0b0b10 or #ffffff) for text on `hex`. */
export function readableOn(hex: string): string {
  const [r, g, b] = hexToRgb(hex).split(',').map((n) => parseInt(n, 10) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance > 0.45 ? '#0b0b10' : '#ffffff';
}
