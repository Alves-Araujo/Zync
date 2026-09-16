interface Props {
  laps: number[];
  elapsedMs: number;
  canLap: boolean;
  onLap: () => void;
}

function fmt(ms: number) {
  const total = Math.floor(ms / 100);
  const tenths = total % 10;
  const s = Math.floor(total / 10) % 60;
  const m = Math.floor(total / 600);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${tenths}`;
}

export default function LapList({ laps, elapsedMs, canLap, onLap }: Props) {
  const best = laps.length > 1 ? Math.min(...laps.map((l, i) => l - (laps[i - 1] ?? 0))) : null;

  return (
    <aside className="panel builder">
      <header className="panel-head">
        <h2>Cronômetro</h2>
        <p>Conte o tempo para cima e marque voltas.</p>
      </header>

      <button type="button" className="btn btn-primary" onClick={onLap} disabled={!canLap}>
        Marcar volta
      </button>

      {laps.length > 0 ? (
        <ol className="lap-list">
          {laps
            .map((at, i) => ({ at, split: at - (laps[i - 1] ?? 0), i }))
            .reverse()
            .map(({ at, split, i }) => (
              <li key={i} className={best !== null && split === best ? 'is-best' : undefined}>
                <span className="lap-index">#{i + 1}</span>
                <span className="lap-split">{fmt(split)}</span>
                <span className="lap-total">{fmt(at)}</span>
              </li>
            ))}
        </ol>
      ) : (
        <p className="builder-empty">
          Toque em <strong>Marcar volta</strong> enquanto o cronômetro corre para registrar parciais.
        </p>
      )}

      <p className="builder-total">
        <span>
          Tempo <strong>{fmt(elapsedMs)}</strong>
        </span>
        <span>
          Voltas <strong>{laps.length}</strong>
        </span>
      </p>
    </aside>
  );
}
