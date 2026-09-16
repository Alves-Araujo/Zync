export type AlarmTone = 'rest' | 'focus' | 'done';

export interface AlarmInfo {
  tone: AlarmTone;
  title: string;
  message: string;
  /** Label of the button that stops the alarm and moves on. */
  action: string;
}

interface Props {
  alarm: AlarmInfo;
  muted: boolean;
  onDismiss: () => void;
  onSilence: () => void;
}

const BELL = (
  <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
    <path
      d="M12 3a6 6 0 0 0-6 6c0 3.6-.9 5.3-1.7 6.2-.5.6-.1 1.6.7 1.6h14c.8 0 1.2-1 .7-1.6-.8-.9-1.7-2.6-1.7-6.2a6 6 0 0 0-6-6zM9.5 19.5a2.6 2.6 0 0 0 5 0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function AlarmOverlay({ alarm, muted, onDismiss, onSilence }: Props) {
  return (
    <div className={`alarm-overlay tone-${alarm.tone}`} role="alertdialog" aria-labelledby="alarm-title">
      <div className="alarm-card">
        <span className={`alarm-bell${muted ? ' is-muted' : ''}`} aria-hidden="true">
          {BELL}
        </span>
        <h2 id="alarm-title">{alarm.title}</h2>
        <p>{alarm.message}</p>
        <div className="alarm-actions">
          <button type="button" className="btn btn-primary btn-lg" onClick={onDismiss} autoFocus>
            {alarm.action}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onSilence} disabled={muted}>
            {muted ? 'Alarme silenciado' : 'Silenciar alarme'}
          </button>
        </div>
        <p className="alarm-hint">
          <kbd>espaço</kbd> ou <kbd>enter</kbd> para continuar
        </p>
      </div>
    </div>
  );
}
