import type { ClockSkin } from '../clock/skins';
import { ACCENT_SWATCHES, SHAPE_OPTIONS, SKIN_PRESETS } from '../clock/skins';
import SegmentedControl from './SegmentedControl';

interface Props {
  skin: ClockSkin;
  onPatch: (changes: Partial<ClockSkin>) => void;
  onPreset: (id: string) => void;
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
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

export default function ClockStudio({ skin, onPatch, onPreset }: Props) {
  return (
    <aside className="panel studio">
      <header className="panel-head">
        <h2>Aparência</h2>
        <p>Escolha o formato e o acabamento do relógio.</p>
      </header>

      <SegmentedControl
        label="Formato"
        value={skin.shape}
        options={SHAPE_OPTIONS}
        onChange={(shape) => onPatch({ shape })}
      />

      <div className="field">
        <span className="field-label">Estilo</span>
        <div className="skin-grid">
          {SKIN_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`skin-chip${skin.preset === p.id ? ' is-active' : ''}`}
              data-face={p.face}
              onClick={() => onPreset(p.id)}
            >
              <span className="skin-swatch" style={{ background: p.accent }} />
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field-label">Cor de destaque</span>
        <div className="swatch-row">
          {ACCENT_SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Cor ${c}`}
              className={`swatch${skin.accent.toLowerCase() === c.toLowerCase() ? ' is-active' : ''}`}
              style={{ background: c }}
              onClick={() => onPatch({ accent: c })}
            />
          ))}
          <label className="swatch swatch-custom" aria-label="Cor personalizada">
            <input
              type="color"
              value={skin.accent}
              onChange={(e) => onPatch({ accent: e.target.value })}
            />
          </label>
        </div>
      </div>

      <div className="field toggles">
        <Toggle
          label="Partículas no fundo"
          checked={skin.particles}
          onChange={(v) => onPatch({ particles: v })}
        />
      </div>
    </aside>
  );
}
