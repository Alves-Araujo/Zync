import { useCallback, useEffect, useRef, useState } from 'react';
import type { CycleConfig, Phase, TimerState } from '../types';

const ALERT_FREQUENCY = 660;
const ALERT_DURATION = 0.18;

function playAlert(pattern: number[] = [0, 0.25, 0.5]) {
  try {
    const ctx = new AudioContext();
    pattern.forEach((offset, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = ALERT_FREQUENCY + i * 120;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + ALERT_DURATION);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + ALERT_DURATION + 0.05);
    });
  } catch {
    // audio not available
  }
}

function getPhaseSeconds(cycles: CycleConfig[], cycleIndex: number, phase: Phase): number {
  const c = cycles[cycleIndex];
  if (!c) return 0;
  return (phase === 'focus' ? c.focusMinutes : c.breakMinutes) * 60;
}

interface TimerHandlers {
  /** Called once for every whole second elapsed inside a focus phase. */
  onFocusSecond?: () => void;
  /** Called when a full cycle (focus + break) completes. */
  onCycleCompleted?: () => void;
}

export function useTimer(cycles: CycleConfig[], handlers: TimerHandlers = {}) {
  const [state, setState] = useState<TimerState>({
    status: 'idle',
    currentCycleIndex: 0,
    currentPhase: 'focus',
    remainingSeconds: 0,
    phaseTotalSeconds: 0,
  });

  const [flash, setFlash] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  const clearTick = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const triggerAlert = useCallback((pattern?: number[]) => {
    playAlert(pattern);
    setFlash(true);
    setTimeout(() => setFlash(false), 1200);
  }, []);

  const advancePhase = useCallback(
    (prev: TimerState): TimerState => {
      if (prev.currentPhase === 'focus') {
        const breakSec = getPhaseSeconds(cycles, prev.currentCycleIndex, 'break');
        if (breakSec > 0) {
          return {
            ...prev,
            currentPhase: 'break',
            remainingSeconds: breakSec,
            phaseTotalSeconds: breakSec,
          };
        }
      }
      handlersRef.current.onCycleCompleted?.();
      const nextIndex = prev.currentCycleIndex + 1;
      if (nextIndex < cycles.length) {
        const focusSec = getPhaseSeconds(cycles, nextIndex, 'focus');
        return {
          ...prev,
          currentCycleIndex: nextIndex,
          currentPhase: 'focus',
          remainingSeconds: focusSec,
          phaseTotalSeconds: focusSec,
        };
      }
      return {
        status: 'finished',
        currentCycleIndex: prev.currentCycleIndex,
        currentPhase: prev.currentPhase,
        remainingSeconds: 0,
        phaseTotalSeconds: prev.phaseTotalSeconds,
      };
    },
    [cycles],
  );

  useEffect(() => {
    if (state.status !== 'running') {
      clearTick();
      return;
    }

    intervalRef.current = window.setInterval(() => {
      setState((prev) => {
        if (prev.currentPhase === 'focus') {
          handlersRef.current.onFocusSecond?.();
        }
        if (prev.remainingSeconds <= 1) {
          const next = advancePhase(prev);
          triggerAlert(next.status === 'finished' ? [0, 0.18, 0.36, 0.54] : undefined);
          if (next.status === 'finished') {
            clearTick();
          }
          return next;
        }
        return { ...prev, remainingSeconds: prev.remainingSeconds - 1 };
      });
    }, 1000);

    return clearTick;
  }, [state.status, advancePhase, clearTick, triggerAlert]);

  const start = useCallback(() => {
    if (cycles.length === 0) return;
    if (state.status === 'idle' || state.status === 'finished') {
      const focusSec = getPhaseSeconds(cycles, 0, 'focus');
      setState({
        status: 'running',
        currentCycleIndex: 0,
        currentPhase: 'focus',
        remainingSeconds: focusSec,
        phaseTotalSeconds: focusSec,
      });
    } else if (state.status === 'paused') {
      setState((p) => ({ ...p, status: 'running' }));
    }
  }, [cycles, state.status]);

  const pause = useCallback(() => {
    setState((p) => (p.status === 'running' ? { ...p, status: 'paused' } : p));
  }, []);

  const toggle = useCallback(() => {
    if (state.status === 'running') pause();
    else start();
  }, [state.status, pause, start]);

  const skip = useCallback(() => {
    if (state.status !== 'running' && state.status !== 'paused') return;
    const next = advancePhase(state);
    triggerAlert();
    setState(next.status === 'finished' ? next : { ...next, status: state.status });
  }, [state, advancePhase, triggerAlert]);

  const reset = useCallback(() => {
    clearTick();
    setState({
      status: 'idle',
      currentCycleIndex: 0,
      currentPhase: 'focus',
      remainingSeconds: 0,
      phaseTotalSeconds: 0,
    });
  }, [clearTick]);

  return { state, flash, start, pause, toggle, skip, reset };
}
