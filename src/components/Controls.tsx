import type { TimerStatus } from '../types';

interface Props {
  status: TimerStatus;
  canStart: boolean;
  onStart: () => void;
  onPause: () => void;
  /** Omitted outside the pomodoro, where there is no next phase to skip to. */
  onSkip?: () => void;
  onReset: () => void;
  resetLabel?: string;
}

const Icon = {
  play: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
    </svg>
  ),
  pause: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5h3v14H8zM13 5h3v14h-3z" fill="currentColor" />
    </svg>
  ),
  skip: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 5.5v13l9-6.5zM16 5h2.5v14H16z" fill="currentColor" />
    </svg>
  ),
  reset: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5a7 7 0 1 1-6.6 4.7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M5 4v4h4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

export default function Controls({
  status,
  canStart,
  onStart,
  onPause,
  onSkip,
  onReset,
  resetLabel = 'Reiniciar',
}: Props) {
  const running = status === 'running';
  const midSession = status === 'running' || status === 'paused';
  const primaryLabel = running
    ? 'Pausar'
    : status === 'paused'
      ? 'Continuar'
      : status === 'finished'
        ? 'Recomeçar'
        : 'Iniciar';

  return (
    <div className="controls">
      <button
        className="btn btn-primary btn-lg"
        onClick={running ? onPause : onStart}
        disabled={!canStart || status === 'alarm'}
      >
        {running ? Icon.pause : Icon.play}
        {primaryLabel}
      </button>

      {onSkip && (
        <button className="btn btn-ghost" onClick={onSkip} disabled={!midSession}>
          {Icon.skip}
          Pular
        </button>
      )}

      <button className="btn btn-ghost btn-danger" onClick={onReset} disabled={status === 'idle'}>
        {Icon.reset}
        {resetLabel}
      </button>
    </div>
  );
}
