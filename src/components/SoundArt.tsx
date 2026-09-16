import { useId, type CSSProperties } from 'react';
import type { NatureKind, NoiseKind } from '../audio/scenes';

/**
 * Illustrated "photos" for each background sound, drawn as animated SVG so
 * they stay crisp, theme-free and weigh almost nothing. Animations run on
 * hover and while the sound is playing.
 */

const TAU = Math.PI * 2;
const n = (v: number) => v.toFixed(1);

function rand(seed: number) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Filled wave band, 640 wide and periodic every 320 when `wl` divides 320 (for seamless sliding). */
function wave(y: number, amp: number, wl: number, phase = 0) {
  let d = `M0 200 L0 ${n(y + Math.sin(phase) * amp)}`;
  for (let x = 8; x <= 640; x += 8) d += ` L${x} ${n(y + Math.sin((x / wl) * TAU + phase) * amp)}`;
  return `${d} L640 200 Z`;
}

function line(y: number, amp: number, wl: number, phase = 0) {
  let d = `M0 ${n(y + Math.sin(phase) * amp)}`;
  for (let x = 4; x <= 640; x += 4) d += ` L${x} ${n(y + Math.sin((x / wl) * TAU + phase) * amp)}`;
  return d;
}

function pines(seed: number, base: number, hMin: number, hMax: number, step: number) {
  let d = '';
  let x = -12;
  let i = 0;
  while (x < 334) {
    const h = hMin + rand(seed + i) * (hMax - hMin);
    const w = h * 0.45;
    const pts = [
      [x, base - h],
      [x + w * 0.3, base - h * 0.62],
      [x + w * 0.17, base - h * 0.62],
      [x + w * 0.42, base - h * 0.3],
      [x + w * 0.25, base - h * 0.3],
      [x + w * 0.5, base],
      [x - w * 0.5, base],
      [x - w * 0.25, base - h * 0.3],
      [x - w * 0.42, base - h * 0.3],
      [x - w * 0.17, base - h * 0.62],
      [x - w * 0.3, base - h * 0.62],
    ];
    d += `M${pts.map(([a, b]) => `${n(a)} ${n(b)}`).join(' L')} Z`;
    x += step * (0.6 + rand(seed + i + 40) * 0.8);
    i++;
  }
  return d;
}

function flame(cx: number, base: number, w: number, h: number) {
  return `M${cx} ${base} C${cx - w} ${base - h * 0.35} ${cx - w * 0.35} ${base - h * 0.7} ${cx} ${base - h} C${cx + w * 0.35} ${base - h * 0.7} ${cx + w} ${base - h * 0.35} ${cx} ${base} Z`;
}

// static geometry, computed once
let wz = 'M0 100';
for (let x = 4; x <= 320; x += 4) {
  const env = Math.sin((x / 320) * Math.PI);
  wz += ` L${x} ${n(100 + (rand(x) - 0.5) * 70 * env)}`;
}
const WHITE_WAVE = wz;

const PINK_BOKEH = Array.from({ length: 9 }, (_, i) => ({
  cx: rand(i + 10) * 320,
  cy: 20 + rand(i + 20) * 100,
  r: 6 + rand(i + 30) * 16,
  o: 0.12 + rand(i + 40) * 0.3,
}));

const CITY_BOKEH = Array.from({ length: 16 }, (_, i) => ({
  cx: rand(i + 50) * 320,
  cy: 60 + rand(i + 60) * 120,
  r: 6 + rand(i + 70) * 14,
  c: ['#ffb86b', '#7cc4ff', '#ff7b9c', '#ffe08a'][i % 4],
  o: 0.25 + rand(i + 80) * 0.4,
}));

const RAIN_LINES = Array.from({ length: 46 }, (_, i) => ({
  x: rand(i + 90) * 340,
  y: rand(i + 100) * 200,
  len: 10 + rand(i + 110) * 18,
}));

const GLASS_DROPS = Array.from({ length: 34 }, (_, i) => ({
  cx: rand(i + 120) * 320,
  cy: rand(i + 130) * 200,
  r: 1.2 + rand(i + 140) * 3.4,
}));

const DRIPS = Array.from({ length: 5 }, (_, i) => ({
  cx: 30 + rand(i + 150) * 260,
  cy: 20 + rand(i + 160) * 90,
  dur: 3 + rand(i + 170) * 3,
  delay: -rand(i + 180) * 5,
}));

const FOREST_FAR = pines(300, 150, 30, 60, 14);
const FOREST_MID = pines(400, 176, 45, 85, 22);
const FOREST_NEAR = pines(500, 206, 70, 125, 40);

const FLAMES = [
  { d: flame(160, 178, 32, 92), dur: 1.3, delay: 0, inner: false },
  { d: flame(128, 180, 20, 60), dur: 1.1, delay: -0.4, inner: false },
  { d: flame(194, 180, 22, 66), dur: 1.5, delay: -0.8, inner: false },
  { d: flame(156, 178, 15, 52), dur: 0.9, delay: -0.2, inner: true },
  { d: flame(174, 178, 11, 38), dur: 1.0, delay: -0.6, inner: true },
];

const EMBERS = Array.from({ length: 9 }, (_, i) => ({
  cx: 130 + rand(i + 190) * 60,
  cy: 140 + rand(i + 200) * 20,
  dur: 2.2 + rand(i + 210) * 2,
  delay: -rand(i + 220) * 4,
}));

const anim = (dur: number, delay = 0, extra?: CSSProperties): CSSProperties => ({
  animationDuration: `${dur}s`,
  animationDelay: `${delay}s`,
  ...extra,
});

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {children}
    </svg>
  );
}

function WhiteArt({ u, live }: { u: string; live: boolean }) {
  return (
    <Frame>
      <defs>
        <filter id={`${u}n`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3">
            {live && (
              <animate attributeName="seed" values="1;5;9;2;7;4;8;3" dur="0.45s" repeatCount="indefinite" calcMode="discrete" />
            )}
          </feTurbulence>
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncR type="linear" slope="2.2" intercept="-0.6" />
            <feFuncG type="linear" slope="2.2" intercept="-0.6" />
            <feFuncB type="linear" slope="2.4" intercept="-0.55" />
            <feFuncA type="linear" slope="0" intercept="1" />
          </feComponentTransfer>
        </filter>
        <radialGradient id={`${u}v`} cx="50%" cy="50%" r="75%">
          <stop offset="50%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.8" />
        </radialGradient>
        <pattern id={`${u}s`} width="3" height="3" patternUnits="userSpaceOnUse">
          <rect width="3" height="1.2" fill="#000" opacity="0.35" />
        </pattern>
        <linearGradient id={`${u}r`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.18" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="320" height="200" fill="#2a2d33" />
      <rect width="320" height="200" filter={`url(#${u}n)`} />
      <rect width="320" height="200" fill={`url(#${u}s)`} />
      <rect className="art-roll" width="320" height="40" fill={`url(#${u}r)`} />
      <path className="art-glint" d={WHITE_WAVE} fill="none" stroke="#fff" strokeOpacity="0.9" strokeWidth="1.4" style={anim(1.6)} />
      <rect width="320" height="200" fill={`url(#${u}v)`} />
    </Frame>
  );
}

function PinkArt({ u }: { u: string }) {
  return (
    <Frame>
      <defs>
        <linearGradient id={`${u}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b0d2e" />
          <stop offset="0.55" stopColor="#7b2d64" />
          <stop offset="1" stopColor="#f4a3c6" />
        </linearGradient>
        <filter id={`${u}b`}>
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <rect width="320" height="200" fill={`url(#${u}sky)`} />
      <g filter={`url(#${u}b)`}>
        {PINK_BOKEH.map((c, i) => (
          <circle key={i} cx={n(c.cx)} cy={n(c.cy)} r={n(c.r)} fill="#ffd6ea" opacity={c.o} />
        ))}
      </g>
      <g className="art-slide" style={anim(14)}>
        <path d={wave(122, 12, 160)} fill="#f8b4d3" opacity="0.22" />
      </g>
      <g className="art-slide" style={anim(9)}>
        <path d={wave(148, 9, 80, 1)} fill="#ff8fc0" opacity="0.3" />
      </g>
      <g className="art-slide" style={anim(5)}>
        <path d={line(96, 22, 80)} fill="none" stroke="#fff" strokeOpacity="0.8" strokeWidth="1.6" />
      </g>
      <g className="art-slide" style={anim(8)}>
        <path d={line(96, 14, 160, 2)} fill="none" stroke="#ffd1e6" strokeOpacity="0.55" strokeWidth="1.2" />
      </g>
    </Frame>
  );
}

function BrownArt({ u }: { u: string }) {
  return (
    <Frame>
      <defs>
        <linearGradient id={`${u}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#140c08" />
          <stop offset="0.5" stopColor="#4a2a18" />
          <stop offset="0.85" stopColor="#c07a45" />
          <stop offset="1" stopColor="#e3a56a" />
        </linearGradient>
        <radialGradient id={`${u}glow`}>
          <stop offset="0" stopColor="#ffcf8a" stopOpacity="0.6" />
          <stop offset="1" stopColor="#ffcf8a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="200" fill={`url(#${u}sky)`} />
      <circle cx="228" cy="116" r="74" fill={`url(#${u}glow)`} />
      <circle className="art-sun" cx="228" cy="116" r="24" fill="#ffd59a" style={anim(6)} />
      <g className="art-slide" style={anim(60)}>
        <path d={wave(130, 10, 320, 0.5)} fill="#8a5530" />
      </g>
      <g className="art-slide" style={anim(38)}>
        <path d={wave(152, 12, 160, 2)} fill="#5e3820" />
      </g>
      <g className="art-slide" style={anim(24)}>
        <path d={wave(176, 8, 320, 4)} fill="#3a2213" />
      </g>
    </Frame>
  );
}

function FanArt({ u, live }: { u: string; live: boolean }) {
  return (
    <Frame>
      <defs>
        <linearGradient id={`${u}wall`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1f2c35" />
          <stop offset="1" stopColor="#35505e" />
        </linearGradient>
        <radialGradient id={`${u}lamp`}>
          <stop offset="0" stopColor="#fff" stopOpacity="0.12" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="200" fill={`url(#${u}wall)`} />
      <ellipse cx="220" cy="50" rx="120" ry="80" fill={`url(#${u}lamp)`} />
      <rect y="160" width="320" height="40" fill="#162027" />
      <g transform="translate(128 0)">
        <ellipse cx="0" cy="178" rx="42" ry="7" fill="#0c1317" />
        <path d="M-5 178 L-4 118 L4 118 L5 178 Z" fill="#aab6bc" />
        <g transform="translate(0 86)">
          <circle r="58" fill="#0f171b" opacity="0.5" />
          <g className="art-spin" style={{ animationDuration: live ? '0.35s' : '6s' }}>
            {[0, 120, 240].map((r) => (
              <path
                key={r}
                transform={`rotate(${r})`}
                d="M0 -6 C-18 -30 -4 -52 16 -52 C27 -37 19 -16 5 -4 Z"
                fill="#a9d8ea"
                opacity="0.85"
              />
            ))}
          </g>
          <circle r="7" fill="#d8e2e6" />
          {[18, 34, 50, 58].map((r) => (
            <circle key={r} r={r} fill="none" stroke="#dfe7ea" strokeOpacity={r === 58 ? 0.8 : 0.35} strokeWidth={r === 58 ? 2 : 0.8} />
          ))}
          {Array.from({ length: 24 }).map((_, i) => {
            const a = (i / 24) * TAU;
            return (
              <line
                key={i}
                x1={n(Math.cos(a) * 10)}
                y1={n(Math.sin(a) * 10)}
                x2={n(Math.cos(a) * 58)}
                y2={n(Math.sin(a) * 58)}
                stroke="#dfe7ea"
                strokeOpacity="0.28"
                strokeWidth="0.7"
              />
            );
          })}
        </g>
      </g>
      {[62, 86, 110].map((y, i) => (
        <path
          key={y}
          className="art-wind"
          d={`M200 ${y} q20 -6 40 0 t40 0 t40 0`}
          fill="none"
          stroke="#cfe8f2"
          strokeOpacity="0.45"
          strokeWidth="1.4"
          strokeLinecap="round"
          style={anim(1.4 + i * 0.3, -i * 0.5)}
        />
      ))}
    </Frame>
  );
}

function RainArt({ u }: { u: string }) {
  return (
    <Frame>
      <defs>
        <linearGradient id={`${u}bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0a1322" />
          <stop offset="1" stopColor="#1c3352" />
        </linearGradient>
        <filter id={`${u}b`}>
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      <rect width="320" height="200" fill={`url(#${u}bg)`} />
      <g filter={`url(#${u}b)`}>
        {CITY_BOKEH.map((c, i) => (
          <circle key={i} cx={n(c.cx)} cy={n(c.cy)} r={n(c.r)} fill={c.c} opacity={c.o} />
        ))}
      </g>
      <rect width="320" height="200" fill="#8fb4e6" opacity="0.06" />
      <g className="art-rain" style={anim(0.8)}>
        {[0, 200].map((off) =>
          RAIN_LINES.map((l, i) => (
            <line
              key={`${off}-${i}`}
              x1={n(l.x)}
              y1={n(l.y + off)}
              x2={n(l.x - l.len * 0.25)}
              y2={n(l.y + off + l.len)}
              stroke="#bcd4f5"
              strokeOpacity="0.4"
              strokeWidth="0.8"
            />
          )),
        )}
      </g>
      {GLASS_DROPS.map((d, i) => (
        <g key={i}>
          <circle cx={n(d.cx)} cy={n(d.cy)} r={n(d.r)} fill="#cfe3ff" fillOpacity="0.12" stroke="#e9f3ff" strokeOpacity="0.5" strokeWidth="0.6" />
          <circle cx={n(d.cx - d.r * 0.35)} cy={n(d.cy - d.r * 0.35)} r={n(d.r * 0.3)} fill="#fff" opacity="0.6" />
        </g>
      ))}
      {DRIPS.map((d, i) => (
        <g key={i} className="art-drip" style={anim(d.dur, d.delay)}>
          <path d={`M${n(d.cx)} ${n(d.cy - 26)} L${n(d.cx)} ${n(d.cy)}`} stroke="#e9f3ff" strokeOpacity="0.25" strokeWidth="1.6" />
          <circle cx={n(d.cx)} cy={n(d.cy)} r="3.2" fill="#cfe3ff" fillOpacity="0.2" stroke="#fff" strokeOpacity="0.6" strokeWidth="0.7" />
        </g>
      ))}
      <rect width="320" height="200" fill="none" stroke="#070b12" strokeWidth="14" />
      <rect x="157" width="6" height="200" fill="#070b12" />
      <rect y="97" width="320" height="5" fill="#070b12" />
    </Frame>
  );
}

function OceanArt({ u }: { u: string }) {
  return (
    <Frame>
      <defs>
        <linearGradient id={`${u}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#16223f" />
          <stop offset="0.45" stopColor="#6b4a7a" />
          <stop offset="0.8" stopColor="#e8866a" />
          <stop offset="1" stopColor="#f7c68a" />
        </linearGradient>
        <linearGradient id={`${u}sea`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a6b7c" />
          <stop offset="1" stopColor="#0a2633" />
        </linearGradient>
        <radialGradient id={`${u}glow`}>
          <stop offset="0" stopColor="#ffd9a0" stopOpacity="0.7" />
          <stop offset="1" stopColor="#ffd9a0" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="112" fill={`url(#${u}sky)`} />
      <circle cx="160" cy="104" r="60" fill={`url(#${u}glow)`} />
      <circle cx="160" cy="106" r="22" fill="#ffe0ae" />
      <rect y="108" width="320" height="92" fill={`url(#${u}sea)`} />
      {[
        [116, 44],
        [124, 30],
        [133, 56],
        [143, 26],
        [152, 40],
      ].map(([y, w], i) => (
        <rect
          key={y}
          className="art-glint"
          x={160 - w / 2}
          y={y}
          width={w}
          height="2"
          rx="1"
          fill="#ffd9a8"
          opacity="0.65"
          style={anim(2.4, -i * 0.5)}
        />
      ))}
      <g className="art-slide" style={anim(16)}>
        <path d={wave(150, 4, 80)} fill="#1d5566" opacity="0.85" />
      </g>
      <g className="art-slide" style={anim(10)}>
        <path d={wave(166, 6, 160, 1)} fill="#154657" />
      </g>
      <g className="art-slide" style={anim(6)}>
        <path d={wave(183, 7, 80, 2)} fill="#0e3444" />
        <path d={line(183, 7, 80, 2)} fill="none" stroke="#d6f0f5" strokeOpacity="0.4" strokeWidth="1.2" />
      </g>
      <g className="art-bird" style={anim(18, -6)}>
        <path d="M60 40 q4 -4 8 0 q4 -4 8 0" fill="none" stroke="#1a1f33" strokeWidth="1.2" />
        <path d="M80 30 q3 -3 6 0 q3 -3 6 0" fill="none" stroke="#1a1f33" strokeWidth="1" />
      </g>
    </Frame>
  );
}

function ForestArt({ u }: { u: string }) {
  return (
    <Frame>
      <defs>
        <linearGradient id={`${u}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0e2620" />
          <stop offset="0.55" stopColor="#4f7f64" />
          <stop offset="1" stopColor="#cfe0b8" />
        </linearGradient>
        <radialGradient id={`${u}sun`}>
          <stop offset="0" stopColor="#fff2c4" stopOpacity="0.7" />
          <stop offset="1" stopColor="#fff2c4" stopOpacity="0" />
        </radialGradient>
        <filter id={`${u}b`}>
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>
      <rect width="320" height="200" fill={`url(#${u}sky)`} />
      <circle cx="244" cy="38" r="90" fill={`url(#${u}sun)`} />
      <polygon className="art-sun" points="236,0 262,0 170,200 120,200" fill="#fff6d0" opacity="0.1" style={anim(7)} />
      <polygon className="art-sun" points="270,0 284,0 250,200 222,200" fill="#fff6d0" opacity="0.08" style={anim(9, -3)} />
      <path d="M0 122 L40 92 L85 112 L130 72 L180 106 L225 82 L270 102 L320 76 L320 200 L0 200 Z" fill="#45725c" opacity="0.75" />
      <path d={FOREST_FAR} fill="#2e5746" />
      <ellipse className="art-fog" cx="100" cy="152" rx="170" ry="14" fill="#e7f2e4" opacity="0.24" filter={`url(#${u}b)`} style={anim(14)} />
      <path d={FOREST_MID} fill="#1d3e31" />
      <ellipse className="art-fog" cx="230" cy="178" rx="190" ry="12" fill="#e7f2e4" opacity="0.18" filter={`url(#${u}b)`} style={anim(18, -7)} />
      <path d={FOREST_NEAR} fill="#0e241b" />
      <g className="art-bird" style={anim(14)}>
        <path d="M40 50 q4 -4 8 0 q4 -4 8 0" fill="none" stroke="#16302a" strokeWidth="1.2" />
        <path d="M62 42 q3 -3 6 0 q3 -3 6 0" fill="none" stroke="#16302a" strokeWidth="1" />
        <path d="M52 60 q3 -3 6 0 q3 -3 6 0" fill="none" stroke="#16302a" strokeWidth="1" />
      </g>
    </Frame>
  );
}

function FireArt({ u }: { u: string }) {
  return (
    <Frame>
      <defs>
        <radialGradient id={`${u}bg`} cx="50%" cy="85%" r="80%">
          <stop offset="0" stopColor="#5a1e0a" />
          <stop offset="0.5" stopColor="#1e0b06" />
          <stop offset="1" stopColor="#0a0403" />
        </radialGradient>
        <pattern id={`${u}brick`} width="40" height="20" patternUnits="userSpaceOnUse">
          <path d="M0 0.5 H40 M0 10.5 H40 M20 0 V10 M0.5 10 V20 M39.5 10 V20" stroke="#5a2a18" strokeOpacity="0.45" fill="none" />
        </pattern>
        <radialGradient id={`${u}glow`}>
          <stop offset="0" stopColor="#ff9a3d" stopOpacity="0.75" />
          <stop offset="1" stopColor="#ff6a1a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${u}f`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#ffe27a" />
          <stop offset="0.5" stopColor="#ff8a2a" />
          <stop offset="1" stopColor="#d9361a" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id={`${u}fi`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#fffbe0" />
          <stop offset="1" stopColor="#ffc24a" stopOpacity="0.8" />
        </linearGradient>
      </defs>
      <rect width="320" height="200" fill={`url(#${u}bg)`} />
      <rect width="320" height="200" fill={`url(#${u}brick)`} />
      <rect x="36" y="52" width="248" height="14" rx="2" fill="#2a130b" />
      <path d="M62 200 V112 Q62 72 160 72 Q258 72 258 112 V200 Z" fill="#0b0503" />
      <ellipse className="art-sun" cx="160" cy="176" rx="100" ry="54" fill={`url(#${u}glow)`} style={anim(1.8)} />
      {FLAMES.map((fl, i) => (
        <path
          key={i}
          className="art-flame"
          d={fl.d}
          fill={`url(#${u}${fl.inner ? 'fi' : 'f'})`}
          style={anim(fl.dur, fl.delay)}
        />
      ))}
      <g>
        <rect x="98" y="172" width="124" height="16" rx="8" fill="#4a2a18" transform="rotate(-7 160 180)" />
        <rect x="104" y="178" width="118" height="15" rx="7.5" fill="#3a1f12" transform="rotate(8 160 185)" />
        <circle cx="104" cy="186" r="7" fill="#7a4a2a" />
        <circle cx="218" cy="190" r="7" fill="#6a3d22" />
      </g>
      {EMBERS.map((e, i) => (
        <circle key={i} className="art-ember" cx={n(e.cx)} cy={n(e.cy)} r="1.3" fill="#ffc070" style={anim(e.dur, e.delay)} />
      ))}
    </Frame>
  );
}

const GREY_FOG = Array.from({ length: 6 }, (_, i) => ({
  cx: rand(i + 230) * 320,
  cy: 40 + rand(i + 240) * 120,
  rx: 60 + rand(i + 250) * 60,
  ry: 14 + rand(i + 260) * 12,
}));

function GreyArt({ u }: { u: string }) {
  return (
    <Frame>
      <defs>
        <linearGradient id={`${u}bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1c1f24" />
          <stop offset="0.55" stopColor="#4a4f57" />
          <stop offset="1" stopColor="#8b9099" />
        </linearGradient>
        <filter id={`${u}b`}>
          <feGaussianBlur stdDeviation="8" />
        </filter>
      </defs>
      <rect width="320" height="200" fill={`url(#${u}bg)`} />
      <g filter={`url(#${u}b)`}>
        {GREY_FOG.map((f, i) => (
          <ellipse
            key={i}
            className="art-fog"
            cx={n(f.cx)}
            cy={n(f.cy)}
            rx={n(f.rx)}
            ry={n(f.ry)}
            fill="#dfe3e8"
            opacity="0.16"
            style={anim(10 + i * 2, -i * 1.5)}
          />
        ))}
      </g>
      {[0, 1, 2, 3].map((i) => (
        <g key={i} className="art-slide" style={anim(12 + i * 5)}>
          <path
            d={line(70 + i * 22, 10 - i * 1.5, i % 2 ? 160 : 320, i)}
            fill="none"
            stroke="#f1f3f5"
            strokeOpacity={0.75 - i * 0.15}
            strokeWidth="1.4"
          />
        </g>
      ))}
    </Frame>
  );
}

const SKY_CLOUDS = Array.from({ length: 6 }, (_, i) => ({
  x: (i / 6) * 320 + rand(i + 270) * 20,
  y: 118 + rand(i + 280) * 40,
  s: 0.7 + rand(i + 290) * 0.8,
}));

function AirplaneArt({ u }: { u: string }) {
  const hole =
    'M104 18 H216 A56 56 0 0 1 272 74 V126 A56 56 0 0 1 216 182 H104 A56 56 0 0 1 48 126 V74 A56 56 0 0 1 104 18 Z';
  return (
    <Frame>
      <defs>
        <linearGradient id={`${u}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f6fb0" />
          <stop offset="0.6" stopColor="#8cc3ee" />
          <stop offset="1" stopColor="#e6f3ff" />
        </linearGradient>
        <linearGradient id={`${u}wall`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e7ebef" />
          <stop offset="1" stopColor="#aab4be" />
        </linearGradient>
        <clipPath id={`${u}clip`}>
          <path d={hole} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${u}clip)`}>
        <rect width="320" height="200" fill={`url(#${u}sky)`} />
        <g className="art-slide" style={anim(22)}>
          {[0, 320].map((off) =>
            SKY_CLOUDS.map((c, i) => (
              <g key={`${off}-${i}`} fill="#fff" opacity="0.92">
                <circle cx={n(c.x + off)} cy={n(c.y)} r={n(16 * c.s)} />
                <circle cx={n(c.x + off + 18 * c.s)} cy={n(c.y - 8 * c.s)} r={n(20 * c.s)} />
                <circle cx={n(c.x + off + 40 * c.s)} cy={n(c.y)} r={n(15 * c.s)} />
                <ellipse cx={n(c.x + off + 18 * c.s)} cy={n(c.y + 6 * c.s)} rx={n(40 * c.s)} ry={n(10 * c.s)} />
              </g>
            )),
          )}
        </g>
        <path d="M40 150 L230 118 L250 122 L60 176 Z" fill="#cfd8e0" />
        <path d="M40 150 L230 118 L250 122" fill="none" stroke="#8d99a5" strokeWidth="1.5" />
        <circle className="art-glint" cx="246" cy="121" r="2.6" fill="#ff4d4d" style={anim(1.2)} />
      </g>
      <path d={`M0 0 H320 V200 H0 Z ${hole}`} fill={`url(#${u}wall)`} fillRule="evenodd" />
      <path d={hole} fill="none" stroke="#8e99a4" strokeWidth="5" />
      <path d={hole} fill="none" stroke="#fff" strokeOpacity="0.6" strokeWidth="1.2" transform="translate(1.5 1.5)" />
    </Frame>
  );
}

const CITY_LIGHTS = Array.from({ length: 26 }, (_, i) => ({
  x: rand(i + 300) * 320,
  y: 112 + rand(i + 310) * 40,
  r: 0.8 + rand(i + 320) * 1.6,
  c: ['#fcd34d', '#fda4af', '#93c5fd'][i % 3],
}));

function TrainArt({ u }: { u: string }) {
  const holes =
    'M28 22 H144 A12 12 0 0 1 156 34 V150 A12 12 0 0 1 144 162 H28 A12 12 0 0 1 16 150 V34 A12 12 0 0 1 28 22 Z ' +
    'M176 22 H292 A12 12 0 0 1 304 34 V150 A12 12 0 0 1 292 162 H176 A12 12 0 0 1 164 150 V34 A12 12 0 0 1 176 22 Z';
  return (
    <Frame>
      <defs>
        <linearGradient id={`${u}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#070a1c" />
          <stop offset="0.7" stopColor="#1e1b4b" />
          <stop offset="1" stopColor="#312e81" />
        </linearGradient>
        <linearGradient id={`${u}streak`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fcd34d" stopOpacity="0" />
          <stop offset="1" stopColor="#fcd34d" stopOpacity="0.75" />
        </linearGradient>
        <clipPath id={`${u}clip`}>
          <path d={holes} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${u}clip)`}>
        <rect width="320" height="200" fill={`url(#${u}sky)`} />
        <circle cx="250" cy="50" r="12" fill="#f5f3ff" opacity="0.85" />
        <g className="art-slide" style={anim(26)}>
          {[0, 320].map((off) => (
            <path
              key={off}
              d={`M${off} 140 L${off + 30} 118 L${off + 60} 126 L${off + 95} 104 L${off + 140} 120 L${off + 180} 110 L${off + 230} 126 L${off + 270} 112 L${off + 320} 140 V200 H${off} Z`}
              fill="#0b0d24"
            />
          ))}
          {[0, 320].map((off) =>
            CITY_LIGHTS.map((l, i) => (
              <circle key={`${off}-${i}`} cx={n(l.x + off)} cy={n(l.y)} r={n(l.r)} fill={l.c} opacity="0.85" />
            )),
          )}
        </g>
        <g className="art-slide" style={anim(1.4)}>
          {[40, 120, 200, 280, 360, 440, 520, 600].map((x) => (
            <rect key={x} x={x} width="5" height="200" fill="#04050f" />
          ))}
        </g>
        <g className="art-slide" style={anim(2.6)}>
          {[60, 190, 380, 510].map((x, i) => (
            <rect key={x} x={x} y={150 + (i % 2) * 6} width="70" height="1.6" fill={`url(#${u}streak)`} />
          ))}
        </g>
      </g>
      <path d={`M0 0 H320 V200 H0 Z ${holes}`} fill="#15161f" fillRule="evenodd" />
      <path d={holes} fill="none" stroke="#2c2e3d" strokeWidth="3" />
      <rect y="172" width="320" height="28" fill="#1f2130" />
      <rect y="170" width="320" height="3" fill="#3a3d52" />
    </Frame>
  );
}

const STEAM = Array.from({ length: 8 }, (_, i) => ({
  cx: 120 + rand(i + 330) * 80,
  cy: 150 + rand(i + 340) * 20,
  r: 10 + rand(i + 350) * 14,
  dur: 2.6 + rand(i + 360) * 1.8,
  delay: -rand(i + 370) * 4,
}));
const JETS = Array.from({ length: 26 }, (_, i) => ({
  x: 116 + rand(i + 372) * 88,
  y: rand(i + 374) * 200,
  len: 26 + rand(i + 376) * 40,
}));
const TILES = Array.from({ length: 4 }, (_, i) => 40 + i * 40);

function ShowerArt({ u }: { u: string }) {
  return (
    <Frame>
      <defs>
        <linearGradient id={`${u}bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#12333a" />
          <stop offset="1" stopColor="#0b1f24" />
        </linearGradient>
        <linearGradient id={`${u}jet`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dff4fb" stopOpacity="0.75" />
          <stop offset="1" stopColor="#8fd3e6" stopOpacity="0.25" />
        </linearGradient>
        <radialGradient id={`${u}glow`}>
          <stop offset="0" stopColor="#d9f6ff" stopOpacity="0.28" />
          <stop offset="1" stopColor="#d9f6ff" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${u}clip`}>
          <path d="M116 44 L204 44 L216 196 L104 196 Z" />
        </clipPath>
        <filter id={`${u}b`}>
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      <rect width="320" height="200" fill={`url(#${u}bg)`} />
      {TILES.map((y) => (
        <line key={y} x1="0" y1={y} x2="320" y2={y} stroke="#2b535c" strokeOpacity="0.5" strokeWidth="1" />
      ))}
      {[40, 120, 200, 280].map((x) => (
        <line key={x} x1={x} y1="0" x2={x} y2="200" stroke="#2b535c" strokeOpacity="0.35" strokeWidth="1" />
      ))}
      <circle cx="160" cy="120" r="110" fill={`url(#${u}glow)`} />
      {/* shower arm and head */}
      <path d="M160 0 V22 Q160 34 172 34" fill="none" stroke="#cfdde1" strokeWidth="6" strokeLinecap="round" />
      <ellipse cx="180" cy="38" rx="26" ry="9" fill="#e6eef0" />
      <ellipse cx="180" cy="42" rx="24" ry="7" fill="#b9c8cd" />
      <path d="M116 44 L204 44 L216 196 L104 196 Z" fill={`url(#${u}jet)`} opacity="0.5" />
      <g clipPath={`url(#${u}clip)`}>
        <g className="art-rain" style={anim(0.7)}>
          {[0, 200].map((off) =>
            JETS.map((j, i) => (
              <line
                key={`${off}-${i}`}
                x1={n(j.x)}
                y1={n(j.y + off)}
                x2={n(j.x + 3)}
                y2={n(j.y + off + j.len)}
                stroke="#eaf9ff"
                strokeOpacity="0.5"
                strokeWidth="1.3"
              />
            )),
          )}
        </g>
      </g>
      <ellipse cx="160" cy="194" rx="86" ry="12" fill="#7fc6d8" opacity="0.4" />
      <g filter={`url(#${u}b)`}>
        {STEAM.map((m, i) => (
          <circle key={i} className="art-mist" cx={n(m.cx)} cy={n(m.cy)} r={n(m.r)} fill="#eafaff" style={anim(m.dur, m.delay)} />
        ))}
      </g>
    </Frame>
  );
}

const STREAM_TREES = pines(600, 112, 34, 70, 16);
const FLOW_LINES = Array.from({ length: 22 }, (_, i) => ({
  x: 100 + rand(i + 380) * 130,
  y: rand(i + 390) * 200,
  w: 8 + rand(i + 400) * 14,
}));
const ROCKS = [
  [120, 170, 16, 8],
  [210, 150, 12, 6],
  [172, 188, 20, 9],
  [150, 132, 9, 4],
];

function StreamArt({ u }: { u: string }) {
  const water = 'M138 108 C156 128 116 150 84 200 L256 200 C224 160 186 130 176 108 Z';
  return (
    <Frame>
      <defs>
        <linearGradient id={`${u}bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0f2a24" />
          <stop offset="1" stopColor="#35644f" />
        </linearGradient>
        <linearGradient id={`${u}w`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8fd3df" />
          <stop offset="1" stopColor="#2c7a8c" />
        </linearGradient>
        <clipPath id={`${u}clip`}>
          <path d={water} />
        </clipPath>
      </defs>
      <rect width="320" height="200" fill={`url(#${u}bg)`} />
      <path d={STREAM_TREES} fill="#1b3d31" />
      <rect y="104" width="320" height="96" fill="#284b3a" />
      <path d="M0 140 C40 130 70 150 100 160 L84 200 H0 Z" fill="#1f3b2e" />
      <path d="M320 132 C280 128 240 150 232 170 L256 200 H320 Z" fill="#1f3b2e" />
      <path d={water} fill={`url(#${u}w)`} />
      <g clipPath={`url(#${u}clip)`}>
        <g className="art-rain" style={anim(3.2)}>
          {[0, 200].map((off) =>
            FLOW_LINES.map((l, i) => (
              <path
                key={`${off}-${i}`}
                d={`M${n(l.x)} ${n(l.y + off)} q${n(l.w / 2)} 3 ${n(l.w)} 0`}
                fill="none"
                stroke="#e6fbff"
                strokeOpacity="0.55"
                strokeWidth="1.2"
              />
            )),
          )}
        </g>
      </g>
      {ROCKS.map(([cx, cy, rx, ry], i) => (
        <g key={i}>
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#4b5563" />
          <ellipse cx={cx - rx * 0.25} cy={cy - ry * 0.35} rx={rx * 0.5} ry={ry * 0.4} fill="#6b7280" />
          <path
            className="art-glint"
            d={`M${cx - rx - 4} ${cy + 1} q${rx + 4} ${-(ry + 5)} ${2 * rx + 8} 0`}
            fill="none"
            stroke="#fff"
            strokeOpacity="0.7"
            strokeWidth="1.2"
            style={anim(1.4, -i * 0.3)}
          />
        </g>
      ))}
    </Frame>
  );
}

const FALL_LINES = Array.from({ length: 18 }, (_, i) => ({
  x: 124 + rand(i + 410) * 72,
  y: rand(i + 420) * 200,
  len: 20 + rand(i + 430) * 40,
}));
const SPRAY = Array.from({ length: 8 }, (_, i) => ({
  cx: 130 + rand(i + 440) * 60,
  cy: 160 + rand(i + 450) * 14,
  r: 8 + rand(i + 460) * 10,
  dur: 2 + rand(i + 470) * 2,
  delay: -rand(i + 480) * 3,
}));

function WaterfallArt({ u }: { u: string }) {
  return (
    <Frame>
      <defs>
        <linearGradient id={`${u}bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1d3b37" />
          <stop offset="1" stopColor="#0c1a19" />
        </linearGradient>
        <linearGradient id={`${u}fall`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#9fd8ee" />
          <stop offset="0.5" stopColor="#f4fdff" />
          <stop offset="1" stopColor="#9fd8ee" />
        </linearGradient>
        <radialGradient id={`${u}pool`}>
          <stop offset="0" stopColor="#5fb3c6" />
          <stop offset="1" stopColor="#1d5361" />
        </radialGradient>
        <clipPath id={`${u}clip`}>
          <rect x="122" width="76" height="176" />
        </clipPath>
        <filter id={`${u}b`}>
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      <rect width="320" height="200" fill={`url(#${u}bg)`} />
      <path d="M0 0 H124 L114 60 L128 120 L108 176 L0 190 Z" fill="#2b3a36" />
      <path d="M320 0 H196 L208 70 L192 140 L212 176 L320 190 Z" fill="#23302d" />
      <ellipse cx="50" cy="8" rx="80" ry="22" fill="#2f5a3f" />
      <ellipse cx="275" cy="6" rx="80" ry="20" fill="#2a5238" />
      <rect x="122" width="76" height="176" fill={`url(#${u}fall)`} opacity="0.9" />
      <g clipPath={`url(#${u}clip)`}>
        <g className="art-rain" style={anim(0.9)}>
          {[0, 200].map((off) =>
            FALL_LINES.map((l, i) => (
              <line
                key={`${off}-${i}`}
                x1={n(l.x)}
                y1={n(l.y + off)}
                x2={n(l.x)}
                y2={n(l.y + off + l.len)}
                stroke="#fff"
                strokeOpacity="0.55"
                strokeWidth="1.4"
              />
            )),
          )}
        </g>
      </g>
      <ellipse cx="160" cy="188" rx="150" ry="24" fill={`url(#${u}pool)`} />
      <g filter={`url(#${u}b)`}>
        {SPRAY.map((m, i) => (
          <circle key={i} className="art-mist" cx={n(m.cx)} cy={n(m.cy)} r={n(m.r)} fill="#f0fdff" style={anim(m.dur, m.delay)} />
        ))}
      </g>
    </Frame>
  );
}

const NIGHT_STARS = Array.from({ length: 34 }, (_, i) => ({
  cx: rand(i + 490) * 320,
  cy: rand(i + 500) * 110,
  r: 0.5 + rand(i + 510) * 1.1,
  dur: 1.5 + rand(i + 520) * 2.5,
  delay: -rand(i + 530) * 3,
}));
const NIGHT_FLIES = Array.from({ length: 9 }, (_, i) => ({
  cx: 20 + rand(i + 540) * 280,
  cy: 130 + rand(i + 550) * 50,
  dur: 1.8 + rand(i + 560) * 2,
  delay: -rand(i + 570) * 3,
}));
let grass = 'M0 200 L0 178';
for (let x = 0; x <= 320; x += 5) grass += ` L${x} ${n(170 - rand(x + 580) * 18)} L${x + 2.5} 180`;
const NIGHT_GRASS = `${grass} L320 200 Z`;

function NightArt({ u }: { u: string }) {
  return (
    <Frame>
      <defs>
        <linearGradient id={`${u}bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#050816" />
          <stop offset="0.6" stopColor="#141a45" />
          <stop offset="1" stopColor="#2a2760" />
        </linearGradient>
        <radialGradient id={`${u}moon`}>
          <stop offset="0" stopColor="#fef9c3" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fef9c3" stopOpacity="0" />
        </radialGradient>
        <filter id={`${u}g`}>
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
      </defs>
      <rect width="320" height="200" fill={`url(#${u}bg)`} />
      {NIGHT_STARS.map((st, i) => (
        <circle key={i} className="art-glint" cx={n(st.cx)} cy={n(st.cy)} r={n(st.r)} fill="#fff" style={anim(st.dur, st.delay)} />
      ))}
      <circle cx="252" cy="44" r="46" fill={`url(#${u}moon)`} />
      <circle cx="252" cy="44" r="15" fill="#fef9c3" />
      <path d="M0 158 C60 128 110 150 160 140 S260 118 320 148 V200 H0 Z" fill="#0b1030" />
      <path d={NIGHT_GRASS} fill="#05070f" />
      <g filter={`url(#${u}g)`}>
        {NIGHT_FLIES.map((ff, i) => (
          <circle key={i} className="art-glint" cx={n(ff.cx)} cy={n(ff.cy)} r="2.4" fill="#fde68a" style={anim(ff.dur, ff.delay)} />
        ))}
      </g>
    </Frame>
  );
}

const WIND_CLOUDS = Array.from({ length: 5 }, (_, i) => ({
  x: (i / 5) * 320 + rand(i + 600) * 30,
  y: 24 + rand(i + 610) * 40,
  s: 0.6 + rand(i + 620) * 0.6,
}));
let blades = '';
for (let x = 0; x <= 320; x += 6) {
  const h = 16 + rand(x + 630) * 20;
  blades += `M${x} 200 Q${x + 3} ${n(200 - h * 0.6)} ${x + 8} ${n(200 - h)} Q${x + 4} ${n(200 - h * 0.5)} ${x + 4} 200 Z `;
}
const WIND_GRASS = blades;

function WindArt({ u }: { u: string }) {
  return (
    <Frame>
      <defs>
        <linearGradient id={`${u}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1e293b" />
          <stop offset="0.6" stopColor="#5b6b86" />
          <stop offset="1" stopColor="#c7d2e0" />
        </linearGradient>
      </defs>
      <rect width="320" height="200" fill={`url(#${u}sky)`} />
      <g className="art-slide" style={anim(30)}>
        {[0, 320].map((off) =>
          WIND_CLOUDS.map((c, i) => (
            <ellipse
              key={`${off}-${i}`}
              cx={n(c.x + off)}
              cy={n(c.y)}
              rx={n(44 * c.s)}
              ry={n(8 * c.s)}
              fill="#e2e8f0"
              opacity="0.45"
            />
          )),
        )}
      </g>
      <path d="M0 150 L50 100 L90 130 L150 70 L205 120 L250 95 L320 135 V200 H0 Z" fill="#3b4a60" />
      <path d="M150 70 L136 86 L150 81 L163 88 Z" fill="#e5e9f0" />
      <path d="M50 100 L41 110 L51 107 L59 112 Z" fill="#e5e9f0" />
      <path d="M0 172 C80 152 200 176 320 160 V200 H0 Z" fill="#243044" />
      <g className="art-sway" style={anim(2.2)}>
        <path d={WIND_GRASS} fill="#1a2536" />
      </g>
      {[48, 88, 118, 142].map((y, i) => (
        <path
          key={y}
          className="art-wind"
          d={`M${-20 + i * 30} ${y} q30 -8 60 0 t60 0 t60 0`}
          fill="none"
          stroke="#fff"
          strokeOpacity="0.5"
          strokeWidth="1.3"
          strokeLinecap="round"
          style={anim(1.2 + i * 0.25, -i * 0.4)}
        />
      ))}
    </Frame>
  );
}

export default function SoundArt({ kind, live }: { kind: NoiseKind | NatureKind; live: boolean }) {
  // SVG ids must be unique per card and valid inside url(#…)
  const u = `a${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  switch (kind) {
    case 'white':
      return <WhiteArt u={u} live={live} />;
    case 'pink':
      return <PinkArt u={u} />;
    case 'brown':
      return <BrownArt u={u} />;
    case 'fan':
      return <FanArt u={u} live={live} />;
    case 'grey':
      return <GreyArt u={u} />;
    case 'shower':
      return <ShowerArt u={u} />;
    case 'airplane':
      return <AirplaneArt u={u} />;
    case 'train':
      return <TrainArt u={u} />;
    case 'stream':
      return <StreamArt u={u} />;
    case 'waterfall':
      return <WaterfallArt u={u} />;
    case 'night':
      return <NightArt u={u} />;
    case 'wind':
      return <WindArt u={u} />;
    case 'rain':
      return <RainArt u={u} />;
    case 'ocean':
      return <OceanArt u={u} />;
    case 'forest':
      return <ForestArt u={u} />;
    default:
      return <FireArt u={u} />;
  }
}
