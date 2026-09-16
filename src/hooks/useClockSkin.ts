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
    // the shape is independent of the style, so changing it keeps the active preset
    const keepsPreset = Object.keys(changes).every((k) => k === 'shape');
    setSkin((s) => ({ ...s, ...changes, preset: keepsPreset ? s.preset : 'custom' }));
  }, []);

  const applyPreset = useCallback((id: string) => {
    const p = SKIN_PRESETS.find((x) => x.id === id);
    if (p) {
      const { id: _id, name: _name, ...skinFields } = p;
      void _id;
      void _name;
      // a style restyles the current timepiece — it never swaps its shape
      setSkin((s) => ({ ...skinFields, shape: s.shape }));
    }
  }, []);

  return { skin, patch, applyPreset };
}
