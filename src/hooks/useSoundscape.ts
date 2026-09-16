import { useCallback, useEffect, useState } from 'react';
import { soundscape, type SoundState } from '../audio/soundscape';
import { activeScene, type NatureKind, type NoiseKind, type SoundCategory } from '../audio/scenes';

export interface SoundSettings extends SoundState {
  /** Let the active sound restyle the site (accent colour + animated scenery). */
  syncTheme: boolean;
  /** Category of the most recently chosen sound — its theme wins when both are playing. */
  focus: SoundCategory;
}

export interface ThunderFlash {
  id: number;
  strength: number;
}

const STORAGE_KEY = 'zync:soundscape:v1';

export const SOUND_DEFAULTS: SoundSettings = {
  playing: false,
  noise: null,
  nature: null,
  volume: 0.7,
  noiseVolume: 0.6,
  natureVolume: 0.8,
  rainIntensity: 0.55,
  thunder: false,
  noiseTone: 0.5,
  natureTone: 0.5,
  syncTheme: true,
  focus: 'noise',
};

/** Settings that each tab's "Restaurar padrão" button puts back to their defaults. */
export const CONTROL_KEYS: Record<SoundCategory, (keyof SoundSettings)[]> = {
  noise: ['noiseVolume', 'noiseTone'],
  nature: ['natureVolume', 'natureTone', 'rainIntensity', 'thunder'],
};

function load(): SoundSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return SOUND_DEFAULTS;
    // browsers only allow audio after a gesture, so a reload always starts paused
    return { ...SOUND_DEFAULTS, ...(JSON.parse(raw) as Partial<SoundSettings>), playing: false };
  } catch {
    return SOUND_DEFAULTS;
  }
}

export function useSoundscape() {
  const [settings, setSettings] = useState<SoundSettings>(load);
  const [flash, setFlash] = useState<ThunderFlash | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...settings, playing: false }));
    } catch {
      // storage unavailable
    }
  }, [settings]);

  useEffect(() => {
    soundscape.sync(settings);
  }, [settings]);

  useEffect(
    () => soundscape.onThunder((strength) => setFlash((f) => ({ id: (f?.id ?? 0) + 1, strength }))),
    [],
  );

  const update = useCallback((changes: Partial<SoundSettings>) => {
    setSettings((s) => ({ ...s, ...changes }));
  }, []);

  /** Picking a sound starts it and makes its theme the active one; picking it again turns it off. */
  const selectNoise = useCallback((kind: NoiseKind) => {
    setSettings((s) => {
      const noise = s.noise === kind ? null : kind;
      return {
        ...s,
        noise,
        focus: noise ? 'noise' : 'nature',
        playing: noise ? true : s.nature ? s.playing : false,
      };
    });
  }, []);

  const selectNature = useCallback((kind: NatureKind) => {
    setSettings((s) => {
      const nature = s.nature === kind ? null : kind;
      return {
        ...s,
        nature,
        focus: nature ? 'nature' : 'noise',
        playing: nature ? true : s.noise ? s.playing : false,
      };
    });
  }, []);

  const resetControls = useCallback((category: SoundCategory) => {
    setSettings((s) => {
      const next = { ...s };
      for (const key of CONTROL_KEYS[category]) {
        (next as Record<string, unknown>)[key] = SOUND_DEFAULTS[key];
      }
      return next;
    });
  }, []);

  const togglePlaying = useCallback(() => {
    setSettings((s) => (s.noise || s.nature ? { ...s, playing: !s.playing } : s));
  }, []);

  return {
    settings,
    update,
    selectNoise,
    selectNature,
    togglePlaying,
    resetControls,
    flash,
    scene: activeScene(settings),
  };
}
