import type { ClockSkin } from '../clock/skins';
import { ACCENT_SWATCHES, SHAPE_OPTIONS, SKIN_PRESETS } from '../clock/skins';
import { VISUAL_OPTIONS, type VisualPrefs } from '../hooks/useVisualPrefs';
import SegmentedControl from './SegmentedControl';
import Toggle from './Toggle';

interface Props {
  skin: ClockSkin;
  onPatch: (changes: Partial<ClockSkin>) => void;
  onPreset: (id: string) => void;
  /** The active sound's theme is currently overriding the accent colour. */
  accentLocked?: boolean;
  visuals: VisualPrefs;
  onVisual: (key: keyof VisualPrefs, value: boolean) => void;
  onAllVisuals: (value: boolean) => void;
}

export default function ClockStudio({
  skin,
  onPatch,
  onPreset,
  accentLocked = false,
  visuals,
  onVisual,
  onAllVisuals,
}: Props) {
  // the digital clock is not an animation, so it does not count for "desligar todas"
  const allOff = VISUAL_OPTIONS.every((o) => o.key === 'readout' || !visuals[o.key]);
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
        {accentLocked && (
          <p className="accent-note">O tema do som está colorindo o site. Desative em Sons de fundo para usar sua cor.</p>
        )}
      </div>

      <div className="field">
        <span className="field-label sound-slider-label">
          Animações
          <button type="button" className="link-btn" onClick={() => onAllVisuals(allOff)}>
            {allOff ? 'Ligar todas' : 'Desligar todas'}
          </button>
        </span>
        <p className="field-hint">Desligue o que quiser se o computador estiver pesado.</p>
        <div className="toggles">
          {VISUAL_OPTIONS.map((o) => (
            <Toggle
              key={o.key}
              label={o.label}
              checked={visuals[o.key]}
              onChange={(v) => onVisual(o.key, v)}
            />
          ))}
        </div>
      </div>
    </aside>
  );
}
