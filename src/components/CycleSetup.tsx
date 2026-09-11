import type { CycleConfig } from '../types';
import NumberStepper from './NumberStepper';

interface Props {
  cycles: CycleConfig[];
  onChange: (cycles: CycleConfig[]) => void;
  disabled: boolean;
}

export default function CycleSetup({ cycles, onChange, disabled }: Props) {
  const updateCycle = (index: number, field: keyof CycleConfig, value: number) => {
    onChange(cycles.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  };

  return (
    <ol className="cycle-list">
      {cycles.map((c, i) => (
        <li key={i} className="cycle-row">
          <span className="cycle-index">{i + 1}</span>
          <NumberStepper
            label="Foco"
            value={c.focusMinutes}
            min={1}
            max={180}
            step={5}
            unit="min"
            disabled={disabled}
            onChange={(v) => updateCycle(i, 'focusMinutes', v)}
          />
          <NumberStepper
            label="Pausa"
            value={c.breakMinutes}
            min={0}
            max={60}
            step={1}
            unit="min"
            disabled={disabled}
            onChange={(v) => updateCycle(i, 'breakMinutes', v)}
          />
        </li>
      ))}
    </ol>
  );
}
