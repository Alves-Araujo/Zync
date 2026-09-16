import { useCallback, useEffect, useRef, useState } from 'react';
import type { CycleConfig, Phase, TimerState } from '../types';

function getPhaseSeconds(cycles: CycleConfig[], cycleIndex: number, phase: Phase): number {
  const c = cycles[cycleIndex];
  if (!c) return 0;
  return (phase === 'focus' ? c.focusMinutes : c.breakMinutes) * 60;
}

const IDLE: TimerState = {
  status: 'idle',
  currentCycleIndex: 0,
  currentPhase: 'focus',
  remainingSeconds: 0,
  phaseTotalSeconds: 0,
  alarm: null,
};

interface TimerHandlers {
  /** Called once for every whole second elapsed inside a focus phase. */
  onFocusSecond?: () => void;
  /** Called when a full cycle (focus + break) completes. */
  onCycleCompleted?: () => void;
}

export function useTimer(cycles: CycleConfig[], handlers: TimerHandlers = {}) {
  const [state, setState] = useState<TimerState>(IDLE);
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

  /** Move on to the break, the next cycle, or the end of the session. */
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
            alarm: null,
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
          alarm: null,
        };
      }
      return {
        ...prev,
        status: 'finished',
        remainingSeconds: 0,
        alarm: null,
      };
    },
    [cycles],
  );

  /** Where the session would go next — used to describe the ringing alarm. */
  const nextStep = useCallback(
    (prev: TimerState): Phase | 'finished' => {
      if (prev.currentPhase === 'focus' && getPhaseSeconds(cycles, prev.currentCycleIndex, 'break') > 0) {
        return 'break';
      }
      return prev.currentCycleIndex + 1 < cycles.length ? 'focus' : 'finished';
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
        if (prev.status !== 'running') return prev;
        if (prev.currentPhase === 'focus') {
          handlersRef.current.onFocusSecond?.();
        }
        if (prev.remainingSeconds <= 1) {
          // stop here and ring: the user decides when the next phase starts
          return {
            ...prev,
            status: 'alarm',
            remainingSeconds: 0,
            alarm: { from: prev.currentPhase, to: nextStep(prev) },
          };
        }
        return { ...prev, remainingSeconds: prev.remainingSeconds - 1 };
      });
    }, 1000);

    return clearTick;
  }, [state.status, clearTick, nextStep]);

  const start = useCallback(() => {
    if (cycles.length === 0) return;
    setState((p) => {
      if (p.status === 'alarm') return p;
      if (p.status === 'idle' || p.status === 'finished') {
        const focusSec = getPhaseSeconds(cycles, 0, 'focus');
        return {
          status: 'running',
          currentCycleIndex: 0,
          currentPhase: 'focus',
          remainingSeconds: focusSec,
          phaseTotalSeconds: focusSec,
          alarm: null,
        };
      }
      return { ...p, status: 'running' };
    });
  }, [cycles]);

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
    setFlash(true);
    window.setTimeout(() => setFlash(false), 1000);
    setState(next.status === 'finished' ? next : { ...next, status: state.status });
  }, [state, advancePhase]);

  /** Stop the alarm and start the phase it announced. */
  const dismissAlarm = useCallback(() => {
    setState((p) => {
      if (p.status !== 'alarm') return p;
      const next = advancePhase(p);
      return next.status === 'finished' ? next : { ...next, status: 'running' };
    });
  }, [advancePhase]);

  const reset = useCallback(() => {
    clearTick();
    setState(IDLE);
  }, [clearTick]);

  return { state, flash, start, pause, toggle, skip, reset, dismissAlarm };
}
