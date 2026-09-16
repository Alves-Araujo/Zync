export type NoiseKind = 'white' | 'pink' | 'brown' | 'grey' | 'fan' | 'binaural' | 'airplane' | 'train';
/** Brainwave ranges used by binaural beats (the beat is the difference between both ears). */
export type BinauralBand = 'delta' | 'theta' | 'alpha' | 'beta' | 'gamma';
export type NatureKind =
  | 'rain'
  | 'ocean'
  | 'forest'
  | 'fire'
  | 'stream'
  | 'waterfall'
  | 'night'
  | 'wind';
export type SoundCategory = 'noise' | 'nature';
/** Visual theme that follows the active sound. Rain with thunder gets its own storm look. */
export type SceneId = NoiseKind | NatureKind | 'storm';

export interface SoundOption<T extends string> {
  id: T;
  name: string;
  description: string;
  tags: string[];
}

export const NOISE_OPTIONS: SoundOption<NoiseKind>[] = [
  {
    id: 'white',
    name: 'Ruído branco',
    description: 'Chiado uniforme em todas as frequências. Abafa conversas e barulhos do ambiente.',
    tags: ['Mascarar barulho', 'Escritório'],
  },
  {
    id: 'pink',
    name: 'Ruído rosa',
    description: 'Mais suave que o branco, com graves equilibrados. Confortável por horas.',
    tags: ['Leitura', 'Estudo longo'],
  },
  {
    id: 'brown',
    name: 'Ruído marrom',
    description: 'Grave e profundo, lembra uma cachoeira ou um trovão bem distante.',
    tags: ['Foco profundo', 'Relaxar'],
  },
  {
    id: 'grey',
    name: 'Ruído cinza',
    description: 'Ajustado à audição humana: soa por igual em todas as faixas, sem agudos cansativos.',
    tags: ['Equilibrado', 'Ouvidos sensíveis'],
  },
  {
    id: 'fan',
    name: 'Ventilador',
    description: 'Fluxo de ar constante com o leve zumbido do motor.',
    tags: ['Aconchego', 'Dormir'],
  },
  {
    id: 'binaural',
    name: 'Ondas binaurais',
    description: 'Dois tons quase iguais, um em cada ouvido. O cérebro ouve a diferença como uma pulsação.',
    tags: ['Só com fones', 'Foco profundo'],
  },
  {
    id: 'airplane',
    name: 'Cabine de avião',
    description: 'O ronco grave e contínuo das turbinas em pleno voo.',
    tags: ['Viagem', 'Grave constante'],
  },
  {
    id: 'train',
    name: 'Trem noturno',
    description: 'Trilhos ritmados e o balanço suave de um vagão à noite.',
    tags: ['Ritmo', 'Viagem'],
  },
];

export const NATURE_OPTIONS: SoundOption<NatureKind>[] = [
  {
    id: 'rain',
    name: 'Chuva',
    description: 'Da garoa à tempestade, com trovões opcionais e intensidade ajustável.',
    tags: ['Intensidade', 'Trovões'],
  },
  {
    id: 'ocean',
    name: 'Mar',
    description: 'Ondas quebrando na areia em um ritmo lento e natural.',
    tags: ['Calma', 'Respiração'],
  },
  {
    id: 'forest',
    name: 'Floresta',
    description: 'Vento nas árvores, folhas balançando e pássaros ao longe.',
    tags: ['Natureza', 'Criatividade'],
  },
  {
    id: 'fire',
    name: 'Lareira',
    description: 'Lenha estalando e o crepitar quente do fogo.',
    tags: ['Aconchego', 'Noite'],
  },
  {
    id: 'stream',
    name: 'Riacho',
    description: 'Água corrente entre as pedras, com borbulhas suaves e constantes.',
    tags: ['Fluidez', 'Leitura'],
  },
  {
    id: 'waterfall',
    name: 'Cachoeira',
    description: 'Queda d’água poderosa e contínua, com névoa e respingos.',
    tags: ['Imersão', 'Mascarar barulho'],
  },
  {
    id: 'night',
    name: 'Noite de verão',
    description: 'Grilos cantando, sapos ao longe e o ar calmo da noite.',
    tags: ['Noite', 'Dormir'],
  },
  {
    id: 'wind',
    name: 'Vento',
    description: 'Rajadas nas montanhas, assobiando entre as rochas.',
    tags: ['Montanha', 'Contemplação'],
  },
];

export const SCENE_THEME: Record<SceneId, { accent: string; tint: string }> = {
  white: { accent: '#dbe3ee', tint: '203, 213, 225' },
  pink: { accent: '#f472b6', tint: '236, 72, 153' },
  brown: { accent: '#d4a373', tint: '166, 108, 60' },
  grey: { accent: '#b4b8c0', tint: '161, 165, 175' },
  fan: { accent: '#7dd3fc', tint: '56, 150, 200' },
  binaural: { accent: '#818cf8', tint: '99, 102, 241' },
  airplane: { accent: '#bae6fd', tint: '125, 200, 252' },
  train: { accent: '#c4b5fd', tint: '139, 92, 246' },
  rain: { accent: '#60a5fa', tint: '37, 99, 235' },
  storm: { accent: '#a5b4fc', tint: '67, 56, 202' },
  ocean: { accent: '#2dd4bf', tint: '13, 148, 136' },
  forest: { accent: '#4ade80', tint: '22, 163, 74' },
  fire: { accent: '#fb923c', tint: '234, 88, 12' },
  stream: { accent: '#34d399', tint: '16, 185, 129' },
  waterfall: { accent: '#38bdf8', tint: '14, 165, 233' },
  night: { accent: '#fde047', tint: '202, 138, 4' },
  wind: { accent: '#a5f3fc', tint: '103, 200, 230' },
};

/** Beat frequency (Hz) of each band, and what it is usually used for. */
export const BINAURAL_BANDS: { value: BinauralBand; label: string; beat: number; use: string }[] = [
  { value: 'delta', label: 'Delta', beat: 2.5, use: 'sono profundo' },
  { value: 'theta', label: 'Theta', beat: 6, use: 'meditação' },
  { value: 'alpha', label: 'Alpha', beat: 10, use: 'relaxar acordado' },
  { value: 'beta', label: 'Beta', beat: 18, use: 'foco e estudo' },
  { value: 'gamma', label: 'Gamma', beat: 40, use: 'alerta máximo' },
];

export const BINAURAL_BEAT: Record<BinauralBand, number> = {
  delta: 2.5,
  theta: 6,
  alpha: 10,
  beta: 18,
  gamma: 40,
};

/** Carrier tone the slider picks, in Hz. */
export function binauralCarrier(tone: number): number {
  return Math.round(80 + Math.min(1, Math.max(0, tone)) * 240);
}

export function rainLabel(intensity: number): string {
  if (intensity < 0.25) return 'Garoa';
  if (intensity < 0.5) return 'Chuva leve';
  if (intensity < 0.78) return 'Chuva forte';
  return 'Tempestade';
}

/** The theme follows the most recently chosen sound; if that one is off, the other active sound. */
export function activeScene(s: {
  playing: boolean;
  syncTheme: boolean;
  focus: SoundCategory;
  noise: NoiseKind | null;
  nature: NatureKind | null;
  thunder: boolean;
}): SceneId | null {
  if (!s.playing || !s.syncTheme) return null;
  const natureScene: SceneId | null = s.nature
    ? s.nature === 'rain' && s.thunder
      ? 'storm'
      : s.nature
    : null;
  if (s.focus === 'noise') return s.noise ?? natureScene;
  return natureScene ?? s.noise;
}
