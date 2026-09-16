import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { sampleKnobs, type Knobs } from './forms';
import { makeBezelInsertTexture, makeDialTexture, type DialColors } from './dialTexture';

interface Props {
  targetF: number;
  accent: string;
  face: string;
  ink: string;
  /** Case metal colour for the selected style (steel, gold, DLC…). */
  caseColor: string;
  /** Roughness offset for the style's finish. */
  caseRough: number;
  /** Hourglass wood tone for the selected style. */
  woodColor: string;
  remainingSeconds: number;
  phaseTotalSeconds: number;
  running: boolean;
  /** Stopwatch mode: the value counts up instead of down. */
  countUp?: boolean;
  mode: 'intro' | 'app';
  assemble: number;
  pointer?: boolean;
}

const DARK_HAND = new THREE.Color('#1c1c24');
const LUME = new THREE.Color('#eef2ee');
const BRASS = new THREE.Color('#c69a5a');

const TAU = Math.PI * 2;
const damp = THREE.MathUtils.damp;
const clamp01 = (v: number) => THREE.MathUtils.clamp(v, 0, 1);
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

// -- sculpted case geometry ------------------------------------------------------
// Profiles are (radius, z) in case units: z = 0 is the dial plane, +z faces the camera.

type Disp = (theta: number, j: number) => [number, number];

/** Revolve a profile around Z, displacing each vertex to carve patterns into the metal. */
function revolve(profile: [number, number][], segments: number, disp?: Disp, uRepeat = 1) {
  const P = profile.length;
  const positions = new Float32Array((segments + 1) * P * 3);
  const uvs = new Float32Array((segments + 1) * P * 2);
  let p = 0;
  let q = 0;
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * TAU;
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    for (let j = 0; j < P; j++) {
      const [r0, z0] = profile[j];
      const [dr, dz] = disp ? disp(theta, j) : [0, 0];
      const r = Math.max(0, r0 + dr);
      positions[p++] = r * c;
      positions[p++] = r * s;
      positions[p++] = z0 + dz;
      uvs[q++] = (i / segments) * uRepeat;
      uvs[q++] = j / (P - 1);
    }
  }
  const index: number[] = [];
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < P - 1; j++) {
      const a = i * P + j;
      const b = (i + 1) * P + j;
      const c = (i + 1) * P + j + 1;
      const d = i * P + j + 1;
      index.push(a, b, d, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/** One helical strand wound around a circle of radius R (lying in the XY plane at height z0). */
class RopeStrand extends THREE.Curve<THREE.Vector3> {
  R: number;
  z0: number;
  a: number;
  turns: number;
  phase: number;
  constructor(R: number, z0: number, a: number, turns: number, phase: number) {
    super();
    this.R = R;
    this.z0 = z0;
    this.a = a;
    this.turns = turns;
    this.phase = phase;
  }
  getPoint(t: number, target = new THREE.Vector3()) {
    const theta = t * TAU;
    const phi = theta * this.turns + this.phase;
    const r = this.R + this.a * Math.cos(phi);
    return target.set(r * Math.cos(theta), r * Math.sin(theta), this.z0 + this.a * Math.sin(phi));
  }
}

/** Three-ply twisted rope: real 3D strands, not a displacement pattern. */
function ropeRing(R: number, z0: number, thickness: number, turns: number) {
  const strands = [0, 1, 2].map(
    (k) =>
      new THREE.TubeGeometry(
        new RopeStrand(R, z0, thickness * 0.85, turns, (k / 3) * TAU),
        turns * 30,
        thickness,
        10,
        true,
      ),
  );
  return mergeGeometries(strands)!;
}

/** A ring of little polished beads (millegrain). */
function beadRing(count: number, R: number, z: number, size: number) {
  const beads = Array.from({ length: count }, (_, i) => {
    const a = (i / count) * TAU;
    return new THREE.SphereGeometry(size, 10, 8).translate(Math.cos(a) * R, Math.sin(a) * R, z);
  });
  return mergeGeometries(beads)!;
}

// pocket: slim polished base that carries a twisted rope + bead rows (lip → outer wall)
const BEZEL_POCKET: [number, number][] = [
  [0.785, -0.02],
  [0.79, 0.025],
  [0.8, 0.045],
  [0.815, 0.052],
  [0.83, 0.05],
  [0.845, 0.062],
  [0.87, 0.07],
  [0.93, 0.07],
  [0.955, 0.062],
  [0.97, 0.046],
  [0.985, 0.02],
  [0.995, -0.02],
  [1.0, -0.06],
];

// wrist: narrower, taller fluted bezel
const BEZEL_WRIST: [number, number][] = [
  [0.785, -0.02],
  [0.79, 0.04],
  [0.805, 0.09],
  [0.83, 0.12],
  [0.87, 0.132],
  [0.91, 0.13],
  [0.945, 0.115],
  [0.97, 0.085],
  [0.99, 0.04],
  [1.0, -0.01],
  [1.003, -0.06],
];
const WRIST_TOP_W = [0, 0.15, 0.6, 1, 1, 1, 0.9, 0.6, 0.25, 0, 0];
const WRIST_OUT_W = [0, 0, 0, 0, 0, 0.2, 0.5, 0.85, 1, 1, 0.6];

// dive bezel: flat top for the ceramic insert, knurled grip on the outside
const BEZEL_DIVE: [number, number][] = [
  [0.785, -0.02],
  [0.79, 0.04],
  [0.82, 0.075],
  [0.84, 0.08],
  [1.0, 0.08],
  [1.025, 0.072],
  [1.06, 0.058],
  [1.088, 0.03],
  [1.1, -0.01],
  [1.1, -0.07],
];
const DIVE_OUT_W = [0, 0, 0, 0, 0, 0.3, 0.8, 1, 1, 1];

// case bands (mid-case → caseback)
const BAND: [number, number][] = [
  [0.99, -0.05],
  [1.005, -0.08],
  [1.01, -0.14],
  [1.005, -0.2],
  [0.99, -0.25],
  [0.95, -0.29],
  [0.85, -0.32],
  [0.5, -0.34],
  [0, -0.34],
];
const REED_W = [0, 0.6, 1, 1, 0.6, 0, 0, 0, 0];

// wrist: two engraved hairlines cut into the band
const BAND_GROOVED: [number, number][] = [
  [0.99, -0.05],
  [1.005, -0.08],
  [1.005, -0.115],
  [0.992, -0.125],
  [1.005, -0.135],
  [1.005, -0.19],
  [0.992, -0.2],
  [1.005, -0.21],
  [0.995, -0.25],
  [0.96, -0.29],
  [0.85, -0.32],
  [0.5, -0.34],
  [0, -0.34],
];

// dive: thicker guarded band with a raised centre rib between two grooves
const BAND_DIVE: [number, number][] = [
  [1.09, -0.07],
  [1.11, -0.09],
  [1.12, -0.12],
  [1.1, -0.13],
  [1.125, -0.145],
  [1.13, -0.19],
  [1.125, -0.205],
  [1.1, -0.215],
  [1.12, -0.23],
  [1.11, -0.27],
  [1.06, -0.31],
  [0.9, -0.34],
  [0.5, -0.36],
  [0, -0.36],
];

// hourglass glass silhouette: (radius, y) bottom → top
const HG_PROFILE: [number, number][] = [
  [0.03, -1.26],
  [0.66, -1.24],
  [0.68, -1.0],
  [0.6, -0.6],
  [0.34, -0.24],
  [0.05, 0],
  [0.34, 0.24],
  [0.6, 0.6],
  [0.68, 1.0],
  [0.66, 1.24],
  [0.03, 1.26],
];

function handShape(halfW: number, len: number, tail: number) {
  const s = new THREE.Shape();
  s.moveTo(-halfW * 0.6, -tail);
  s.lineTo(halfW * 0.6, -tail);
  s.lineTo(halfW, len * 0.15);
  s.lineTo(halfW * 0.55, len * 0.86);
  s.lineTo(0, len);
  s.lineTo(-halfW * 0.55, len * 0.86);
  s.lineTo(-halfW, len * 0.15);
  s.closePath();
  return s;
}

const EXTRUDE = {
  depth: 0.04,
  bevelEnabled: true,
  bevelThickness: 0.008,
  bevelSize: 0.008,
  bevelSegments: 1,
  steps: 1,
};

// radius (in dial units) of the applied indices — kept clear of the printed numerals
const MARKER_R = 0.76;

// ---------------------------------------------------------------------------

export default function Timepiece(props: Props) {
  const { accent, face, ink, woodColor } = props;

  const root = useRef<THREE.Group>(null);
  const tilt = useRef<THREE.Group>(null);
  const caseRef = useRef<THREE.Group>(null);
  const bezelPocket = useRef<THREE.Mesh>(null);
  const bezelWrist = useRef<THREE.Mesh>(null);
  const bezelWall = useRef<THREE.Mesh>(null);
  const bandPocket = useRef<THREE.Mesh>(null);
  const ropeRef = useRef<THREE.Group>(null);
  const seamRef = useRef<THREE.Mesh>(null);
  const bandWrist = useRef<THREE.Mesh>(null);
  const bandWall = useRef<THREE.Mesh>(null);
  const insertRef = useRef<THREE.Mesh>(null);
  const faceGroup = useRef<THREE.Group>(null);
  const dialPocket = useRef<THREE.Mesh>(null);
  const dialWrist = useRef<THREE.Mesh>(null);
  const dialWall = useRef<THREE.Mesh>(null);
  const chapterRef = useRef<THREE.Mesh>(null);
  const markersRef = useRef<THREE.Group>(null);
  const ticksRef = useRef<THREE.Group>(null);
  const glassRef = useRef<THREE.Mesh>(null);
  const handsRef = useRef<THREE.Group>(null);
  const hourRef = useRef<THREE.Group>(null);
  const minRef = useRef<THREE.Group>(null);
  const secRef = useRef<THREE.Group>(null);
  const hubRef = useRef<THREE.Mesh>(null);
  const crownRef = useRef<THREE.Group>(null);
  const heliumRef = useRef<THREE.Group>(null);
  const bowRef = useRef<THREE.Group>(null);
  const lugsRef = useRef<THREE.Group>(null);
  const strapRef = useRef<THREE.Group>(null);
  const bulbsRef = useRef<THREE.Mesh>(null);
  const frameRef = useRef<THREE.Group>(null);
  const sandTopRef = useRef<THREE.Mesh>(null);
  const sandDomeRef = useRef<THREE.Mesh>(null);
  const sandPeakRef = useRef<THREE.Mesh>(null);
  const streamRef = useRef<THREE.Mesh>(null);

  const metalMats = useRef<THREE.MeshPhysicalMaterial[]>([]);
  const pushMetal = (m: THREE.MeshPhysicalMaterial | null) => {
    if (m && !metalMats.current.includes(m)) metalMats.current.push(m);
  };

  const accentColor = useMemo(() => new THREE.Color(accent), [accent]);
  const caseColor = useMemo(() => new THREE.Color(props.caseColor), [props.caseColor]);

  // today's date for the wrist date window (re-checked every minute so it rolls over at midnight)
  const [day, setDay] = useState(() => new Date().getDate());
  useEffect(() => {
    const id = window.setInterval(() => setDay(new Date().getDate()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const tex = useMemo(() => {
    const colors: DialColors = { face, faceEdge: face, ink, inkDim: ink, accent };
    return {
      pocket: makeDialTexture('pocket', colors, day),
      wrist: makeDialTexture('wrist', colors, day),
      wall: makeDialTexture('wall', colors, day),
    };
  }, [face, ink, accent, day]);
  const insertTex = useMemo(() => makeBezelInsertTexture(accent), [accent]);

  // carved bezels + case bands, one per watch shape
  const caseGeo = useMemo(
    () => ({
      // pocket: slim polished base; the rope and bead rows are separate 3D parts
      bezelPocket: revolve(BEZEL_POCKET, 256),
      ropePocket: ropeRing(0.9, 0.1, 0.021, 46),
      beadsInner: beadRing(150, 0.815, 0.056, 0.0085),
      beadsOuter: beadRing(120, 0.972, 0.046, 0.011),
      // wrist: classic fluted bezel — deep, crisp knife-edge ridges radiating across the top
      bezelWrist: revolve(BEZEL_WRIST, 1440, (t, j) => {
        const x = (t / TAU) * 72;
        const v = 1 - 2 * Math.abs(x - Math.floor(x) - 0.5) - 0.5;
        return [0.012 * v * WRIST_OUT_W[j], 0.034 * v * WRIST_TOP_W[j]];
      }),
      // wall/dive: coin-edge grip teeth on the outside
      bezelWall: revolve(BEZEL_DIVE, 960, (t, j) => {
        const v = Math.pow(Math.abs(Math.sin(t * 60)), 0.35) - 0.6;
        return [0.02 * v * DIVE_OUT_W[j], 0.008 * v * DIVE_OUT_W[j]];
      }),
      // pocket band: reeded coin edge
      bandPocket: revolve(
        BAND,
        720,
        (t, j) => [0.01 * (Math.pow(Math.abs(Math.sin(t * 80)), 0.6) - 0.5) * REED_W[j], 0],
        8,
      ),
      bandWrist: revolve(BAND_GROOVED, 256, undefined, 8),
      bandWall: revolve(BAND_DIVE, 256, undefined, 8),
    }),
    [],
  );

  // procedural micro-detail maps
  const sunburstNormal = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d')!;
    g.fillStyle = 'rgb(128,128,255)';
    g.fillRect(0, 0, 512, 512);
    g.translate(256, 256);
    for (let i = 0; i < 720; i++) {
      g.rotate((Math.PI * 2) / 720);
      g.strokeStyle = i % 2 ? 'rgb(150,128,255)' : 'rgb(108,128,255)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(12, 0);
      g.lineTo(250, 0);
      g.stroke();
    }
    return new THREE.CanvasTexture(c);
  }, []);
  const grainNormal = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const img = g.createImageData(128, 128);
    let s = 1337;
    const rnd = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
    for (let i = 0; i < img.data.length; i += 4) {
      img.data[i] = 128 + (rnd() - 0.5) * 90;
      img.data[i + 1] = 128 + (rnd() - 0.5) * 90;
      img.data[i + 2] = 255;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(4, 4);
    return t;
  }, []);
  // fine parallel striations for brushed-steel surfaces (case band, bracelet)
  const brushedNormal = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 64;
    const g = c.getContext('2d')!;
    g.fillStyle = 'rgb(128,128,255)';
    g.fillRect(0, 0, 256, 64);
    let s = 777;
    const rnd = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
    for (let y = 0; y < 64; y++) {
      const n = 128 + (rnd() - 0.5) * 46;
      g.strokeStyle = `rgb(${n},128,255)`;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(0, y + 0.5);
      g.lineTo(256, y + 0.5);
      g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(6, 3);
    return t;
  }, []);
  const brushedNormalV = useMemo(() => {
    const t = brushedNormal.clone();
    t.rotation = Math.PI / 2;
    t.center.set(0.5, 0.5);
    t.repeat.set(3, 6);
    t.needsUpdate = true;
    return t;
  }, [brushedNormal]);
  // wavy wood-grain streaks for the hourglass end-plates
  const woodGrainNormal = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    const g = c.getContext('2d')!;
    g.fillStyle = 'rgb(128,128,255)';
    g.fillRect(0, 0, 256, 128);
    let s = 42;
    const rnd = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
    for (let y = 0; y < 128; y += 2) {
      const n = 128 + (rnd() - 0.5) * 36;
      g.strokeStyle = `rgb(${n},128,255)`;
      g.lineWidth = 1.3;
      g.beginPath();
      for (let x = 0; x <= 256; x += 8) {
        const yy = y + Math.sin((x + y * 3) * 0.045) * 3.2;
        if (x === 0) g.moveTo(x, yy);
        else g.lineTo(x, yy);
      }
      g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 4);
    return t;
  }, []);
  const hgGeo = useMemo(
    () => new THREE.LatheGeometry(HG_PROFILE.map(([r, y]) => new THREE.Vector2(r, y)), 96),
    [],
  );
  // wrist end link: inner edge is an arc hugging the case, outer edge meets the first bracelet link
  const endLinkGeo = useMemo(() => {
    const R = 0.985;
    const hw = 0.315;
    const y0 = Math.sqrt(R * R - hw * hw);
    const a0 = Math.atan2(y0, hw);
    const shape = new THREE.Shape();
    shape.moveTo(-hw, y0);
    shape.lineTo(-hw, 1.27);
    shape.lineTo(hw, 1.27);
    shape.lineTo(hw, y0);
    shape.absarc(0, 0, R, a0, Math.PI - a0, false);
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: 0.1,
      bevelEnabled: true,
      bevelThickness: 0.018,
      bevelSize: 0.014,
      bevelSegments: 3,
      curveSegments: 32,
    });
    g.translate(0, 0, -0.05);
    return g;
  }, []);

  const handGeo = useMemo(() => {
    const mk = (hw: number, len: number, tail: number) => {
      const g = new THREE.ExtrudeGeometry(handShape(hw, len, tail), EXTRUDE);
      g.translate(0, 0, -EXTRUDE.depth / 2);
      return g;
    };
    const mkLume = (hw: number, len: number, tail: number) => {
      const g = new THREE.ExtrudeGeometry(handShape(hw * 0.42, len * 0.93, tail * 0.4), {
        depth: 0.012,
        bevelEnabled: false,
      });
      g.translate(0, 0, -0.006);
      return g;
    };
    return {
      hour: mk(0.05, 0.5, 0.12),
      minute: mk(0.036, 0.74, 0.14),
      hourLume: mkLume(0.05, 0.5, 0.12),
      minuteLume: mkLume(0.036, 0.74, 0.14),
    };
  }, []);

  const sandMatInst = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#ddc79a'),
        roughness: 1,
        metalness: 0,
        emissive: new THREE.Color('#6b5636'),
        emissiveIntensity: 0.42,
        normalMap: grainNormal,
        normalScale: new THREE.Vector2(0.12, 0.12),
      }),
    [grainNormal],
  );

  const fRef = useRef(props.targetF);
  const deadlineRef = useRef(0);
  const baseRef = useRef(0);
  const lastRemain = useRef(-1);
  const tmp = useRef(new THREE.Color());

  useFrame((state, dt) => {
    const d = Math.min(dt, 0.05);
    fRef.current =
      props.mode === 'intro' ? props.targetF : damp(fRef.current, props.targetF, 9, d);
    const f = fRef.current;
    const k: Knobs = sampleKnobs(f);

    if (props.remainingSeconds !== lastRemain.current) {
      lastRemain.current = props.remainingSeconds;
      deadlineRef.current = performance.now() + props.remainingSeconds * 1000;
      baseRef.current = performance.now();
    }
    const live = !props.running
      ? props.remainingSeconds
      : props.countUp
        ? props.remainingSeconds + (performance.now() - baseRef.current) / 1000
        : Math.max(0, (deadlineRef.current - performance.now()) / 1000);
    const pose = props.mode === 'intro' ? 1500 + state.clock.elapsedTime * 2 : live;
    const hourA = (-((pose / 3600) % 12) / 12) * TAU;
    const minA = (-((pose / 60) % 60) / 60) * TAU;
    const secA = (-((pose % 60) / 60)) * TAU;
    const frac = props.phaseTotalSeconds > 0 ? clamp01(live / props.phaseTotalSeconds) : 0.5;

    const build = clamp01(props.assemble);
    const partIn = (delay: number) => smoothstep(delay, delay + 0.45, build);
    const bi = partIn(0.0);
    const di = partIn(0.14);
    const mi = partIn(0.24);
    const hi = partIn(0.34);
    const ci = partIn(0.44);

    if (root.current) {
      root.current.scale.setScalar(
        damp(root.current.scale.x, props.mode === 'app' ? 1.4 : 1.16, 6, d),
      );
    }
    if (tilt.current) {
      const baseX = THREE.MathUtils.degToRad(k.tiltXDeg);
      if (props.mode === 'app' && props.pointer) {
        tilt.current.rotation.y = damp(tilt.current.rotation.y, state.pointer.x * 0.16, 5, d);
        tilt.current.rotation.x = damp(tilt.current.rotation.x, baseX - state.pointer.y * 0.12, 5, d);
      } else {
        tilt.current.rotation.y = damp(tilt.current.rotation.y, 0, 5, d);
        tilt.current.rotation.x = damp(tilt.current.rotation.x, baseX, 5, d);
      }
    }

    // metal colour comes from the selected style, so every shape can wear every finish
    const mc = tmp.current.copy(caseColor).lerp(accentColor, 0.04);
    for (const m of metalMats.current) {
      m.color.copy(mc);
      m.metalness = 0.9;
      m.envMapIntensity = 1.4;
      const ro = (m.userData.ro as number) ?? 0;
      m.roughness = clamp01(k.roughness + props.caseRough + ro);
    }

    const watch = k.dialWatch;
    const outer = k.caseOuter;
    const dialR = outer * 0.78;
    const faceZ = 0.2 * outer;

    // weights for crossfading dial artwork between the watch shapes
    const dw = {
      pocket: clamp01(1 - Math.abs(f - 0)),
      wrist: clamp01(1 - Math.abs(f - 1)),
      wall: clamp01(1 - Math.abs(f - 2)),
    };
    const sum = dw.pocket + dw.wrist + dw.wall || 1;
    const dominant =
      dw.pocket >= dw.wrist && dw.pocket >= dw.wall ? 'pocket' : dw.wrist >= dw.wall ? 'wrist' : 'wall';

    // sculpted case — the dominant shape's carving is shown
    if (caseRef.current) {
      caseRef.current.position.z = faceZ;
      caseRef.current.scale.setScalar(Math.max(0.001, outer * bi));
      caseRef.current.visible = watch > 0.25 && bi > 0.01;
    }
    if (bezelPocket.current) bezelPocket.current.visible = dominant === 'pocket';
    if (bandPocket.current) bandPocket.current.visible = dominant === 'pocket';
    if (ropeRef.current) ropeRef.current.visible = dominant === 'pocket';
    if (seamRef.current) seamRef.current.visible = dominant !== 'wall';
    if (bezelWrist.current) bezelWrist.current.visible = dominant === 'wrist';
    if (bandWrist.current) bandWrist.current.visible = dominant === 'wrist';
    if (bezelWall.current) bezelWall.current.visible = dominant === 'wall';
    if (bandWall.current) bandWall.current.visible = dominant === 'wall';
    if (insertRef.current) insertRef.current.visible = dominant === 'wall';

    // face group
    if (faceGroup.current) {
      faceGroup.current.position.z = faceZ + (1 - di) * 0.3;
      faceGroup.current.visible = watch > 0.02 && di > 0.01;
    }

    const setDial = (m: THREE.Mesh | null, w: number) => {
      if (!m) return;
      m.scale.setScalar(dialR * di);
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.opacity = (w / sum) * watch;
      m.visible = mat.opacity > 0.02;
      mat.depthWrite = mat.opacity > 0.5;
    };
    setDial(dialPocket.current, dw.pocket);
    setDial(dialWrist.current, dw.wrist);
    setDial(dialWall.current, dw.wall);

    // chapter ring (recessed angled rehaut)
    if (chapterRef.current) {
      chapterRef.current.scale.set(dialR * di, dialR * 0.18 * di, dialR * di);
      chapterRef.current.visible = watch > 0.05 && di > 0.3;
    }

    // applied 3D markers + minute ticks
    const bold = k.markerBold;
    if (markersRef.current) {
      markersRef.current.scale.setScalar(dialR * mi);
      markersRef.current.visible = watch > 0.05 && mi > 0.02 && bold > 0.28;
      markersRef.current.children.forEach((c, idx) => {
        const isTwelve = idx === 0;
        const s = 0.6 + bold * 0.5;
        c.scale.set(s * 0.9, s * (isTwelve ? 1.35 : 1), 0.6 + bold * 0.6);
        const lume = ((c as THREE.Group).children[1] as THREE.Mesh | undefined)
          ?.material as THREE.MeshStandardMaterial | undefined;
        if (lume) {
          lume.emissiveIntensity = 0.06 + k.handLume * bold * 0.6;
          ((c as THREE.Group).children[1] as THREE.Mesh).visible = k.handLume * bold > 0.15;
        }
      });
    }
    if (ticksRef.current) {
      ticksRef.current.scale.setScalar(dialR * mi);
      ticksRef.current.visible = watch > 0.05 && bold > 0.25 && mi > 0.4;
    }

    // crystal — domed toward the camera
    if (glassRef.current) {
      glassRef.current.scale.set(dialR * 1.04, dialR * 0.34 * k.glassDome + 0.02, dialR * 1.04);
      glassRef.current.visible = watch > 0.1 && di > 0.4;
      (glassRef.current.material as THREE.MeshPhysicalMaterial).opacity = watch * 0.35;
    }

    // hands
    if (handsRef.current) {
      handsRef.current.scale.setScalar(k.handScale * dialR * 0.86 * hi);
      handsRef.current.visible = k.handScale > 0.03 && hi > 0.02;
      const hc = tmp.current.copy(DARK_HAND).lerp(LUME, k.handLume * 0.7);
      handsRef.current.traverse((o) => {
        const mm = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (!mm || !('emissiveIntensity' in mm)) return;
        if (o.name === 'lume') {
          o.visible = k.handLume > 0.2;
          mm.emissiveIntensity = 0.15 + k.handLume * 0.9;
        } else if (o.name !== 'sec') {
          mm.color.copy(hc);
          mm.emissive.copy(LUME);
          mm.emissiveIntensity = k.handLume * 0.25;
        }
      });
    }
    if (hourRef.current) hourRef.current.rotation.z = hourA;
    if (minRef.current) minRef.current.rotation.z = minA;
    if (secRef.current) secRef.current.rotation.z = secA;
    if (hubRef.current) hubRef.current.scale.setScalar(Math.max(0.001, k.handScale * dialR * 0.07 * hi));

    // crown, bow, helium valve — mounted on the case band
    // wall's dive case is wider than the slim pocket/wrist cases
    const bandR = outer * (1.005 + 0.115 * (dw.wall / sum));
    if (crownRef.current) {
      const ang = THREE.MathUtils.degToRad(k.crownAngleDeg);
      crownRef.current.position.set(Math.cos(ang) * bandR, Math.sin(ang) * bandR, 0);
      crownRef.current.rotation.z = ang;
      crownRef.current.scale.setScalar(Math.max(0.001, k.crownScale * ci));
      crownRef.current.visible = k.crownScale > 0.03 && ci > 0.02;
    }
    if (bowRef.current) {
      bowRef.current.scale.setScalar(Math.max(0.001, k.bowScale * ci));
      bowRef.current.position.set(0, bandR - 0.04, faceZ - 0.1 * outer);
      bowRef.current.visible = k.bowScale > 0.03 && ci > 0.02;
    }
    if (heliumRef.current) {
      const hAngle = THREE.MathUtils.degToRad(150);
      heliumRef.current.position.set(Math.cos(hAngle) * bandR, Math.sin(hAngle) * bandR, 0);
      heliumRef.current.rotation.z = hAngle;
      const hw = clamp01((k.fluted - 0.5) / 0.5);
      heliumRef.current.scale.setScalar(Math.max(0.001, hw * ci));
      heliumRef.current.visible = hw > 0.05 && ci > 0.02;
    }

    // lugs + strap scale with the case so they always attach to it
    if (lugsRef.current) {
      lugsRef.current.scale.setScalar(Math.max(0.001, outer * k.lugScale * ci));
      lugsRef.current.visible = k.lugScale > 0.03 && ci > 0.02;
    }
    if (strapRef.current) {
      strapRef.current.scale.setScalar(outer);
      strapRef.current.visible = k.strapScale > 0.03 && ci > 0.02;
      strapRef.current.children.forEach((c) => c.scale.setScalar(Math.max(0.001, k.strapScale * ci)));
    }

    // hourglass
    if (bulbsRef.current) {
      bulbsRef.current.scale.setScalar(Math.max(0.001, k.bulbScale * bi));
      bulbsRef.current.visible = k.bulbScale > 0.02 && bi > 0.01;
    }
    if (frameRef.current) {
      frameRef.current.scale.setScalar(Math.max(0.001, k.plateScale * bi));
      frameRef.current.visible = k.plateScale > 0.02 && bi > 0.01;
    }
    const hgFrac = props.mode === 'intro' ? (state.clock.elapsedTime * 0.04) % 1 : 1 - frac;
    const topF = 1 - hgFrac;
    const showSand = k.sandShow > 0.05 && bi > 0.15;
    if (sandTopRef.current) {
      const hTop = 1.06 * topF + 0.02;
      const rTop = 0.06 + 0.56 * Math.sqrt(topF);
      sandTopRef.current.scale.set(rTop * k.sandShow, hTop, rTop * k.sandShow);
      sandTopRef.current.position.y = 0.02 + hTop * 0.5;
      sandTopRef.current.visible = showSand && topF > 0.02;
    }
    const pileR = 0.26 + 0.4 * hgFrac;
    const pileH = 0.1 + 0.34 * hgFrac;
    const floorY = -1.16;
    if (sandDomeRef.current) {
      sandDomeRef.current.scale.set(pileR * k.sandShow, pileH, pileR * k.sandShow);
      sandDomeRef.current.position.y = floorY;
      sandDomeRef.current.visible = showSand && hgFrac > 0.02;
    }
    if (sandPeakRef.current) {
      const pk = clamp01((hgFrac - 0.5) / 0.5);
      const peakH = pk * 0.8;
      sandPeakRef.current.scale.set(pileR * 0.78 * k.sandShow, peakH, pileR * 0.78 * k.sandShow);
      sandPeakRef.current.position.y = floorY + peakH * 0.5;
      sandPeakRef.current.visible = showSand && pk > 0.02;
    }
    if (streamRef.current) {
      const running = props.mode === 'intro' || props.running;
      const pileTop = floorY + pileH * 1.8;
      const len = Math.max(0.05, -0.02 - pileTop);
      streamRef.current.scale.set(k.sandShow, len, k.sandShow);
      streamRef.current.position.y = (-0.02 + pileTop) / 2;
      streamRef.current.visible = showSand && running && topF > 0.02 && len > 0.1;
    }
  });

  const Metal = ({
    ro = 0,
    polished = false,
    ...extra
  }: { ro?: number; polished?: boolean } & Partial<THREE.MeshPhysicalMaterialParameters> = {}) => (
    <meshPhysicalMaterial
      ref={pushMetal}
      color="#c7ccd4"
      metalness={0.9}
      roughness={polished ? 0.2 : 0.36}
      clearcoat={polished ? 0.5 : 0.2}
      clearcoatRoughness={polished ? 0.18 : 0.4}
      envMapIntensity={1.4}
      userData={{ ro: polished ? -0.1 : ro }}
      {...extra}
    />
  );

  const markerAngles = Array.from({ length: 12 }, (_, i) => (i / 12) * TAU);
  const bandMetal = () =>
    Metal({
      ro: 0.12,
      anisotropy: 0.5,
      normalMap: brushedNormal,
      normalScale: new THREE.Vector2(0.16, 0.16),
      side: THREE.DoubleSide,
    });

  return (
    <group ref={root} dispose={null}>
      <group ref={tilt}>
        {/* -------- sculpted case: carved bezel + engraved band, per shape -------- */}
        <group ref={caseRef}>
          <mesh ref={bezelPocket} geometry={caseGeo.bezelPocket} castShadow receiveShadow>
            {Metal({ polished: true, side: THREE.DoubleSide })}
          </mesh>
          <mesh ref={bandPocket} geometry={caseGeo.bandPocket} castShadow receiveShadow>
            {Metal({ ro: 0.04, side: THREE.DoubleSide })}
          </mesh>
          <group ref={ropeRef}>
            <mesh geometry={caseGeo.ropePocket} castShadow receiveShadow>
              {Metal({ polished: true })}
            </mesh>
            <mesh geometry={caseGeo.beadsInner}>{Metal({ polished: true })}</mesh>
            <mesh geometry={caseGeo.beadsOuter} castShadow>
              {Metal({ polished: true })}
            </mesh>
          </group>
          {/* dark hairline where the bezel sits on the middle case */}
          <mesh ref={seamRef} position={[0, 0, -0.052]}>
            <torusGeometry args={[0.998, 0.006, 6, 256]} />
            <meshStandardMaterial color="#060608" roughness={0.9} />
          </mesh>

          <mesh ref={bezelWrist} geometry={caseGeo.bezelWrist} castShadow receiveShadow>
            {Metal({ polished: true, side: THREE.DoubleSide })}
          </mesh>
          <mesh ref={bandWrist} geometry={caseGeo.bandWrist} castShadow receiveShadow>
            {bandMetal()}
          </mesh>

          <mesh ref={bezelWall} geometry={caseGeo.bezelWall} castShadow receiveShadow>
            {Metal({ ro: 0.02, side: THREE.DoubleSide })}
          </mesh>
          <mesh ref={bandWall} geometry={caseGeo.bandWall} castShadow receiveShadow>
            {bandMetal()}
          </mesh>
          {/* ceramic dive-bezel insert with the 60-minute scale */}
          <mesh ref={insertRef} position={[0, 0, 0.081]} receiveShadow>
            <ringGeometry args={[0.845, 0.995, 180]} />
            <meshPhysicalMaterial
              map={insertTex}
              roughness={0.32}
              metalness={0.15}
              clearcoat={0.8}
              clearcoatRoughness={0.2}
            />
          </mesh>
        </group>

        {/* -------- face -------- */}
        <group ref={faceGroup}>
          <mesh ref={dialPocket} receiveShadow>
            <circleGeometry args={[1, 128]} />
            <meshPhysicalMaterial
              map={tex.pocket}
              normalMap={sunburstNormal}
              normalScale={[0.09, 0.09]}
              transparent
              roughness={0.58}
              metalness={0.1}
              clearcoat={0.35}
              clearcoatRoughness={0.35}
            />
          </mesh>
          <mesh ref={dialWrist} position={[0, 0, 0.002]} receiveShadow>
            <circleGeometry args={[1, 128]} />
            <meshPhysicalMaterial
              map={tex.wrist}
              normalMap={sunburstNormal}
              normalScale={[0.09, 0.09]}
              transparent
              roughness={0.54}
              metalness={0.1}
              clearcoat={0.35}
              clearcoatRoughness={0.35}
            />
          </mesh>
          <mesh ref={dialWall} position={[0, 0, 0.004]} receiveShadow>
            <circleGeometry args={[1, 128]} />
            <meshPhysicalMaterial
              map={tex.wall}
              normalMap={sunburstNormal}
              normalScale={[0.07, 0.07]}
              transparent
              roughness={0.5}
              metalness={0.1}
              clearcoat={0.35}
              clearcoatRoughness={0.35}
            />
          </mesh>

          {/* recessed chapter ring */}
          <mesh ref={chapterRef} position={[0, 0, -0.04]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[1.04, 0.86, 1, 96, 1, true]} />
            <meshPhysicalMaterial
              ref={pushMetal}
              color="#c7ccd4"
              metalness={0.4}
              roughness={0.45}
              anisotropy={0.35}
              side={THREE.BackSide}
            />
          </mesh>

          {/* applied hour markers: polished metal frame + lume inset */}
          <group ref={markersRef} position={[0, 0, 0.02]}>
            {markerAngles.map((a, i) => (
              <group
                key={i}
                position={[Math.sin(a) * MARKER_R, Math.cos(a) * MARKER_R, 0]}
                rotation={[0, 0, -a]}
              >
                <mesh position={[0, 0, 0.028]} castShadow>
                  <boxGeometry args={[0.06, 0.15, 0.055]} />
                  <meshPhysicalMaterial
                    color="#d8dce2"
                    metalness={0.85}
                    roughness={0.24}
                    clearcoat={0.4}
                    envMapIntensity={1.4}
                  />
                </mesh>
                <mesh position={[0, 0, 0.06]}>
                  <boxGeometry args={[0.04, 0.11, 0.02]} />
                  <meshStandardMaterial color="#dff0e4" emissive="#bfe8cf" emissiveIntensity={0.1} roughness={0.9} />
                </mesh>
              </group>
            ))}
          </group>

          {/* minute ticks */}
          <group ref={ticksRef} position={[0, 0, 0.015]}>
            {Array.from({ length: 60 }).map((_, i) => {
              if (i % 5 === 0) return null;
              const a = (i / 60) * TAU;
              return (
                <mesh
                  key={i}
                  position={[Math.sin(a) * 0.9, Math.cos(a) * 0.9, 0]}
                  rotation={[0, 0, -a]}
                >
                  <boxGeometry args={[0.012, 0.05, 0.02]} />
                  <meshStandardMaterial color="#9aa0ab" metalness={0.4} roughness={0.6} />
                </mesh>
              );
            })}
          </group>

          {/* hands — polished blued steel */}
          <group ref={handsRef} position={[0, 0, 0.05]}>
            <group ref={hourRef}>
              <mesh geometry={handGeo.hour} castShadow>
                <meshPhysicalMaterial color="#1c1c24" metalness={0.75} roughness={0.3} clearcoat={0.5} clearcoatRoughness={0.28} envMapIntensity={1.3} />
              </mesh>
              <mesh name="lume" geometry={handGeo.hourLume} position={[0, 0, 0.026]}>
                <meshStandardMaterial color={LUME} emissive={LUME} emissiveIntensity={0.3} roughness={0.6} />
              </mesh>
            </group>
            <group ref={minRef}>
              <mesh geometry={handGeo.minute} castShadow>
                <meshPhysicalMaterial color="#1c1c24" metalness={0.75} roughness={0.3} clearcoat={0.5} clearcoatRoughness={0.28} envMapIntensity={1.3} />
              </mesh>
              <mesh name="lume" geometry={handGeo.minuteLume} position={[0, 0, 0.026]}>
                <meshStandardMaterial color={LUME} emissive={LUME} emissiveIntensity={0.3} roughness={0.6} />
              </mesh>
            </group>
            <group ref={secRef} position={[0, 0, 0.02]}>
              <mesh name="sec" position={[0, 0.36, 0]}>
                <boxGeometry args={[0.014, 0.82, 0.016]} />
                <meshStandardMaterial color={accent} metalness={0.3} roughness={0.5} />
              </mesh>
              <mesh name="sec" position={[0, -0.16, 0]}>
                <boxGeometry args={[0.038, 0.26, 0.016]} />
                <meshStandardMaterial color={accent} metalness={0.3} roughness={0.5} />
              </mesh>
              <mesh name="sec" position={[0, 0.5, 0]}>
                <torusGeometry args={[0.03, 0.008, 8, 20]} />
                <meshStandardMaterial color={accent} metalness={0.3} roughness={0.5} />
              </mesh>
            </group>
          </group>
          <mesh ref={hubRef} position={[0, 0, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[1, 1, 0.5, 24]} />
            <meshStandardMaterial color="#eceef2" metalness={0.55} roughness={0.25} />
          </mesh>

          {/* domed sapphire crystal — rotated so the dome bulges toward the viewer */}
          <mesh ref={glassRef} position={[0, 0, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
            <sphereGeometry args={[1, 64, 32, 0, TAU, 0, Math.PI * 0.5]} />
            <meshPhysicalMaterial
              transmission={0.45}
              thickness={0.3}
              roughness={0.07}
              ior={1.77}
              clearcoat={0.6}
              clearcoatRoughness={0.1}
              transparent
              opacity={0.2}
              color="#ffffff"
              attenuationColor="#cfe0ff"
              attenuationDistance={3}
              envMapIntensity={1.2}
              iridescence={0.2}
              iridescenceIOR={1.3}
              iridescenceThicknessRange={[100, 400]}
              depthWrite={false}
            />
          </mesh>
        </group>

        {/* -------- crown: collar + knurled barrel + domed cap -------- */}
        <group ref={crownRef}>
          <mesh rotation={[0, 0, Math.PI / 2]} position={[0.015, 0, 0]}>
            <cylinderGeometry args={[0.055, 0.055, 0.05, 24]} />
            {Metal({ polished: true })}
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]} position={[0.11, 0, 0]}>
            <cylinderGeometry args={[0.088, 0.088, 0.13, 32]} />
            {Metal({ ro: 0.1 })}
          </mesh>
          {Array.from({ length: 22 }).map((_, i) => {
            const a = (i / 22) * TAU;
            return (
              <mesh
                key={i}
                position={[0.11, Math.cos(a) * 0.088, Math.sin(a) * 0.088]}
                rotation={[a, 0, Math.PI / 2]}
              >
                <boxGeometry args={[0.014, 0.13, 0.014]} />
                {Metal({ polished: true })}
              </mesh>
            );
          })}
          <mesh position={[0.185, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <sphereGeometry args={[0.052, 20, 16, 0, TAU, 0, Math.PI / 2]} />
            {Metal({ polished: true })}
          </mesh>
        </group>

        {/* -------- helium escape valve (dive-watch detail) -------- */}
        <group ref={heliumRef}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.05, 0.05, 0.09, 20]} />
            {Metal({ ro: 0.12 })}
          </mesh>
          <mesh position={[0.05, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.052, 0.052, 0.018, 20]} />
            {Metal({ polished: true })}
          </mesh>
        </group>

        {/* -------- pocket pendant: neck → collar → knurled crown → bow -------- */}
        <group ref={bowRef}>
          <mesh position={[0, 0.02, 0]} castShadow>
            <cylinderGeometry args={[0.058, 0.08, 0.2, 28]} />
            {Metal({ polished: true })}
          </mesh>
          <mesh position={[0, 0.115, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.075, 0.02, 12, 36]} />
            {Metal({ polished: true })}
          </mesh>
          <mesh position={[0, 0.2, 0]} castShadow>
            <cylinderGeometry args={[0.095, 0.095, 0.12, 32]} />
            {Metal({ ro: 0.1 })}
          </mesh>
          {Array.from({ length: 26 }).map((_, i) => {
            const a = (i / 26) * TAU;
            return (
              <mesh key={i} position={[Math.cos(a) * 0.095, 0.2, Math.sin(a) * 0.095]} rotation={[0, -a, 0]}>
                <boxGeometry args={[0.013, 0.12, 0.013]} />
                {Metal({ polished: true })}
              </mesh>
            );
          })}
          <mesh position={[0, 0.26, 0]}>
            <sphereGeometry args={[0.07, 24, 12, 0, TAU, 0, Math.PI / 2]} />
            {Metal({ polished: true })}
          </mesh>
          <mesh position={[0, 0.47, 0]} castShadow>
            <torusGeometry args={[0.21, 0.036, 20, 64]} />
            {Metal({ polished: true })}
          </mesh>
        </group>

        {/* -------- lugs + end links, grown out of the middle case (case units) -------- */}
        <group ref={lugsRef}>
          {[1, -1].map((dir) => (
            <group key={dir} rotation={[0, 0, dir === 1 ? 0 : Math.PI]}>
              {[-0.39, 0.39].map((x) => (
                <group key={x} position={[x, 1.04, 0]} rotation={[-0.2, 0, 0]}>
                  <RoundedBox args={[0.14, 0.46, 0.17]} radius={0.045} smoothness={4} castShadow receiveShadow>
                    {Metal({ polished: true })}
                  </RoundedBox>
                  {/* brushed top facet */}
                  <mesh position={[0, 0.02, 0.086]}>
                    <boxGeometry args={[0.07, 0.36, 0.004]} />
                    {Metal({
                      ro: 0.16,
                      anisotropy: 0.45,
                      normalMap: brushedNormalV,
                      normalScale: new THREE.Vector2(0.14, 0.14),
                    })}
                  </mesh>
                </group>
              ))}
              {/* solid end link: its inner edge follows the case curve, so there is no gap */}
              <mesh geometry={endLinkGeo} position={[0, 0, -0.06]} castShadow receiveShadow>
                {Metal({
                  ro: 0.14,
                  anisotropy: 0.45,
                  anisotropyRotation: Math.PI / 2,
                  normalMap: brushedNormalV,
                  normalScale: new THREE.Vector2(0.14, 0.14),
                })}
              </mesh>
            </group>
          ))}
        </group>

        {/* -------- bracelet (case units) -------- */}
        <group ref={strapRef}>
          {[1, -1].map((dir) =>
            Array.from({ length: 6 }).map((_, i) => {
              const t = i / 5;
              const w = 0.62 - t * 0.14;
              const link = w / 3;
              return (
                <group
                  key={`${dir}-${i}`}
                  position={[0, dir * (1.39 + i * 0.25), -0.07 - t * 0.16]}
                  rotation={[-dir * (0.04 + t * 0.14), 0, 0]}
                >
                  {/* centre link — brushed top */}
                  <RoundedBox args={[link * 1.02, 0.22, 0.1]} radius={0.028} smoothness={3} castShadow receiveShadow>
                    {Metal({
                      ro: 0.16,
                      anisotropy: 0.45,
                      anisotropyRotation: Math.PI / 2,
                      normalMap: brushedNormalV,
                      normalScale: new THREE.Vector2(0.14, 0.14),
                    })}
                  </RoundedBox>
                  {/* polished side links */}
                  <RoundedBox args={[link, 0.2, 0.09]} radius={0.028} smoothness={3} position={[link, 0, -0.004]} castShadow>
                    {Metal({ polished: true })}
                  </RoundedBox>
                  <RoundedBox args={[link, 0.2, 0.09]} radius={0.028} smoothness={3} position={[-link, 0, -0.004]} castShadow>
                    {Metal({ polished: true })}
                  </RoundedBox>
                  {/* rivet pins at the link seams */}
                  {[link * 0.5, -link * 0.5].map((px) =>
                    [0.065, -0.065].map((py) => (
                      <mesh key={`${px}-${py}`} position={[px, py, 0.052]} rotation={[Math.PI / 2, 0, 0]}>
                        <cylinderGeometry args={[0.013, 0.013, 0.015, 12]} />
                        <meshStandardMaterial color="#111114" metalness={0.7} roughness={0.35} />
                      </mesh>
                    )),
                  )}
                  {/* fold-over clasp at the strap tip */}
                  {i === 5 && (
                    <group position={[0, dir * 0.2, 0.01]}>
                      <mesh castShadow>
                        <boxGeometry args={[w * 0.82, 0.24, 0.12]} />
                        {Metal({ ro: 0.1, polished: true })}
                      </mesh>
                      <mesh position={[0, dir * 0.04, 0.063]}>
                        <boxGeometry args={[w * 0.4, 0.1, 0.01]} />
                        {Metal({ polished: true })}
                      </mesh>
                    </group>
                  )}
                </group>
              );
            }),
          )}
        </group>

        {/* -------- hourglass -------- */}
        <mesh ref={bulbsRef} geometry={hgGeo}>
          <meshPhysicalMaterial
            transmission={1}
            thickness={0.25}
            roughness={0.06}
            ior={1.5}
            clearcoat={1}
            clearcoatRoughness={0.05}
            transparent
            opacity={1}
            color="#f2f6f8"
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        <mesh ref={sandTopRef} rotation={[Math.PI, 0, 0]} position={[0, 0.4, 0]} material={sandMatInst}>
          <coneGeometry args={[1, 1, 48]} />
        </mesh>
        <mesh ref={sandDomeRef} position={[0, -1, 0]} material={sandMatInst}>
          <sphereGeometry args={[1, 36, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        <mesh ref={sandPeakRef} position={[0, -0.6, 0]} material={sandMatInst}>
          <coneGeometry args={[1, 1, 40]} />
        </mesh>
        <mesh ref={streamRef} position={[0, -0.5, 0]} material={sandMatInst}>
          <cylinderGeometry args={[0.012, 0.02, 1, 8]} />
        </mesh>
        <group ref={frameRef}>
          {[
            [0.6, 0.6],
            [-0.6, 0.6],
            [0.6, -0.6],
            [-0.6, -0.6],
          ].map(([x, z], i) => (
            <group key={i} position={[x, 0, z]}>
              <mesh>
                <cylinderGeometry args={[0.04, 0.04, 2.62, 24]} />
                {Metal({ roughness: 0.35 })}
              </mesh>
              <mesh position={[0, 1.28, 0]}>
                <sphereGeometry args={[0.07, 16, 16]} />
                <meshStandardMaterial color={BRASS} metalness={0.5} roughness={0.4} />
              </mesh>
              <mesh position={[0, -1.28, 0]}>
                <sphereGeometry args={[0.07, 16, 16]} />
                <meshStandardMaterial color={BRASS} metalness={0.5} roughness={0.4} />
              </mesh>
            </group>
          ))}
          {/* turned wood end-plates: round discs, stepped like a lathed finish */}
          {[1, -1].map((dir) => (
            <group key={dir}>
              <mesh position={[0, dir * 1.35, 0]}>
                <cylinderGeometry args={[0.83, 0.83, 0.16, 56]} />
                <meshStandardMaterial
                  color={woodColor}
                  roughness={0.82}
                  metalness={0.06}
                  normalMap={woodGrainNormal}
                  normalScale={new THREE.Vector2(0.35, 0.35)}
                />
              </mesh>
              <mesh position={[0, dir * 1.245, 0]}>
                <cylinderGeometry args={[0.68, 0.72, 0.09, 56]} />
                <meshStandardMaterial
                  color={woodColor}
                  roughness={0.76}
                  metalness={0.06}
                  normalMap={woodGrainNormal}
                  normalScale={new THREE.Vector2(0.3, 0.3)}
                />
              </mesh>
              <mesh position={[0, dir * (1.19 + 0.005), 0]}>
                <cylinderGeometry args={[0.6, 0.62, 0.03, 56]} />
                {Metal({ ro: 0.2 })}
              </mesh>
            </group>
          ))}
          {/* brass collar where the two glass bulbs meet */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.1, 0.028, 14, 36]} />
            <meshStandardMaterial color={BRASS} metalness={0.6} roughness={0.32} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
