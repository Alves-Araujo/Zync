import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type { CycleConfig } from './types';
import { useTimer } from './hooks/useTimer';
import { useCountdown } from './hooks/useCountdown';
import { useStopwatch } from './hooks/useStopwatch';
import { useStudyStats } from './hooks/useStudyStats';
import { useClockSkin } from './hooks/useClockSkin';
import { useVisualPrefs } from './hooks/useVisualPrefs';
import { useSoundscape } from './hooks/useSoundscape';
import { soundscape } from './audio/soundscape';
import { SCENE_THEME } from './audio/scenes';
import { hexToRgb, readableOn } from './clock/skins';
import Controls from './components/Controls';
import ClockStudio from './components/ClockStudio';
import SegmentedControl from './components/SegmentedControl';
import SessionBuilder from './components/SessionBuilder';
import TimerSetup from './components/TimerSetup';
import LapList from './components/LapList';
import StatsBar from './components/StatsBar';
import AmbientBackground from './components/AmbientBackground';
import AlarmOverlay, { type AlarmInfo, type AlarmTone } from './components/AlarmOverlay';
import MiniClock from './components/MiniClock';
import SoundSection from './components/SoundSection';

const TimepieceCanvas = lazy(() => import('./three/TimepieceCanvas'));

type Mode = 'pomodoro' | 'timer' | 'stopwatch';

const MODE_OPTIONS: { value: Mode; label: string }[] = [
  { value: 'pomodoro', label: 'Pomodoro' },
  { value: 'timer', label: 'Temporizador' },
  { value: 'stopwatch', label: 'Cronômetro' },
];

const MODE_KEY = 'zync:mode:v1';

/** The site turns these colours while the alarm rings. */
const ALARM_COLOR: Record<AlarmTone, string> = {
  rest: '#ff5c6b',
  focus: '#3ecf8e',
  done: '#f5b301',
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function clock(totalSeconds: number) {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h > 0 ? `${h}:` : ''}${pad(m)}:${pad(s % 60)}`;
}

function loadMode(): Mode {
  try {
    const raw = localStorage.getItem(MODE_KEY);
    return raw === 'timer' || raw === 'stopwatch' ? raw : 'pomodoro';
  } catch {
    return 'pomodoro';
  }
}

function App() {
  const [mode, setMode] = useState<Mode>(loadMode);
  const [numCycles, setNumCycles] = useState(4);
  const [cycles, setCycles] = useState<CycleConfig[]>([]);

  const { skin, patch, applyPreset } = useClockSkin();
  const { visuals, setVisual, setAllVisuals } = useVisualPrefs();
  const { stats, addFocusSecond, addCompletedCycle } = useStudyStats();
  const sound = useSoundscape();
  const { togglePlaying: toggleSound } = sound;

  useEffect(() => {
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch {
      // storage unavailable
    }
  }, [mode]);

  const handlers = useMemo(
    () => ({ onFocusSecond: addFocusSecond, onCycleCompleted: addCompletedCycle }),
    [addFocusSecond, addCompletedCycle],
  );
  const pomodoro = useTimer(cycles, handlers);
  const countdown = useCountdown(addFocusSecond);
  const stopwatch = useStopwatch(addFocusSecond);

  const { state } = pomodoro;
  const timerActive = state.status === 'running' || state.status === 'paused';

  // ---- what is ringing right now ------------------------------------------------
  const alarm: AlarmInfo | null = useMemo(() => {
    if (mode === 'pomodoro' && state.alarm) {
      if (state.alarm.to === 'finished') {
        return {
          tone: 'done',
          title: 'Sessão concluída',
          message: 'Você fechou todos os ciclos. Mandou bem!',
          action: 'Concluir',
        };
      }
      if (state.alarm.from === 'focus') {
        return {
          tone: 'rest',
          title: 'Fim do foco',
          message: 'Hora da pausa: levante, beba água e descanse os olhos.',
          action: 'Começar pausa',
        };
      }
      return {
        tone: 'focus',
        title: 'Fim da pausa',
        message: 'A pausa acabou. Bora voltar para o foco.',
        action: 'Voltar ao foco',
      };
    }
    if (mode === 'timer' && countdown.state.status === 'alarm') {
      return {
        tone: 'done',
        title: 'Tempo esgotado',
        message: 'O temporizador chegou ao fim.',
        action: 'Parar alarme',
      };
    }
    return null;
  }, [mode, state.alarm, countdown.state.status]);

  // remembers which alarm the user silenced, so a new one rings again
  const [silenced, setSilenced] = useState('');
  const alarmKey = alarm ? `${alarm.tone}:${alarm.title}` : '';
  const alarmMuted = Boolean(alarmKey) && silenced === alarmKey;

  useEffect(() => {
    if (!alarmKey) {
      soundscape.stopAlarm();
      return;
    }
    const tone = alarmKey.split(':')[0] as AlarmTone;
    soundscape.startAlarm(tone);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return () => soundscape.stopAlarm();
  }, [alarmKey]);

  const silenceAlarm = useCallback(() => {
    soundscape.stopAlarm();
    setSilenced(alarmKey);
  }, [alarmKey]);

  const dismissAlarm = useCallback(() => {
    soundscape.stopAlarm();
    if (mode === 'pomodoro') pomodoro.dismissAlarm();
    else countdown.dismissAlarm();
  }, [mode, pomodoro, countdown]);

  // ---- colours -------------------------------------------------------------------
  const sceneAccent = sound.scene ? SCENE_THEME[sound.scene].accent : skin.accent;
  const accent = alarm ? ALARM_COLOR[alarm.tone] : sceneAccent;
  const viewSkin = useMemo(
    () => (accent === skin.accent ? skin : { ...skin, accent }),
    [skin, accent],
  );

  useEffect(() => {
    const root = document.documentElement;
    const phaseColor = alarm
      ? accent
      : mode === 'pomodoro' && state.currentPhase === 'break'
        ? skin.accent2
        : accent;
    root.style.setProperty('--accent', accent);
    root.style.setProperty('--accent-rgb', hexToRgb(accent));
    root.style.setProperty('--accent2', skin.accent2);
    root.style.setProperty('--on-accent', readableOn(accent));
    root.style.setProperty('--phase', phaseColor);
    root.style.setProperty('--phase-rgb', hexToRgb(phaseColor));
    root.classList.toggle('is-alarm', Boolean(alarm));
  }, [accent, skin.accent2, state.currentPhase, mode, alarm]);

  const generateCycles = () => {
    setCycles(
      Array.from({ length: Math.max(1, numCycles) }, () => ({
        focusMinutes: 25,
        breakMinutes: 5,
      })),
    );
    pomodoro.reset();
  };

  // ---- per-mode view -------------------------------------------------------------
  const idlePreview = state.status === 'idle' && cycles.length > 0;
  const view = (() => {
    if (mode === 'timer') {
      const c = countdown.state;
      return {
        status: c.status,
        canStart: c.totalSeconds > 0,
        remaining: c.remainingSeconds,
        total: c.totalSeconds,
        running: c.status === 'running',
        countUp: false,
        readout: clock(c.remainingSeconds),
        start: countdown.start,
        pause: countdown.pause,
        toggle: countdown.toggle,
        reset: countdown.reset,
        skip: undefined,
        resetLabel: 'Zerar',
        text:
          c.status === 'alarm'
            ? 'Tempo esgotado'
            : c.status === 'running'
              ? 'Contando o tempo'
              : c.status === 'paused'
                ? 'Pausado'
                : 'Escolha um tempo e toque em iniciar',
      };
    }
    if (mode === 'stopwatch') {
      const w = stopwatch.state;
      const tenths = Math.floor(w.elapsedMs / 100) % 10;
      return {
        status: w.status,
        canStart: true,
        remaining: w.elapsedMs / 1000,
        total: 3600,
        running: w.status === 'running',
        countUp: true,
        readout: `${clock(w.elapsedMs / 1000)}.${tenths}`,
        start: stopwatch.start,
        pause: stopwatch.pause,
        toggle: stopwatch.toggle,
        reset: stopwatch.reset,
        skip: undefined,
        resetLabel: 'Zerar',
        text:
          w.status === 'running'
            ? 'Contando para cima'
            : w.status === 'paused'
              ? 'Pausado'
              : 'Toque em iniciar para contar o tempo',
      };
    }
    return {
      status: state.status,
      canStart: cycles.length > 0,
      remaining: idlePreview ? cycles[0].focusMinutes * 60 : state.remainingSeconds,
      total: idlePreview ? cycles[0].focusMinutes * 60 : state.phaseTotalSeconds,
      running: state.status === 'running',
      countUp: false,
      readout: clock(idlePreview ? cycles[0].focusMinutes * 60 : state.remainingSeconds),
      start: pomodoro.start,
      pause: pomodoro.pause,
      toggle: pomodoro.toggle,
      reset: pomodoro.reset,
      skip: pomodoro.skip,
      resetLabel: 'Reiniciar',
      text: (() => {
        switch (state.status) {
          case 'idle':
            return 'Configure sua sessão e toque em iniciar';
          case 'finished':
            return 'Todos os ciclos concluídos — mandou bem!';
          case 'alarm':
            return 'Alarme tocando';
          case 'paused':
            return `Pausado · Ciclo ${state.currentCycleIndex + 1}/${cycles.length}`;
          default:
            return `Ciclo ${state.currentCycleIndex + 1}/${cycles.length} · ${
              state.currentPhase === 'focus' ? 'Foco' : 'Pausa'
            }`;
        }
      })(),
    };
  })();

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      if (alarm && (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter')) {
        e.preventDefault();
        dismissAlarm();
        return;
      }
      if (el && el.tagName === 'BUTTON') return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (view.canStart) view.toggle();
      } else if (e.key.toLowerCase() === 's' && view.skip) {
        view.skip();
      } else if (e.key.toLowerCase() === 'r') {
        view.reset();
      } else if (e.key.toLowerCase() === 'm') {
        toggleSound();
      } else if (e.key.toLowerCase() === 'l' && mode === 'stopwatch') {
        stopwatch.lap();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [alarm, dismissAlarm, view, toggleSound, mode, stopwatch]);

  // Live countdown in the browser tab.
  useEffect(() => {
    if (alarm) {
      document.title = `⏰ ${alarm.title} — Zync`;
      return;
    }
    if (view.status === 'running' || view.status === 'paused') {
      const label =
        mode === 'pomodoro' ? (state.currentPhase === 'focus' ? 'Foco' : 'Pausa') : MODE_OPTIONS.find((m) => m.value === mode)!.label;
      document.title = `${view.readout} · ${label} — Zync`;
    } else {
      document.title = 'Zync — Pomodoro & Study Timer';
    }
  }, [alarm, view.status, view.readout, mode, state.currentPhase]);

  return (
    <>
      <AmbientBackground
        phase={state.currentPhase}
        status={view.status === 'alarm' ? 'running' : view.status}
        particles={visuals.particles}
        gears={visuals.gears}
        scenery={visuals.scenery}
        glow={visuals.glow}
        scene={sound.scene}
        rainIntensity={sound.settings.rainIntensity}
        flash={sound.flash}
      />

      {alarm && (
        <AlarmOverlay
          alarm={alarm}
          muted={alarmMuted}
          onDismiss={dismissAlarm}
          onSilence={silenceAlarm}
        />
      )}

      <main id="app" className="app-shell">
        <div id="tempo" className="screen-time">
          <header className="shell-header">
            <a className="wordmark" href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
              <MiniClock accent={accent} size={22} />
              Zync
            </a>
            <p className="shell-tagline">Pomodoro &amp; study timer</p>
          </header>

          <div className="shell-grid">
            <ClockStudio
              skin={skin}
              onPatch={patch}
              onPreset={applyPreset}
              accentLocked={Boolean(sound.scene) && accent !== skin.accent}
              visuals={visuals}
              onVisual={setVisual}
              onAllVisuals={setAllVisuals}
            />

            <section className={`stage${pomodoro.flash ? ' flash' : ''}`}>
              <div className="mode-switch">
                <SegmentedControl value={mode} options={MODE_OPTIONS} onChange={setMode} />
              </div>

              {visuals.clock3d ? (
                <div className="stage-canvas">
                  <Suspense fallback={null}>
                    <TimepieceCanvas
                      skin={viewSkin}
                      mode="app"
                      remainingSeconds={view.remaining}
                      phaseTotalSeconds={view.total}
                      running={view.running}
                      countUp={view.countUp}
                    />
                  </Suspense>
                </div>
              ) : (
                <div className="stage-plain">
                  <span className="plain-readout">{view.readout}</span>
                </div>
              )}

              {visuals.clock3d && visuals.readout && <p className="stage-readout">{view.readout}</p>}
              <p className="timer-status">{view.text}</p>

              {mode === 'pomodoro' && state.status !== 'idle' && cycles.length > 1 && (
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
                status={view.status}
                canStart={view.canStart}
                onStart={view.start}
                onPause={view.pause}
                onSkip={view.skip}
                onReset={view.reset}
                resetLabel={view.resetLabel}
              />

              <p className="kbd-legend">
                <kbd>espaço</kbd> play/pause ·{' '}
                {mode === 'pomodoro' && (
                  <>
                    <kbd>S</kbd> pular ·{' '}
                  </>
                )}
                {mode === 'stopwatch' && (
                  <>
                    <kbd>L</kbd> volta ·{' '}
                  </>
                )}
                <kbd>R</kbd> {view.resetLabel.toLowerCase()} · <kbd>M</kbd> som
              </p>
            </section>

            <div className="shell-side">
              {mode === 'pomodoro' && (
                <SessionBuilder
                  numCycles={numCycles}
                  onNumCyclesChange={setNumCycles}
                  cycles={cycles}
                  onCyclesChange={setCycles}
                  onGenerate={generateCycles}
                  disabled={timerActive}
                />
              )}
              {mode === 'timer' && (
                <TimerSetup
                  totalSeconds={countdown.state.totalSeconds}
                  onChange={countdown.setDuration}
                  disabled={countdown.state.status === 'running'}
                />
              )}
              {mode === 'stopwatch' && (
                <LapList
                  laps={stopwatch.state.laps}
                  elapsedMs={stopwatch.state.elapsedMs}
                  canLap={stopwatch.state.status !== 'idle'}
                  onLap={stopwatch.lap}
                />
              )}
              <StatsBar stats={stats} />
            </div>
          </div>

          <a
            className="scroll-cue"
            href="#sons"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById('sons')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            Sons de fundo
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>

        <SoundSection
          settings={sound.settings}
          onUpdate={sound.update}
          onSelectNoise={sound.selectNoise}
          onSelectNature={sound.selectNature}
          onTogglePlaying={sound.togglePlaying}
          onReset={sound.resetControls}
        />

        <footer className="shell-footer">
          Feito para quem leva o foco a sério.
        </footer>
      </main>
    </>
  );
}

export default App;
