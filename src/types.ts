export interface CycleConfig {
  focusMinutes: number;
  breakMinutes: number;
}

export type Phase = 'focus' | 'break';

export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished';

export interface TimerState {
  status: TimerStatus;
  currentCycleIndex: number;
  currentPhase: Phase;
  remainingSeconds: number;
  /** Total length of the phase currently displayed, in seconds. */
  phaseTotalSeconds: number;
}
