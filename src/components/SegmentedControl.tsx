interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  label?: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
}

export default function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: Props<T>) {
  return (
    <div className="field">
      {label && <span className="field-label">{label}</span>}
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            className={`segment${o.value === value ? ' is-active' : ''}`}
            disabled={disabled}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
