import type { Phase, TimerStatus } from '../types';

interface Props {
  phase: Phase;
  status: TimerStatus;
  particles: boolean;
}

const PARTICLE_COUNT = 22;

function rand(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const PARTICLES = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
  id: i,
  left: rand(i) * 100,
  size: 1 + rand(i + 100) * 2.5,
  delay: -rand(i + 200) * 26,
  duration: 20 + rand(i + 300) * 24,
  drift: (rand(i + 400) - 0.5) * 50,
  opacity: 0.12 + rand(i + 500) * 0.4,
}));

export default function AmbientBackground({ phase, status, particles }: Props) {
  return (
    <div className={`ambient phase-${phase} status-${status}`} aria-hidden="true">
      <div className="ambient-aurora aurora-a" />
      <div className="ambient-aurora aurora-b" />
      <div className="ambient-grid" />
      {particles && (
        <div className="ambient-particles">
          {PARTICLES.map((p) => (
            <span
              key={p.id}
              className="particle"
              style={
                {
                  left: `${p.left}%`,
                  width: `${p.size}px`,
                  height: `${p.size}px`,
                  opacity: p.opacity,
                  animationDelay: `${p.delay}s`,
                  animationDuration: `${p.duration}s`,
                  '--drift': `${p.drift}px`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      )}
      <div className="ambient-vignette" />
    </div>
  );
}
