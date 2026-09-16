export interface CycleConfig {
  focusMinutes: number;
  breakMinutes: number;
}

export type Phase = 'focus' | 'break';

/** 'alarm' = the phase ended and the alarm is ringing until the user acknowledges it. */
export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished' | 'alarm';

/** What the ringing alarm is about: the phase that just ended and what comes next. */
export interface AlarmTransition {
  from: Phase;
  to: Phase | 'finished';
}

export interface TimerState {
  status: TimerStatus;
  currentCycleIndex: number;
  currentPhase: Phase;
  remainingSeconds: number;
  /** Total length of the phase currently displayed, in seconds. */
  phaseTotalSeconds: number;
  alarm: AlarmTransition | null;
}
