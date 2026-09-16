import { useCallback, useEffect, useState } from 'react';

/** Background effects the user can switch off one by one (helps on slower machines). */
export interface VisualPrefs {
  /** The clockwork gears and astrolabe behind everything. */
  gears: boolean;
  /** The scenery that follows the active background sound (rain, waves, fire…). */
  scenery: boolean;
  /** Coloured glows, grid and vignette. */
  glow: boolean;
  /** Floating particles. */
  particles: boolean;
  /** The 3D timepiece itself. */
  clock3d: boolean;
}

const STORAGE_KEY = 'zync:visuals:v1';

export const VISUAL_DEFAULTS: VisualPrefs = {
  gears: true,
  scenery: true,
  glow: true,
  particles: true,
  clock3d: true,
};

export const VISUAL_OPTIONS: { key: keyof VisualPrefs; label: string }[] = [
  { key: 'clock3d', label: 'Relógio 3D' },
  { key: 'gears', label: 'Engrenagens no fundo' },
  { key: 'scenery', label: 'Cenário do som' },
  { key: 'particles', label: 'Partículas' },
  { key: 'glow', label: 'Brilhos e grade' },
];

function load(): VisualPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return VISUAL_DEFAULTS;
    return { ...VISUAL_DEFAULTS, ...(JSON.parse(raw) as Partial<VisualPrefs>) };
  } catch {
    return VISUAL_DEFAULTS;
  }
}

export function useVisualPrefs() {
  const [visuals, setVisuals] = useState<VisualPrefs>(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(visuals));
    } catch {
      // storage unavailable
    }
  }, [visuals]);

  const setVisual = useCallback((key: keyof VisualPrefs, value: boolean) => {
    setVisuals((v) => ({ ...v, [key]: value }));
  }, []);

  /** Turn every effect off (or back on) at once — the "modo leve" shortcut. */
  const setAllVisuals = useCallback((value: boolean) => {
    setVisuals({ gears: value, scenery: value, glow: value, particles: value, clock3d: value });
  }, []);

  return { visuals, setVisual, setAllVisuals };
}
