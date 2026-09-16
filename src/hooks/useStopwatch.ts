import { useCallback, useEffect, useRef, useState } from 'react';

export type StopwatchStatus = 'idle' | 'running' | 'paused';

export interface StopwatchState {
  status: StopwatchStatus;
  elapsedMs: number;
  laps: number[];
}

/** A count-up stopwatch with laps, ticking ten times a second. */
export function useStopwatch(onSecond?: () => void) {
  const [state, setState] = useState<StopwatchState>({ status: 'idle', elapsedMs: 0, laps: [] });
  const startedAt = useRef(0);
  const base = useRef(0);
  const lastSecond = useRef(0);

  const onSecondRef = useRef(onSecond);
  useEffect(() => {
    onSecondRef.current = onSecond;
  }, [onSecond]);

  useEffect(() => {
    if (state.status !== 'running') return;
    const id = window.setInterval(() => {
      const elapsed = base.current + (performance.now() - startedAt.current);
      const whole = Math.floor(elapsed / 1000);
      if (whole > lastSecond.current) {
        lastSecond.current = whole;
        onSecondRef.current?.();
      }
      setState((p) => (p.status === 'running' ? { ...p, elapsedMs: elapsed } : p));
    }, 100);
    return () => window.clearInterval(id);
  }, [state.status]);

  const start = useCallback(() => {
    setState((p) => {
      if (p.status === 'running') return p;
      startedAt.current = performance.now();
      base.current = p.elapsedMs;
      lastSecond.current = Math.floor(p.elapsedMs / 1000);
      return { ...p, status: 'running' };
    });
  }, []);

  const pause = useCallback(() => {
    setState((p) => {
      if (p.status !== 'running') return p;
      const elapsed = base.current + (performance.now() - startedAt.current);
      base.current = elapsed;
      return { ...p, status: 'paused', elapsedMs: elapsed };
    });
  }, []);

  const toggle = useCallback(() => {
    setState((p) => {
      if (p.status === 'running') {
        const elapsed = base.current + (performance.now() - startedAt.current);
        base.current = elapsed;
        return { ...p, status: 'paused', elapsedMs: elapsed };
      }
      startedAt.current = performance.now();
      base.current = p.elapsedMs;
      lastSecond.current = Math.floor(p.elapsedMs / 1000);
      return { ...p, status: 'running' };
    });
  }, []);

  const reset = useCallback(() => {
    base.current = 0;
    lastSecond.current = 0;
    setState({ status: 'idle', elapsedMs: 0, laps: [] });
  }, []);

  const lap = useCallback(() => {
    setState((p) => (p.status === 'idle' ? p : { ...p, laps: [...p.laps, p.elapsedMs] }));
  }, []);

  return { state, start, pause, toggle, reset, lap };
}
