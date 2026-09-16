import { useState, type CSSProperties } from 'react';
import type { Phase, TimerStatus } from '../types';
import { SCENE_THEME, type SceneId } from '../audio/scenes';
import type { ThunderFlash } from '../hooks/useSoundscape';

interface Props {
  phase: Phase;
  status: TimerStatus;
  particles: boolean;
  /** Clockwork gears and astrolabe. */
  gears: boolean;
  /** Scenery that follows the active sound. */
  scenery: boolean;
  /** Coloured glows, grid and vignette. */
  glow: boolean;
  /** Scenery for the active sound (rain, ocean, forest…), or null for the plain backdrop. */
  scene: SceneId | null;
  rainIntensity: number;
  flash: ThunderFlash | null;
}

const PARTICLE_COUNT = 22;
const TAU = Math.PI * 2;

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

const f = (n: number) => n.toFixed(2);

// All gears share one tooth module so neighbours actually mesh.
const MODULE = 7;
const pitchR = (teeth: number) => (teeth * MODULE) / 2;

/** SVG path for a clockwork gear centred on (0,0): symmetric teeth (tooth centred on angle 0), spoked windows. */
function gearPath(teeth: number) {
  const rp = pitchR(teeth);
  const rOuter = rp + MODULE;
  const rRoot = rp - MODULE * 1.15;
  const rHub = Math.max(8, rp * 0.1);
  const spokes = teeth >= 30 ? 6 : teeth >= 16 ? 5 : 3;
  const step = TAU / teeth;
  let d = '';
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const pts: [number, number][] = [
      [rRoot, a - step * 0.3],
      [rOuter, a - step * 0.12],
      [rOuter, a + step * 0.12],
      [rRoot, a + step * 0.3],
    ];
    pts.forEach(([r, t], j) => {
      d += `${i === 0 && j === 0 ? 'M' : 'L'}${f(Math.cos(t) * r)} ${f(Math.sin(t) * r)}`;
    });
  }
  d += 'Z';
  // window cut-outs between spokes (even-odd fill)
  const rim = rRoot * 0.78;
  const inner = rHub * 1.6;
  const gap = teeth >= 16 ? 0.16 : 0.32;
  for (let s = 0; s < spokes; s++) {
    const a0 = (s / spokes) * TAU + gap;
    const a1 = ((s + 1) / spokes) * TAU - gap;
    d += `M${f(Math.cos(a0) * inner)} ${f(Math.sin(a0) * inner)}`;
    d += `L${f(Math.cos(a0) * rim)} ${f(Math.sin(a0) * rim)}`;
    d += `A${f(rim)} ${f(rim)} 0 0 1 ${f(Math.cos(a1) * rim)} ${f(Math.sin(a1) * rim)}`;
    d += `L${f(Math.cos(a1) * inner)} ${f(Math.sin(a1) * inner)}`;
    d += `A${f(inner)} ${f(inner)} 0 0 0 ${f(Math.cos(a0) * inner)} ${f(Math.sin(a0) * inner)}Z`;
  }
  // axle hole
  d += `M${f(rHub)} 0A${f(rHub)} ${f(rHub)} 0 1 0 ${f(-rHub)} 0A${f(rHub)} ${f(rHub)} 0 1 0 ${f(rHub)} 0Z`;
  return d;
}

interface Gear {
  x: number;
  y: number;
  teeth: number;
  /** initial rotation (radians) so the teeth interleave with the parent */
  phase: number;
  dir: 1 | -1;
}

/** Place a gear meshing with `parent` in direction `deg`, with its teeth phased into the parent's gaps. */
function meshWith(parent: Gear, teeth: number, deg: number): Gear {
  const psi = (deg * Math.PI) / 180;
  const dist = pitchR(parent.teeth) + pitchR(teeth);
  const sP = TAU / parent.teeth;
  const sC = TAU / teeth;
  const u = ((((psi - parent.phase) / sP) % 1) + 1) % 1; // parent tooth offset at the contact point
  return {
    x: parent.x + Math.cos(psi) * dist,
    y: parent.y + Math.sin(psi) * dist,
    teeth,
    phase: psi + Math.PI - sC * (0.5 - u),
    dir: parent.dir === 1 ? -1 : 1,
  };
}

const trainA: Gear = { x: 180, y: 250, teeth: 36, phase: 0, dir: 1 };
const trainA2 = meshWith(trainA, 20, -32);
const trainE: Gear = { x: 1310, y: 770, teeth: 44, phase: 0.1, dir: -1 };
const trainE2 = meshWith(trainE, 24, 198);

// seconds per revolution ∝ tooth count, so meshed gears roll together without slipping
const GEARS = [
  trainA,
  trainA2,
  meshWith(trainA, 13, 62),
  meshWith(trainA2, 12, 20),
  trainE,
  trainE2,
  meshWith(trainE, 16, -62),
  meshWith(trainE2, 12, 130),
].map((g) => ({ ...g, d: gearPath(g.teeth), speed: g.teeth * 2.4 }));

const ROMAN = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

// ---------------------------------------------------------------------------
// Sound scenery — animated backdrops that follow the active background sound
// ---------------------------------------------------------------------------

const RAIN = Array.from({ length: 170 }, (_, i) => ({
  left: rand(i + 900) * 100,
  delay: -rand(i + 1000) * 2,
  dur: 0.45 + rand(i + 1100) * 0.35,
  len: 40 + rand(i + 1200) * 70,
  far: i % 3 === 0,
  opacity: 0.3 + rand(i + 1300) * 0.6,
}));

const CLOUDS = Array.from({ length: 7 }, (_, i) => ({
  left: -10 + i * 17 + rand(i + 1400) * 8,
  top: rand(i + 1500) * 14,
  w: 28 + rand(i + 1600) * 22,
  h: 14 + rand(i + 1700) * 12,
  dur: 30 + rand(i + 1800) * 30,
}));

/** Horizontally periodic wave strip (3200 wide, repeats every 1600) for seamless scrolling. */
function wavePath(wl: number, amp: number, y: number, phase = 0) {
  let d = `M0 400 L0 ${f(y + Math.sin(phase) * amp)}`;
  for (let x = 20; x <= 3200; x += 20) d += ` L${x} ${f(y + Math.sin((x / wl) * TAU + phase) * amp)}`;
  return `${d} L3200 400 Z`;
}

const WAVES = [
  { d: wavePath(400, 22, 120), dur: 26, cls: 'w1' },
  { d: wavePath(320, 16, 190, 1.3), dur: 18, cls: 'w2' },
  { d: wavePath(200, 12, 260, 2.1), dur: 12, cls: 'w3' },
];

function pine(x: number, base: number, h: number, w: number) {
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
  return `M${pts.map(([a, b]) => `${f(a)} ${f(b)}`).join(' L')} Z`;
}

function treeLine(seed: number, step: number, hMin: number, hMax: number) {
  let d = '';
  let x = -40;
  let i = 0;
  while (x < 1660) {
    const h = hMin + rand(seed + i) * (hMax - hMin);
    d += pine(x, 402, h, h * 0.42);
    x += step * (0.6 + rand(seed + i + 50) * 0.8);
    i++;
  }
  return d;
}

const FOREST_FAR = treeLine(2000, 46, 110, 220);
const FOREST_NEAR = treeLine(3000, 80, 160, 330);

const FIREFLIES = Array.from({ length: 24 }, (_, i) => ({
  left: 5 + rand(i + 2100) * 90,
  top: 45 + rand(i + 2200) * 47,
  size: 2.5 + rand(i + 2300) * 2,
  dur: 7 + rand(i + 2400) * 8,
  blink: 2 + rand(i + 2500) * 2,
  delay: -rand(i + 2600) * 10,
  dx: (rand(i + 2700) - 0.5) * 120,
  dy: (rand(i + 2800) - 0.5) * 80,
}));

const EMBERS = Array.from({ length: 36 }, (_, i) => ({
  left: 25 + rand(i + 3100) * 50,
  size: 1.5 + rand(i + 3200) * 2.5,
  dur: 4 + rand(i + 3300) * 5,
  delay: -rand(i + 3400) * 9,
  drift: (rand(i + 3500) - 0.5) * 160,
}));

type NoiseScene = 'white' | 'pink' | 'brown' | 'grey' | 'airplane' | 'train';

function ribbonPath(wl: number, amp: number, phase: number) {
  let d = `M0 ${f(200 + Math.sin(phase) * amp)}`;
  for (let x = 10; x <= 3200; x += 10) d += ` L${x} ${f(200 + Math.sin((x / wl) * TAU + phase) * amp)}`;
  return d;
}

const RIBBONS: Record<NoiseScene, { paths: string[]; speed: number }> = {
  white: { paths: [0, 1, 2].map((i) => ribbonPath(80, 26 * (1 - i * 0.25), i * 1.7)), speed: 7 },
  grey: { paths: [0, 1, 2].map((i) => ribbonPath(320, 42 * (1 - i * 0.25), i * 1.7)), speed: 20 },
  airplane: { paths: [0, 1, 2].map((i) => ribbonPath(800, 60 * (1 - i * 0.25), i * 1.7)), speed: 40 },
  train: { paths: [0, 1, 2].map((i) => ribbonPath(200, 30 * (1 - i * 0.25), i * 1.7)), speed: 5 },
  pink: { paths: [0, 1, 2].map((i) => ribbonPath(200, 55 * (1 - i * 0.25), i * 1.7)), speed: 14 },
  brown: { paths: [0, 1, 2].map((i) => ribbonPath(400, 85 * (1 - i * 0.25), i * 1.7)), speed: 24 },
};

let grainUrl: string | null = null;
/** A small tile of random grey pixels, generated once, for a TV-static texture. */
function getGrain() {
  if (grainUrl || typeof document === 'undefined') return grainUrl;
  const c = document.createElement('canvas');
  c.width = c.height = 140;
  const g = c.getContext('2d');
  if (!g) return null;
  const img = g.createImageData(140, 140);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  grainUrl = c.toDataURL();
  return grainUrl;
}

function RainScene({ intensity, storm }: { intensity: number; storm: boolean }) {
  const count = Math.round(40 + 130 * intensity);
  const speed = 1.25 - 0.45 * intensity;
  return (
    <>
      {storm && (
        <div className="clouds">
          {CLOUDS.map((c, i) => (
            <span
              key={i}
              className="cloud"
              style={{
                left: `${c.left}%`,
                top: `${c.top}vh`,
                width: `${c.w}vw`,
                height: `${c.h}vh`,
                animationDuration: `${c.dur}s`,
              }}
            />
          ))}
        </div>
      )}
      <div className="rain-layer">
        {RAIN.slice(0, count).map((d, i) => (
          <span
            key={i}
            className={`drop${d.far ? ' far' : ''}`}
            style={{
              left: `${d.left}%`,
              height: `${d.far ? d.len * 0.6 : d.len}px`,
              opacity: d.opacity,
              animationDuration: `${(d.far ? d.dur * 1.5 : d.dur) * speed}s`,
              animationDelay: `${d.delay}s`,
            }}
          />
        ))}
      </div>
      <div className="rain-mist" />
    </>
  );
}

function OceanScene() {
  return (
    <>
      <div className="shimmer" />
      <div className="waves">
        {WAVES.map((w) => (
          <svg
            key={w.cls}
            className={`wave ${w.cls}`}
            viewBox="0 0 3200 400"
            preserveAspectRatio="none"
            style={{ animationDuration: `${w.dur}s` }}
          >
            <path d={w.d} />
          </svg>
        ))}
      </div>
    </>
  );
}

function ForestScene() {
  return (
    <>
      <div className="rays">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="ray"
            style={{ left: `${6 + i * 21}%`, rotate: `${22 - i * 3}deg`, animationDelay: `${-i * 2.3}s` }}
          />
        ))}
      </div>
      <svg className="trees" viewBox="0 0 1600 400" preserveAspectRatio="xMidYMax slice">
        <path className="far" d={FOREST_FAR} />
        <path className="near" d={FOREST_NEAR} />
      </svg>
      {FIREFLIES.map((ff, i) => (
        <span
          key={i}
          className="firefly"
          style={
            {
              left: `${ff.left}%`,
              top: `${ff.top}%`,
              width: `${ff.size}px`,
              height: `${ff.size}px`,
              animationDuration: `${ff.dur}s, ${ff.blink}s`,
              animationDelay: `${ff.delay}s, ${ff.delay * 0.7}s`,
              '--dx': `${ff.dx}px`,
              '--dy': `${ff.dy}px`,
            } as CSSProperties
          }
        />
      ))}
    </>
  );
}

function FireScene() {
  return (
    <>
      <div className="fire-glow" />
      {EMBERS.map((e, i) => (
        <span
          key={i}
          className="ember"
          style={
            {
              left: `${e.left}%`,
              width: `${e.size}px`,
              height: `${e.size}px`,
              animationDuration: `${e.dur}s`,
              animationDelay: `${e.delay}s`,
              '--drift': `${e.drift}px`,
            } as CSSProperties
          }
        />
      ))}
    </>
  );
}

function FanArt() {
  return (
    <svg className="fan-art" viewBox="0 0 400 400" aria-hidden="true">
      <g transform="translate(200 200)">
        {[190, 160, 130, 100, 70].map((r) => (
          <circle key={r} r={r} fill="none" stroke="currentColor" strokeWidth="2" />
        ))}
        {Array.from({ length: 16 }).map((_, i) => {
          const a = (i / 16) * TAU;
          return (
            <line
              key={i}
              x1={f(Math.cos(a) * 40)}
              y1={f(Math.sin(a) * 40)}
              x2={f(Math.cos(a) * 190)}
              y2={f(Math.sin(a) * 190)}
              stroke="currentColor"
              strokeWidth="1.5"
            />
          );
        })}
        <g className="fan-spin">
          {[0, 120, 240].map((r) => (
            <path
              key={r}
              transform={`rotate(${r})`}
              d="M0 -12 C -30 -60, -10 -150, 40 -160 C 70 -120, 50 -50, 12 -8 Z"
              fill="currentColor"
            />
          ))}
          <circle r="22" fill="currentColor" />
        </g>
      </g>
    </svg>
  );
}

const PUFFS = Array.from({ length: 14 }, (_, i) => ({
  left: 8 + rand(i + 4100) * 84,
  size: 120 + rand(i + 4200) * 220,
  dur: 9 + rand(i + 4300) * 9,
  delay: -rand(i + 4400) * 18,
}));

/** Soft aerosol clouds drifting up the page for the nebulizer. */
function MistArt() {
  return (
    <div className="mist">
      {PUFFS.map((p, i) => (
        <span
          key={i}
          className="puff"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            animationDuration: `${p.dur}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

function NoiseSceneArt({ kind }: { kind: NoiseScene | 'fan' | 'shower' }) {
  const grain = getGrain();
  return (
    <>
      <div className="grain" style={grain ? { backgroundImage: `url(${grain})` } : undefined} />
      {kind === 'fan' ? (
        <FanArt />
      ) : kind === 'shower' ? (
        <MistArt />
      ) : (
        <div className="ribbons">
          {RIBBONS[kind].paths.map((d, i) => (
            <svg
              key={i}
              className="ribbon"
              viewBox="0 0 3200 400"
              preserveAspectRatio="none"
              style={{ animationDuration: `${RIBBONS[kind].speed * (1 + i * 0.6)}s`, opacity: 1 - i * 0.28 }}
            >
              <path d={d} />
            </svg>
          ))}
        </div>
      )}
    </>
  );
}

const STARS = Array.from({ length: 70 }, (_, i) => ({
  left: rand(i + 5100) * 100,
  top: rand(i + 5200) * 62,
  size: 1 + rand(i + 5300) * 1.8,
  dur: 2 + rand(i + 5400) * 4,
  delay: -rand(i + 5500) * 6,
}));

const MEADOW = (() => {
  let d = 'M0 400 L0 350';
  for (let x = 0; x <= 1600; x += 10) {
    const h = 18 + rand(x + 6600) * 46;
    d += ` L${x} ${f(360 - h)} L${x + 5} 362`;
  }
  return `${d} L1600 400 Z`;
})();

function NightScene() {
  return (
    <>
      {STARS.map((st, i) => (
        <span
          key={i}
          className="star"
          style={{
            left: `${st.left}%`,
            top: `${st.top}%`,
            width: `${st.size}px`,
            height: `${st.size}px`,
            animationDuration: `${st.dur}s`,
            animationDelay: `${st.delay}s`,
          }}
        />
      ))}
      <svg className="meadow" viewBox="0 0 1600 400" preserveAspectRatio="none">
        <path d={MEADOW} />
      </svg>
      {FIREFLIES.map((ff, i) => (
        <span
          key={i}
          className="firefly"
          style={
            {
              left: `${ff.left}%`,
              top: `${ff.top}%`,
              width: `${ff.size}px`,
              height: `${ff.size}px`,
              animationDuration: `${ff.dur}s, ${ff.blink}s`,
              animationDelay: `${ff.delay}s, ${ff.delay * 0.7}s`,
              '--dx': `${ff.dx}px`,
              '--dy': `${ff.dy}px`,
            } as CSSProperties
          }
        />
      ))}
    </>
  );
}

const GUSTS = Array.from({ length: 26 }, (_, i) => ({
  top: rand(i + 5600) * 92,
  width: 80 + rand(i + 5700) * 260,
  dur: 1.6 + rand(i + 5800) * 2.4,
  delay: -rand(i + 5900) * 4,
  opacity: 0.25 + rand(i + 6000) * 0.5,
}));

const LEAVES = Array.from({ length: 12 }, (_, i) => ({
  top: 20 + rand(i + 6100) * 70,
  dur: 5 + rand(i + 6200) * 5,
  delay: -rand(i + 6300) * 10,
  scale: 0.7 + rand(i + 6400) * 0.9,
}));

function WindScene() {
  return (
    <>
      {GUSTS.map((g, i) => (
        <span
          key={i}
          className="gust"
          style={{
            top: `${g.top}%`,
            width: `${g.width}px`,
            opacity: g.opacity,
            animationDuration: `${g.dur}s`,
            animationDelay: `${g.delay}s`,
          }}
        />
      ))}
      {LEAVES.map((l, i) => (
        <span
          key={i}
          className="leaf"
          style={{
            top: `${l.top}%`,
            scale: `${l.scale}`,
            animationDuration: `${l.dur}s`,
            animationDelay: `${l.delay}s`,
          }}
        />
      ))}
    </>
  );
}

const FALLS = Array.from({ length: 70 }, (_, i) => ({
  left: 36 + rand(i + 6500) * 28,
  len: 60 + rand(i + 6600) * 160,
  dur: 0.5 + rand(i + 6700) * 0.6,
  delay: -rand(i + 6800) * 1.2,
  opacity: 0.2 + rand(i + 6900) * 0.5,
}));

function WaterfallScene() {
  return (
    <>
      <div className="falls">
        {FALLS.map((d, i) => (
          <span
            key={i}
            className="fall"
            style={{
              left: `${d.left}%`,
              height: `${d.len}px`,
              opacity: d.opacity,
              animationDuration: `${d.dur}s`,
              animationDelay: `${d.delay}s`,
            }}
          />
        ))}
      </div>
      <MistArt />
    </>
  );
}

function SceneLayer({
  scene,
  rainIntensity,
  flash,
}: {
  scene: SceneId;
  rainIntensity: number;
  flash: ThunderFlash | null;
}) {
  // ignore strikes that happened before this scene appeared
  const [since] = useState(() => flash?.id ?? 0);
  const style = { '--scene-rgb': SCENE_THEME[scene].tint } as CSSProperties;
  return (
    <div className={`scene scene-${scene}`} style={style}>
      <div className="scene-tint" />
      {(scene === 'rain' || scene === 'storm') && (
        <RainScene intensity={rainIntensity} storm={scene === 'storm'} />
      )}
      {(scene === 'ocean' || scene === 'stream') && <OceanScene />}
      {scene === 'forest' && <ForestScene />}
      {scene === 'fire' && <FireScene />}
      {scene === 'waterfall' && <WaterfallScene />}
      {scene === 'night' && <NightScene />}
      {scene === 'wind' && <WindScene />}
      {(scene === 'white' ||
        scene === 'pink' ||
        scene === 'brown' ||
        scene === 'grey' ||
        scene === 'fan' ||
        scene === 'shower' ||
        scene === 'airplane' ||
        scene === 'train') && (
        <NoiseSceneArt kind={scene} />
      )}
      {scene === 'storm' && flash && flash.id > since && (
        <div
          key={flash.id}
          className="scene-flash"
          style={
            {
              '--flash': 0.35 + flash.strength * 0.55,
              '--fx': `${10 + rand(flash.id * 7.3) * 80}%`,
            } as CSSProperties
          }
        />
      )}
    </div>
  );
}

export default function AmbientBackground({
  phase,
  status,
  particles,
  gears,
  scenery,
  glow,
  scene,
  rainIntensity,
  flash,
}: Props) {
  return (
    <div className={`ambient phase-${phase} status-${status}`} aria-hidden="true">
      {glow && (
        <>
          <div className="ambient-aurora aurora-a" />
          <div className="ambient-aurora aurora-b" />
          <div className="ambient-grid" />
        </>
      )}

      {/* clockwork illustration: gear trains in the corners, an astrolabe dial behind the stage */}
      {gears && (
      <svg className="ambient-clockwork" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="cw-fade" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.9" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.25" />
          </radialGradient>
          <linearGradient id="cw-sweep" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.5" />
          </linearGradient>
        </defs>

        {GEARS.map((g, i) => (
          <g key={i} transform={`translate(${f(g.x)} ${f(g.y)}) rotate(${f((g.phase * 180) / Math.PI)})`}>
            <g
              className="cw-spin"
              style={{
                animationDuration: `${g.speed}s`,
                animationDirection: g.dir > 0 ? 'normal' : 'reverse',
              }}
            >
              <path d={g.d} fillRule="evenodd" className="cw-gear" />
            </g>
          </g>
        ))}

        {/* astrolabe behind the timepiece */}
        <g transform="translate(800 470)" className="cw-astrolabe">
          <g className="cw-spin" style={{ animationDuration: '240s' }}>
            <circle r="440" className="cw-line" />
            <circle r="428" className="cw-line thin" />
            {Array.from({ length: 120 }).map((_, i) => {
              const a = (i / 120) * TAU;
              const len = i % 10 === 0 ? 22 : i % 2 === 0 ? 12 : 6;
              return (
                <line
                  key={i}
                  x1={Math.cos(a) * 428}
                  y1={Math.sin(a) * 428}
                  x2={Math.cos(a) * (428 - len)}
                  y2={Math.sin(a) * (428 - len)}
                  className="cw-line thin"
                />
              );
            })}
          </g>
          <g className="cw-spin" style={{ animationDuration: '180s', animationDirection: 'reverse' }}>
            <circle r="370" className="cw-line thin dashed" />
            {ROMAN.map((rn, i) => {
              const a = (i / 12) * TAU - Math.PI / 2;
              return (
                <text
                  key={rn}
                  x={Math.cos(a) * 340}
                  y={Math.sin(a) * 340}
                  className="cw-numeral"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${(i / 12) * 360} ${Math.cos(a) * 340} ${Math.sin(a) * 340})`}
                >
                  {rn}
                </text>
              );
            })}
          </g>
          {/* tilted orbit ellipses, like an armillary sphere */}
          <g className="cw-spin" style={{ animationDuration: '90s' }}>
            <ellipse rx="300" ry="110" className="cw-line thin" />
            <circle cx="300" cy="0" r="7" className="cw-dot" />
          </g>
          <g className="cw-spin" style={{ animationDuration: '130s', animationDirection: 'reverse' }}>
            <ellipse rx="300" ry="110" transform="rotate(60)" className="cw-line thin" />
            <circle cx="150" cy="-95" r="5" className="cw-dot" />
          </g>
          {/* radar-like sweep: a slow "second hand" of light */}
          <g className="cw-sweep">
            <path d="M0 0 L420 0 A420 420 0 0 0 363.7 -210 Z" fill="url(#cw-sweep)" />
            <line x1="0" y1="0" x2="440" y2="0" className="cw-line" />
          </g>
        </g>

        {/* pendulum swinging from the top edge */}
        <g transform="translate(1180 0)">
          <g className="cw-pendulum">
            <line x1="0" y1="0" x2="0" y2="300" className="cw-line thin" />
            <circle cx="0" cy="330" r="30" fill="url(#cw-fade)" className="cw-bob" />
            <circle cx="0" cy="330" r="30" className="cw-line" />
          </g>
        </g>
      </svg>
      )}

      {scenery && scene && (
        <SceneLayer key={scene} scene={scene} rainIntensity={rainIntensity} flash={flash} />
      )}

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
      {glow && <div className="ambient-vignette" />}
    </div>
  );
}
