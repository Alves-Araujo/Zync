import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import type { CycleConfig } from './types';
import { useTimer } from './hooks/useTimer';
import { useStudyStats } from './hooks/useStudyStats';
import { useClockSkin } from './hooks/useClockSkin';
import { useScrollProgress } from './hooks/useScrollProgress';
import { hexToRgb, readableOn } from './clock/skins';
import Controls from './components/Controls';
import ClockStudio from './components/ClockStudio';
import SessionBuilder from './components/SessionBuilder';
import StatsBar from './components/StatsBar';
import AmbientBackground from './components/AmbientBackground';
import Hero from './components/Hero';
import MiniClock from './components/MiniClock';

const TimepieceCanvas = lazy(() => import('./three/TimepieceCanvas'));

const INTRO_RANGE = 3600;

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function App() {
  const [numCycles, setNumCycles] = useState(4);
  const [cycles, setCycles] = useState<CycleConfig[]>([]);

  const { skin, patch, applyPreset } = useClockSkin();
  const { stats, addFocusSecond, addCompletedCycle } = useStudyStats();
  const introProgress = useScrollProgress(INTRO_RANGE);

  const handlers = useMemo(
    () => ({ onFocusSecond: addFocusSecond, onCycleCompleted: addCompletedCycle }),
    [addFocusSecond, addCompletedCycle],
  );
  const { state, flash, start, pause, toggle, skip, reset } = useTimer(cycles, handlers);

  const timerActive = state.status === 'running' || state.status === 'paused';

  // Publish skin + phase colours as CSS custom properties for the whole page.
  useEffect(() => {
    const root = document.documentElement;
    const phaseColor = state.currentPhase === 'focus' ? skin.accent : skin.accent2;
    root.style.setProperty('--accent', skin.accent);
    root.style.setProperty('--accent-rgb', hexToRgb(skin.accent));
    root.style.setProperty('--accent2', skin.accent2);
    root.style.setProperty('--on-accent', readableOn(skin.accent));
    root.style.setProperty('--phase', phaseColor);
    root.style.setProperty('--phase-rgb', hexToRgb(phaseColor));
  }, [skin.accent, skin.accent2, state.currentPhase]);

  const generateCycles = () => {
    setCycles(
      Array.from({ length: Math.max(1, numCycles) }, () => ({
        focusMinutes: 25,
        breakMinutes: 5,
      })),
    );
    reset();
  };

  const scrollToApp = () => {
    document.getElementById('app')?.scrollIntoView({ behavior: 'smooth' });
  };

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'BUTTON' || el.tagName === 'TEXTAREA')) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        if (cycles.length > 0) toggle();
      } else if (e.key.toLowerCase() === 's' && timerActive) {
        skip();
      } else if (e.key.toLowerCase() === 'r' && state.status !== 'idle') {
        reset();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cycles.length, timerActive, state.status, toggle, skip, reset]);

  // Live countdown in the browser tab.
  useEffect(() => {
    if (state.status === 'running' || state.status === 'paused') {
      const m = Math.floor(state.remainingSeconds / 60);
      const s = state.remainingSeconds % 60;
      const label = state.currentPhase === 'focus' ? 'Foco' : 'Pausa';
      document.title = `${pad(m)}:${pad(s)} · ${label} — Zync`;
    } else {
      document.title = 'Zync — Pomodoro & Study Timer';
    }
  }, [state.status, state.remainingSeconds, state.currentPhase]);

  const idlePreview = state.status === 'idle' && cycles.length > 0;
  const clockRemaining = idlePreview ? cycles[0].focusMinutes * 60 : state.remainingSeconds;
  const clockTotal = idlePreview ? cycles[0].focusMinutes * 60 : state.phaseTotalSeconds;

  const statusText = (() => {
    switch (state.status) {
      case 'idle':
        return 'Configure sua sessão e toque em iniciar';
      case 'finished':
        return 'Todos os ciclos concluídos — mandou bem!';
      case 'paused':
        return `Pausado · Ciclo ${state.currentCycleIndex + 1}/${cycles.length}`;
      default:
        return `Ciclo ${state.currentCycleIndex + 1}/${cycles.length} · ${
          state.currentPhase === 'focus' ? 'Foco' : 'Pausa'
        }`;
    }
  })();

  return (
    <>
      <AmbientBackground
        phase={state.currentPhase}
        status={state.status}
        particles={skin.particles}
      />

      <Hero skin={skin} progress={introProgress} onEnter={scrollToApp} />
      <div className="intro-spacer" aria-hidden="true" />

      <main id="app" className="app-shell">
        <header className="shell-header">
          <a className="wordmark" href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
            <MiniClock accent={skin.accent} size={22} />
            Zync
          </a>
          <p className="shell-tagline">Pomodoro &amp; study timer</p>
        </header>

        <div className="shell-grid">
          <ClockStudio skin={skin} onPatch={patch} onPreset={applyPreset} />

          <section className={`stage${flash ? ' flash' : ''}`}>
            <div className="stage-canvas">
              <Suspense fallback={null}>
                <TimepieceCanvas
                  skin={skin}
                  mode="app"
                  remainingSeconds={clockRemaining}
                  phaseTotalSeconds={clockTotal}
                  running={state.status === 'running'}
                />
              </Suspense>
            </div>

            <p className="timer-status">{statusText}</p>

            {state.status !== 'idle' && cycles.length > 1 && (
              <div className="progress-bar">
                {cycles.map((_, i) => (
                  <span
                    key={i}
                    className={
                      'progress-dot' +
                      (i < state.currentCycleIndex || state.status === 'finished' ? ' done' : '') +
                      (i === state.currentCycleIndex && state.status !== 'finished' ? ' active' : '')
                    }
                  />
                ))}
              </div>
            )}

            <Controls
              status={state.status}
              hasCycles={cycles.length > 0}
              onStart={start}
              onPause={pause}
              onSkip={skip}
              onReset={reset}
            />

            <p className="kbd-legend">
              <kbd>espaço</kbd> play/pause · <kbd>S</kbd> pular · <kbd>R</kbd> reiniciar
            </p>
          </section>

          <div className="shell-side">
            <SessionBuilder
              numCycles={numCycles}
              onNumCyclesChange={setNumCycles}
              cycles={cycles}
              onCyclesChange={setCycles}
              onGenerate={generateCycles}
              disabled={timerActive}
            />
            <StatsBar stats={stats} />
          </div>
        </div>

        <footer className="shell-footer">
          Feito para quem leva o foco a sério.
        </footer>
      </main>
    </>
  );
}

export default App;
