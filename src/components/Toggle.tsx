interface Props {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

export default function Toggle({ label, checked, onChange }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`toggle${checked ? ' is-on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-track">
        <span className="toggle-thumb" />
      </span>
      {label}
    </button>
  );
}
