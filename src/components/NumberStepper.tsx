import { useId } from 'react';

interface Props {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
}

/**
 * Themed numeric input with explicit +/- buttons. Replaces the native number
 * spinner, whose arrows are nearly invisible in dark mode.
 */
export default function NumberStepper({
  label,
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
  unit,
  disabled = false,
}: Props) {
  const id = useId();
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const set = (n: number) => onChange(clamp(Number.isFinite(n) ? n : min));

  return (
    <div className={`stepper${disabled ? ' is-disabled' : ''}`}>
      <label className="stepper-label" htmlFor={id}>
        {label}
        {unit && <span className="stepper-unit"> · {unit}</span>}
      </label>
      <div className="stepper-control">
        <button
          type="button"
          className="stepper-btn"
          aria-label={`Diminuir ${label}`}
          disabled={disabled || value <= min}
          onClick={() => set(value - step)}
        >
          <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
            <path d="M3 8h10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          className="stepper-input"
          value={value}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(e) => set(parseInt(e.target.value, 10))}
        />
        <button
          type="button"
          className="stepper-btn"
          aria-label={`Aumentar ${label}`}
          disabled={disabled || value >= max}
          onClick={() => set(value + step)}
        >
          <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
            <path
              d="M8 3v10M3 8h10"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
