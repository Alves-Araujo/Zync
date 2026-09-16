import { useCallback, useEffect, useRef, useState } from 'react';

export type CountdownStatus = 'idle' | 'running' | 'paused' | 'alarm';

export interface CountdownState {
  status: CountdownStatus;
  totalSeconds: number;
  remainingSeconds: number;
}

const STORAGE_KEY = 'zync:countdown:v1';
const DEFAULT_SECONDS = 10 * 60;

function loadDuration(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const n = raw ? Number(JSON.parse(raw)) : NaN;
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_SECONDS;
  } catch {
    return DEFAULT_SECONDS;
  }
}

/** A plain countdown timer: pick a duration, run it, and get an alarm at zero. */
export function useCountdown(onSecond?: () => void) {
  const [state, setState] = useState<CountdownState>(() => {
    const total = loadDuration();
    return { status: 'idle', totalSeconds: total, remainingSeconds: total };
  });

  const onSecondRef = useRef(onSecond);
  useEffect(() => {
    onSecondRef.current = onSecond;
  }, [onSecond]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.totalSeconds));
    } catch {
      // storage unavailable
    }
  }, [state.totalSeconds]);

  useEffect(() => {
    if (state.status !== 'running') return;
    const id = window.setInterval(() => {
      setState((p) => {
        if (p.status !== 'running') return p;
        onSecondRef.current?.();
        if (p.remainingSeconds <= 1) return { ...p, remainingSeconds: 0, status: 'alarm' };
        return { ...p, remainingSeconds: p.remainingSeconds - 1 };
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [state.status]);

  const setDuration = useCallback((totalSeconds: number) => {
    const total = Math.max(1, Math.round(totalSeconds));
    setState({ status: 'idle', totalSeconds: total, remainingSeconds: total });
  }, []);

  const start = useCallback(() => {
    setState((p) => {
      if (p.status === 'alarm') return p;
      const remaining = p.remainingSeconds > 0 ? p.remainingSeconds : p.totalSeconds;
      return { ...p, status: 'running', remainingSeconds: remaining };
    });
  }, []);

  const pause = useCallback(() => {
    setState((p) => (p.status === 'running' ? { ...p, status: 'paused' } : p));
  }, []);

  const toggle = useCallback(() => {
    setState((p) => {
      if (p.status === 'running') return { ...p, status: 'paused' };
      if (p.status === 'alarm') return p;
      const remaining = p.remainingSeconds > 0 ? p.remainingSeconds : p.totalSeconds;
      return { ...p, status: 'running', remainingSeconds: remaining };
    });
  }, []);

  const reset = useCallback(() => {
    setState((p) => ({ ...p, status: 'idle', remainingSeconds: p.totalSeconds }));
  }, []);

  /** Stop the alarm and get ready to run again. */
  const dismissAlarm = useCallback(() => {
    setState((p) => (p.status === 'alarm' ? { ...p, status: 'idle', remainingSeconds: p.totalSeconds } : p));
  }, []);

  return { state, setDuration, start, pause, toggle, reset, dismissAlarm };
}
