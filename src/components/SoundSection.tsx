import { useState } from 'react';
import {
  BINAURAL_BANDS,
  binauralCarrier,
  NATURE_OPTIONS,
  NOISE_OPTIONS,
  rainLabel,
  type NatureKind,
  type NoiseKind,
  type SoundCategory,
  type SoundOption,
} from '../audio/scenes';
import { CONTROL_KEYS, SOUND_DEFAULTS, type SoundSettings } from '../hooks/useSoundscape';
import SegmentedControl from './SegmentedControl';
import SoundArt from './SoundArt';
import Toggle from './Toggle';

interface Props {
  settings: SoundSettings;
  onUpdate: (changes: Partial<SoundSettings>) => void;
  onSelectNoise: (kind: NoiseKind) => void;
  onSelectNature: (kind: NatureKind) => void;
  onTogglePlaying: () => void;
  onReset: (category: SoundCategory) => void;
}

const toneLabel = (t: number) => (t < 0.4 ? 'Mais grave' : t > 0.6 ? 'Mais agudo' : 'Neutro');

function Bars() {
  return (
    <span className="eq" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

function Slider({
  label,
  value,
  display,
  className,
  onChange,
}: {
  label: string;
  value: number;
  display?: string;
  className?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className={`field${className ? ` ${className}` : ''}`}>
      <span className="field-label sound-slider-label">
        {label}
        <span className="sound-value">{display ?? `${Math.round(value * 100)}%`}</span>
      </span>
      <input
        type="range"
        className="slider"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
      />
    </label>
  );
}

function SoundCard<T extends NoiseKind | NatureKind>({
  option,
  active,
  playing,
  onSelect,
}: {
  option: SoundOption<T>;
  active: boolean;
  playing: boolean;
  onSelect: (kind: T) => void;
}) {
  const live = active && playing;
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`sound-card${active ? ' is-active' : ''}${live ? ' is-live' : ''}`}
      onClick={() => onSelect(option.id)}
    >
      <span className="sound-art">
        <SoundArt kind={option.id} live={live} />
        <span className="sound-badge">
          {live ? (
            <>
              <Bars />
              Tocando
            </>
          ) : active ? (
            'Pausado'
          ) : (
            <>
              <svg viewBox="0 0 24 24" width="10" height="10" aria-hidden="true">
                <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z" fill="currentColor" />
              </svg>
              Ouvir
            </>
          )}
        </span>
      </span>
      <span className="sound-body">
        <strong>{option.name}</strong>
        <span className="sound-desc">{option.description}</span>
        <span className="sound-tags">
          {option.tags.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </span>
      </span>
    </button>
  );
}

function Chip({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <span className="mixer-chip">
      {name}
      <button type="button" aria-label={`Desligar ${name}`} title="Desligar" onClick={onRemove}>
        ×
      </button>
    </span>
  );
}

export default function SoundSection({
  settings,
  onUpdate,
  onSelectNoise,
  onSelectNature,
  onTogglePlaying,
  onReset,
}: Props) {
  const [tab, setTab] = useState<SoundCategory>(settings.focus);
  const { playing } = settings;
  const noiseOpt = NOISE_OPTIONS.find((o) => o.id === settings.noise);
  const natureOpt = NATURE_OPTIONS.find((o) => o.id === settings.nature);
  const hasSound = Boolean(noiseOpt || natureOpt);

  const isNoise = tab === 'noise';
  const special = isNoise
    ? settings.noise === 'binaural'
      ? 'binaural'
      : null
    : settings.nature === 'rain'
      ? 'rain'
      : null;
  const band = BINAURAL_BANDS.find((b) => b.value === settings.binauralBand) ?? BINAURAL_BANDS[2];
  const tabOption = isNoise ? noiseOpt : natureOpt;
  const atDefaults = CONTROL_KEYS[tab].every((key) => settings[key] === SOUND_DEFAULTS[key]);

  return (
    <section id="sons" className="sounds" aria-labelledby="sons-title">
      <header className="sounds-head">
        <div className="sounds-title">
          <span className="section-kicker">Ambiente</span>
          <h2 id="sons-title">Sons de fundo</h2>
          <p>
            Ruídos e paisagens sonoras geradas ao vivo. Misture um ruído com um som da natureza — o
            site acompanha o clima do último som escolhido.
          </p>
        </div>

        <div className="sound-mixer">
          <button
            type="button"
            className={`sound-play${playing ? ' is-on' : ''}`}
            onClick={onTogglePlaying}
            disabled={!hasSound}
            aria-label={playing ? 'Pausar som' : 'Tocar som'}
            title={hasSound ? (playing ? 'Pausar (M)' : 'Tocar (M)') : 'Escolha um som'}
          >
            {playing ? (
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
                <rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M8 5.5v13a1 1 0 0 0 1.5.9l10-6.5a1 1 0 0 0 0-1.7l-10-6.5A1 1 0 0 0 8 5.5z" fill="currentColor" />
              </svg>
            )}
          </button>

          <div className="mixer-now">
            <span className={`mixer-label${playing ? ' is-live' : ''}`}>
              {playing && <Bars />}
              {playing ? 'Tocando agora' : hasSound ? 'Pausado' : 'Nada tocando'}
            </span>
            <div className="mixer-chips">
              {noiseOpt && <Chip name={noiseOpt.name} onRemove={() => onSelectNoise(noiseOpt.id)} />}
              {natureOpt && <Chip name={natureOpt.name} onRemove={() => onSelectNature(natureOpt.id)} />}
              {!hasSound && <span className="mixer-empty">Escolha um ruído e/ou um som da natureza abaixo.</span>}
            </div>
          </div>

          <div className="mixer-row">
            <Slider label="Volume geral" value={settings.volume} onChange={(volume) => onUpdate({ volume })} />
            <Toggle
              label="Tema acompanha o som"
              checked={settings.syncTheme}
              onChange={(syncTheme) => onUpdate({ syncTheme })}
            />
            <button
              type="button"
              className="mixer-stop"
              disabled={!hasSound}
              onClick={() => onUpdate({ noise: null, nature: null, playing: false })}
            >
              Parar tudo
            </button>
          </div>
        </div>
      </header>

      <div className="sounds-toolbar">
        <div className="sound-tabs" role="tablist" aria-label="Tipo de som">
          {(
            [
              ['noise', 'Ruídos', settings.noise],
              ['nature', 'Natureza', settings.nature],
            ] as const
          ).map(([id, label, selected]) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`sound-tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`sound-pane-${id}`}
              className={`sound-tab${tab === id ? ' is-active' : ''}`}
              onClick={() => setTab(id)}
            >
              {label}
              {selected && <span className={`tab-dot${playing ? ' is-live' : ''}`} />}
            </button>
          ))}
        </div>
        <p className="sounds-meta">
          <span>{NOISE_OPTIONS.length} ruídos</span>
          <span>{NATURE_OPTIONS.length} paisagens</span>
          <span>
            <kbd>M</kbd> toca/pausa
          </span>
          <span>Melhor com fones</span>
        </p>
      </div>

      <div
        key={tab}
        className="sound-pane"
        role="tabpanel"
        id={`sound-pane-${tab}`}
        aria-labelledby={`sound-tab-${tab}`}
      >
        <div className="sound-cards">
          {isNoise
            ? NOISE_OPTIONS.map((o) => (
                <SoundCard
                  key={o.id}
                  option={o}
                  active={settings.noise === o.id}
                  playing={playing}
                  onSelect={onSelectNoise}
                />
              ))
            : NATURE_OPTIONS.map((o) => (
                <SoundCard
                  key={o.id}
                  option={o}
                  active={settings.nature === o.id}
                  playing={playing}
                  onSelect={onSelectNature}
                />
              ))}
        </div>

        <div className="sound-settings">
          <div className="settings-head">
            <span className="settings-title">
              {isNoise ? 'Ajustes dos ruídos' : 'Ajustes da natureza'}
              {tabOption && <strong>{tabOption.name}</strong>}
            </span>
            <button
              type="button"
              className="settings-reset"
              disabled={atDefaults}
              onClick={() => onReset(tab)}
              title="Volta o volume, o timbre e as opções desta aba ao padrão"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                <path
                  d="M3 12a9 9 0 1 0 2.6-6.4M3 3.5V9h5.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Restaurar padrão
            </button>
          </div>

        <div className={`sound-controls${special === 'binaural' ? ' sound-controls--binaural' : ''}`}>
          <Slider
            label={isNoise ? 'Volume do ruído' : 'Volume da natureza'}
            value={isNoise ? settings.noiseVolume : settings.natureVolume}
            onChange={(v) => onUpdate(isNoise ? { noiseVolume: v } : { natureVolume: v })}
          />
          <Slider
            label="Timbre"
            value={isNoise ? settings.noiseTone : settings.natureTone}
            display={toneLabel(isNoise ? settings.noiseTone : settings.natureTone)}
            onChange={(v) => onUpdate(isNoise ? { noiseTone: v } : { natureTone: v })}
          />

          {special === 'rain' && (
            <>
              <Slider
                label="Intensidade"
                value={settings.rainIntensity}
                display={rainLabel(settings.rainIntensity)}
                onChange={(rainIntensity) => onUpdate({ rainIntensity, focus: 'nature' })}
              />
              <div className="control-cell">
                <Toggle
                  label="Trovões"
                  checked={settings.thunder}
                  onChange={(thunder) => onUpdate({ thunder, focus: 'nature' })}
                />
              </div>
            </>
          )}

          {special === 'binaural' && (
            <>
              <SegmentedControl
                label={`Onda · ${band.beat} Hz (${band.use})`}
                value={settings.binauralBand}
                options={BINAURAL_BANDS}
                onChange={(binauralBand) => onUpdate({ binauralBand, focus: 'noise' })}
              />
              <Slider
                label="Tom base"
                value={settings.binauralTone}
                display={`${binauralCarrier(settings.binauralTone)} Hz`}
                onChange={(binauralTone) => onUpdate({ binauralTone })}
              />
            </>
          )}

          {!special && (
            <p className="sound-tip">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path
                  d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {isNoise
                ? 'Dica: as Ondas binaurais só funcionam de fone, porque cada ouvido recebe um tom diferente.'
                : 'Dica: escolha Chuva para ajustar a intensidade e ligar os trovões.'}
            </p>
          )}
        </div>
        </div>
      </div>
    </section>
  );
}
