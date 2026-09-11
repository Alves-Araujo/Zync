import { lazy, Suspense } from 'react';
import type { ClockSkin } from '../clock/skins';
import { progressToF } from '../three/forms';
import MiniClock from './MiniClock';

const TimepieceCanvas = lazy(() => import('../three/TimepieceCanvas'));

interface Props {
  skin: ClockSkin;
  progress: number;
  onEnter: () => void;
}

const PHRASES: { at: [number, number]; text: string }[] = [
  { at: [0.02, 0.16], text: 'O tempo não espera por ninguém.' },
  { at: [0.18, 0.34], text: 'Ele muda de forma — do bolso ao pulso…' },
  { at: [0.38, 0.54], text: '…da parede à areia que escorre.' },
  { at: [0.58, 0.78], text: 'Zync transforma minutos em foco.' },
  { at: [0.82, 0.98], text: 'Seu Pomodoro, do seu jeito.' },
];

function phraseOpacity([start, end]: [number, number], p: number) {
  const mid = (start + end) / 2;
  const half = (end - start) / 2;
  const t = 1 - Math.min(1, Math.abs(p - mid) / half);
  return Math.max(0, t);
}

export default function Hero({ skin, progress, onEnter }: Props) {
  const fade = progress < 0.93 ? 1 : Math.max(0, 1 - (progress - 0.93) / 0.07);
  const gone = progress >= 1;
  const morph = progressToF(progress);
  const assemble = Math.min(1, Math.max(0, progress / 0.09));

  return (
    <div
      className="intro"
      hidden={gone}
      aria-hidden="true"
      style={{ opacity: fade, pointerEvents: fade < 0.6 ? 'none' : 'auto' }}
    >
      <div className="intro-canvas">
        <Suspense fallback={null}>
          <TimepieceCanvas skin={skin} mode="intro" morph={morph} assemble={assemble} />
        </Suspense>
      </div>

      <div className="intro-copy">
        <span className="hero-eyebrow" style={{ opacity: Math.max(0, 1 - progress * 4) }}>
          <MiniClock accent={skin.accent} size={18} /> Zync
        </span>
        {PHRASES.map((ph) => (
          <p key={ph.text} className="intro-phrase" style={{ opacity: phraseOpacity(ph.at, progress) }}>
            {ph.text}
          </p>
        ))}
      </div>

      <button
        className="hero-hint"
        style={{ opacity: Math.max(0, 1 - progress * 2.5) }}
        onClick={onEnter}
      >
        role para montar o relógio
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div className="intro-progress">
        <span style={{ transform: `scaleX(${progress})` }} />
      </div>
    </div>
  );
}
