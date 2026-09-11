import { useEffect, useState } from 'react';

/**
 * Normalised scroll progress (0 → 1) across the first `rangePx` pixels of
 * vertical scroll. Drives the intro "clock assembling" animation.
 */
export function useScrollProgress(rangePx: number): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const p = Math.min(1, Math.max(0, window.scrollY / rangePx));
      setProgress(p);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [rangePx]);

  return progress;
}
