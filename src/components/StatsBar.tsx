import type { StudyStats } from '../hooks/useStudyStats';

interface Props {
  stats: StudyStats;
}

function fmtDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const m = Math.floor(totalSeconds / 60);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}min`;
}

export default function StatsBar({ stats }: Props) {
  const items = [
    { label: 'Foco hoje', value: fmtDuration(stats.focusSecondsToday) },
    { label: 'Ciclos hoje', value: String(stats.cyclesToday) },
    { label: 'Sequência', value: `${stats.streakDays}d` },
    { label: 'Recorde', value: fmtDuration(stats.bestFocusSeconds) },
  ];

  return (
    <div className="panel stats">
      <header className="panel-head">
        <h2>Progresso</h2>
      </header>
      <dl className="stats-grid">
        {items.map((it) => (
          <div key={it.label} className="stat">
            <dt>{it.label}</dt>
            <dd>{it.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
