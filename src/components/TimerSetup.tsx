import NumberStepper from './NumberStepper';

interface Props {
  totalSeconds: number;
  onChange: (seconds: number) => void;
  disabled: boolean;
}

const PRESETS = [1, 5, 10, 15, 25, 45, 60];

export default function TimerSetup({ totalSeconds, onChange, disabled }: Props) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return (
    <aside className="panel builder">
      <header className="panel-head">
        <h2>Temporizador</h2>
        <p>Escolha um tempo e toque em iniciar. O alarme toca no fim.</p>
      </header>

      <div className="time-fields">
        <NumberStepper
          label="Minutos"
          value={minutes}
          min={0}
          max={180}
          disabled={disabled}
          onChange={(m) => onChange(m * 60 + seconds)}
        />
        <NumberStepper
          label="Segundos"
          value={seconds}
          min={0}
          max={59}
          disabled={disabled}
          onChange={(s) => onChange(minutes * 60 + s)}
        />
      </div>

      <div className="field">
        <span className="field-label">Atalhos</span>
        <div className="quick-row">
          {PRESETS.map((m) => (
            <button
              key={m}
              type="button"
              className={`quick-chip${totalSeconds === m * 60 ? ' is-active' : ''}`}
              disabled={disabled}
              onClick={() => onChange(m * 60)}
            >
              {m} min
            </button>
          ))}
        </div>
      </div>

      {disabled && <p className="builder-empty">Pause ou reinicie para mudar o tempo.</p>}
    </aside>
  );
}
