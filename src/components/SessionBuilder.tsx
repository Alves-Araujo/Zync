import type { CycleConfig } from '../types';
import NumberStepper from './NumberStepper';
import CycleSetup from './CycleSetup';

interface Props {
  numCycles: number;
  onNumCyclesChange: (n: number) => void;
  cycles: CycleConfig[];
  onCyclesChange: (c: CycleConfig[]) => void;
  onGenerate: () => void;
  disabled: boolean;
}

const PRESETS = [
  { label: 'Clássico', focus: 25, brk: 5 },
  { label: 'Longo', focus: 50, brk: 10 },
  { label: 'Sprint', focus: 15, brk: 3 },
  { label: 'Deep work', focus: 90, brk: 20 },
];

export default function SessionBuilder({
  numCycles,
  onNumCyclesChange,
  cycles,
  onCyclesChange,
  onGenerate,
  disabled,
}: Props) {
  const applyPreset = (focus: number, brk: number) => {
    if (cycles.length === 0) return;
    onCyclesChange(cycles.map(() => ({ focusMinutes: focus, breakMinutes: brk })));
  };

  const totalMin = cycles.reduce((s, c) => s + c.focusMinutes + c.breakMinutes, 0);
  const focusMin = cycles.reduce((s, c) => s + c.focusMinutes, 0);

  return (
    <aside className="panel builder">
      <header className="panel-head">
        <h2>Sessão</h2>
        <p>Monte seus blocos de foco e pausa.</p>
      </header>

      <div className="builder-generate">
        <NumberStepper
          label="Ciclos"
          value={numCycles}
          min={1}
          max={12}
          disabled={disabled}
          onChange={onNumCyclesChange}
        />
        <button className="btn btn-primary" onClick={onGenerate} disabled={disabled}>
          Gerar
        </button>
      </div>

      {cycles.length > 0 ? (
        <>
          <div className="field">
            <span className="field-label">Aplicar a todos</span>
            <div className="preset-row">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className="preset-chip"
                  disabled={disabled}
                  onClick={() => applyPreset(p.focus, p.brk)}
                >
                  <strong>{p.label}</strong>
                  <span>
                    {p.focus}/{p.brk}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <CycleSetup cycles={cycles} onChange={onCyclesChange} disabled={disabled} />

          <p className="builder-total">
            <span>
              Total <strong>{Math.floor(totalMin / 60)}h {totalMin % 60}min</strong>
            </span>
            <span>
              Foco <strong>{focusMin}min</strong>
            </span>
          </p>
        </>
      ) : (
        <p className="builder-empty">
          Escolha o número de ciclos e toque em <strong>Gerar</strong> para ajustar cada bloco.
        </p>
      )}
    </aside>
  );
}
