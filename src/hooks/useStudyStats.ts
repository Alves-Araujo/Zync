import { useCallback, useEffect, useRef, useState } from 'react';

export interface StudyStats {
  /** ISO date (YYYY-MM-DD) the daily counters belong to. */
  date: string;
  /** Seconds of focus accumulated today. */
  focusSecondsToday: number;
  /** Full cycles completed today. */
  cyclesToday: number;
  /** All-time best focus seconds in a single day. */
  bestFocusSeconds: number;
  /** All-time cycles completed. */
  totalCycles: number;
  /** Consecutive days with at least one completed cycle. */
  streakDays: number;
  /** Last date a cycle was completed, for streak bookkeeping. */
  lastActiveDate: string;
}

const STORAGE_KEY = 'zync:study-stats:v1';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00');
  const db = new Date(b + 'T00:00:00');
  return Math.round((db.getTime() - da.getTime()) / 86_400_000);
}

function emptyStats(): StudyStats {
  return {
    date: todayISO(),
    focusSecondsToday: 0,
    cyclesToday: 0,
    bestFocusSeconds: 0,
    totalCycles: 0,
    streakDays: 0,
    lastActiveDate: '',
  };
}

function load(): StudyStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStats();
    const parsed = { ...emptyStats(), ...(JSON.parse(raw) as Partial<StudyStats>) };
    if (parsed.date !== todayISO()) {
      // New day: roll the daily counters, keep all-time values.
      parsed.bestFocusSeconds = Math.max(parsed.bestFocusSeconds, parsed.focusSecondsToday);
      parsed.date = todayISO();
      parsed.focusSecondsToday = 0;
      parsed.cyclesToday = 0;
    }
    return parsed;
  } catch {
    return emptyStats();
  }
}

function save(stats: StudyStats) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // storage unavailable — stats stay in memory only
  }
}

export function useStudyStats() {
  const [stats, setStats] = useState<StudyStats>(load);
  const pendingFocus = useRef(0);

  // Persist whenever stats change.
  useEffect(() => {
    save(stats);
  }, [stats]);

  // Batch focus seconds so we only re-render ~once per second worth of ticks.
  const addFocusSecond = useCallback(() => {
    pendingFocus.current += 1;
    setStats((s) => {
      const add = pendingFocus.current;
      pendingFocus.current = 0;
      const focusSecondsToday = s.focusSecondsToday + add;
      return {
        ...s,
        focusSecondsToday,
        bestFocusSeconds: Math.max(s.bestFocusSeconds, focusSecondsToday),
      };
    });
  }, []);

  const addCompletedCycle = useCallback(() => {
    setStats((s) => {
      const today = todayISO();
      let streak = s.streakDays;
      if (s.lastActiveDate !== today) {
        const gap = s.lastActiveDate ? daysBetween(s.lastActiveDate, today) : 1;
        streak = gap === 1 ? s.streakDays + 1 : 1;
      } else if (streak === 0) {
        streak = 1;
      }
      return {
        ...s,
        cyclesToday: s.cyclesToday + 1,
        totalCycles: s.totalCycles + 1,
        streakDays: streak,
        lastActiveDate: today,
      };
    });
  }, []);

  return { stats, addFocusSecond, addCompletedCycle };
}
