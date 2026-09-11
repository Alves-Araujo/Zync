import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_SKIN, SKIN_PRESETS, type ClockSkin } from '../clock/skins';

const STORAGE_KEY = 'zync:clock-skin:v1';

function load(): ClockSkin {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SKIN;
    return { ...DEFAULT_SKIN, ...(JSON.parse(raw) as Partial<ClockSkin>) };
  } catch {
    return DEFAULT_SKIN;
  }
}

export function useClockSkin() {
  const [skin, setSkin] = useState<ClockSkin>(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(skin));
    } catch {
      // storage unavailable
    }
  }, [skin]);

  const patch = useCallback((changes: Partial<ClockSkin>) => {
    setSkin((s) => ({ ...s, ...changes, preset: 'custom' }));
  }, []);

  const applyPreset = useCallback((id: string) => {
    const p = SKIN_PRESETS.find((x) => x.id === id);
    if (p) {
      const { id: _id, name: _name, ...skinFields } = p;
      void _id;
      void _name;
      setSkin({ ...skinFields });
    }
  }, []);

  return { skin, patch, applyPreset };
}
