import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { sampleKnobs, type Knobs } from './forms';
import { makeDialTexture, type DialColors } from './dialTexture';

interface Props {
  targetF: number;
  accent: string;
  face: string;
  ink: string;
  remainingSeconds: number;
  phaseTotalSeconds: number;
  running: boolean;
  mode: 'intro' | 'app';
  assemble: number;
  pointer?: boolean;
}

const GOLD = new THREE.Color('#dcae52');
const STEEL = new THREE.Color('#c7ccd4');
const DARK_HAND = new THREE.Color('#1c1c24');
const LUME = new THREE.Color('#eef2ee');
const WOOD = new THREE.Color('#5c3f27');
const BRASS = new THREE.Color('#c69a5a');

const TAU = Math.PI * 2;
const damp = THREE.MathUtils.damp;
const lerp = THREE.MathUtils.lerp;
const clamp01 = (v: number) => THREE.MathUtils.clamp(v, 0, 1);
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

// -- shared profiles -----------------------------------------------------------

const CASE_PROFILE: [number, number][] = [
  [0.8, 0.3],
  [0.86, 0.34],
  [0.97, 0.31],
  [1.04, 0.2],
  [1.06, 0.08],
  [1.05, -0.04],
  [1.0, -0.18],
  [0.84, -0.29],
  [0.5, -0.35],
  [0.12, -0.34],
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

// ---------------------------------------------------------------------------

export default function Timepiece(props: Props) {
  const { accent, face, ink } = props;

  const root = useRef<THREE.Group>(null);
  const tilt = useRef<THREE.Group>(null);
  const caseRef = useRef<THREE.Mesh>(null);
  const flutesRef = useRef<THREE.Group>(null);
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
  const bowRef = useRef<THREE.Group>(null);
  const lugsRef = useRef<THREE.Group>(null);
  const strapRef = useRef<THREE.Group>(null);
  const bulbsRef = useRef<THREE.Mesh>(null);
  const frameRef = useRef<THREE.Group>(null);
  const sandTopRef = useRef<THREE.Mesh>(null);
  const sandDomeRef = useRef<THREE.Mesh>(null);
  const sandPeakRef = useRef<THREE.Mesh>(null);
  const streamRef = useRef<THREE.Mesh>(null);

  const metalMats = useRef<THREE.MeshStandardMaterial[]>([]);
  const pushMetal = (m: THREE.MeshStandardMaterial | null) => {
    if (m && !metalMats.current.includes(m)) metalMats.current.push(m);
  };

  const accentColor = useMemo(() => new THREE.Color(accent), [accent]);

  const tex = useMemo(() => {
    const colors: DialColors = { face, faceEdge: face, ink, inkDim: ink, accent };
    return {
      pocket: makeDialTexture('pocket', colors),
      wrist: makeDialTexture('wrist', colors),
      wall: makeDialTexture('wall', colors),
    };
  }, [face, ink, accent]);

  const caseGeo = useMemo(
    () => new THREE.LatheGeometry(CASE_PROFILE.map(([r, y]) => new THREE.Vector2(r, y)), 96),
    [],
  );
  const hgGeo = useMemo(
    () => new THREE.LatheGeometry(HG_PROFILE.map(([r, y]) => new THREE.Vector2(r, y)), 96),
    [],
  );
  const handGeo = useMemo(() => {
    const mk = (hw: number, len: number, tail: number) => {
      const g = new THREE.ExtrudeGeometry(handShape(hw, len, tail), EXTRUDE);
      g.translate(0, 0, -EXTRUDE.depth / 2);
      return g;
    };
    return { hour: mk(0.05, 0.5, 0.12), minute: mk(0.036, 0.74, 0.14) };
  }, []);

  const sandMatInst = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#d4bd8e'),
        roughness: 1,
        metalness: 0,
        emissive: new THREE.Color('#4a3a24'),
        emissiveIntensity: 0.12,
      }),
    [],
  );

  const fRef = useRef(props.targetF);
  const deadlineRef = useRef(0);
  const lastRemain = useRef(-1);
  const tmp = useRef(new THREE.Color());
  const tmp2 = useRef(new THREE.Color());

  useFrame((state, dt) => {
    const d = Math.min(dt, 0.05);
    fRef.current =
      props.mode === 'intro' ? props.targetF : damp(fRef.current, props.targetF, 9, d);
    const f = fRef.current;
    const k: Knobs = sampleKnobs(f);

    if (props.remainingSeconds !== lastRemain.current) {
      lastRemain.current = props.remainingSeconds;
      deadlineRef.current = performance.now() + props.remainingSeconds * 1000;
    }
    const live = props.running
      ? Math.max(0, (deadlineRef.current - performance.now()) / 1000)
      : props.remainingSeconds;
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

    // metal colour
    const mc = tmp.current.copy(GOLD).lerp(STEEL, k.metal).lerp(accentColor, 0.04);
    for (const m of metalMats.current) {
      m.color.copy(mc);
      m.roughness = k.roughness;
      m.metalness = lerp(0.35, 0.6, k.metal);
      m.envMapIntensity = 1.4;
    }

    const watch = k.dialWatch;
    const outer = k.caseOuter;
    const depth = Math.max(0.06, k.caseDepth);
    const dialR = outer * 0.78;
    const faceZ = 0.2 * outer;

    // case
    if (caseRef.current) {
      caseRef.current.scale.set(outer * bi, depth * 2.2 * bi, outer * bi);
      caseRef.current.visible = watch > 0.02 && bi > 0.01;
      const cm = caseRef.current.material as THREE.MeshStandardMaterial;
      cm.opacity = watch;
      cm.transparent = watch < 0.99;
    }
    if (flutesRef.current) {
      flutesRef.current.visible = k.fluted > 0.4 && bi > 0.4;
      flutesRef.current.scale.set(outer, outer, outer);
      flutesRef.current.children.forEach((c) => c.scale.setScalar(clamp01((k.fluted - 0.4) / 0.6)));
    }

    // face group
    if (faceGroup.current) {
      faceGroup.current.position.z = faceZ + (1 - di) * 0.3;
      faceGroup.current.visible = watch > 0.02 && di > 0.01;
    }

    // dials
    const dw = {
      pocket: clamp01(1 - Math.abs(f - 0)),
      wrist: clamp01(1 - Math.abs(f - 1)),
      wall: clamp01(1 - Math.abs(f - 2)),
    };
    const sum = dw.pocket + dw.wrist + dw.wall || 1;
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
      const lc = tmp2.current.copy(STEEL).lerp(LUME, k.handLume);
      markersRef.current.children.forEach((c, idx) => {
        const isTwelve = idx === 0;
        const s = 0.6 + bold * 0.6;
        c.scale.set(s * 0.9, s * (isTwelve ? 1.5 : 1.05), 0.6 + bold * 0.6);
        const mm = ((c as THREE.Group).children[0] as THREE.Mesh)
          .material as THREE.MeshStandardMaterial;
        mm.color.copy(lc);
        mm.emissive.copy(LUME);
        mm.emissiveIntensity = k.handLume * bold * 0.5;
      });
    }
    if (ticksRef.current) {
      ticksRef.current.scale.setScalar(dialR * mi);
      ticksRef.current.visible = watch > 0.05 && bold > 0.25 && mi > 0.4;
    }

    // crystal — domed, subtle
    if (glassRef.current) {
      glassRef.current.scale.set(dialR * 1.04, dialR * 0.34 * k.glassDome + 0.02, dialR * 1.04);
      glassRef.current.visible = watch > 0.1 && di > 0.4;
      (glassRef.current.material as THREE.MeshPhysicalMaterial).opacity = watch * 0.4;
    }

    // hands
    if (handsRef.current) {
      handsRef.current.scale.setScalar(k.handScale * dialR * 0.86 * hi);
      handsRef.current.visible = k.handScale > 0.03 && hi > 0.02;
      const hc = tmp.current.copy(DARK_HAND).lerp(LUME, k.handLume * 0.7);
      handsRef.current.traverse((o) => {
        const mm = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (mm && o.name !== 'sec' && 'emissiveIntensity' in mm) {
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

    // crown + bow
    if (crownRef.current) {
      const ang = THREE.MathUtils.degToRad(k.crownAngleDeg);
      const r = outer + 0.02;
      crownRef.current.position.set(Math.cos(ang) * r, Math.sin(ang) * r, 0);
      crownRef.current.rotation.z = ang;
      crownRef.current.scale.setScalar(Math.max(0.001, k.crownScale * ci));
      crownRef.current.visible = k.crownScale > 0.03 && ci > 0.02;
    }
    if (bowRef.current) {
      bowRef.current.scale.setScalar(Math.max(0.001, k.bowScale * ci));
      bowRef.current.position.set(0, outer + 0.12, 0);
      bowRef.current.visible = k.bowScale > 0.03 && ci > 0.02;
    }

    // lugs + strap
    if (lugsRef.current) {
      lugsRef.current.scale.setScalar(Math.max(0.001, k.lugScale * ci));
      lugsRef.current.visible = k.lugScale > 0.03 && ci > 0.02;
    }
    if (strapRef.current) {
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

  const Metal = (extra?: Partial<THREE.MeshStandardMaterialParameters>) => (
    <meshStandardMaterial ref={pushMetal} color="#c7ccd4" metalness={0.5} roughness={0.28} envMapIntensity={1.4} {...extra} />
  );

  const markerAngles = Array.from({ length: 12 }, (_, i) => (i / 12) * TAU);

  return (
    <group ref={root} dispose={null}>
      <group ref={tilt}>
        {/* -------- case -------- */}
        <mesh ref={caseRef} geometry={caseGeo} rotation={[-Math.PI / 2, 0, 0]}>
          {Metal()}
        </mesh>
        <group ref={flutesRef}>
          {Array.from({ length: 72 }).map((_, i) => {
            const a = (i / 72) * TAU;
            return (
              <mesh key={i} position={[Math.cos(a) * 1.05, Math.sin(a) * 1.05, 0.16]} rotation={[0, 0, a]}>
                <boxGeometry args={[0.04, 0.11, 0.14]} />
                {Metal({ roughness: 0.3 })}
              </mesh>
            );
          })}
        </group>

        {/* -------- face -------- */}
        <group ref={faceGroup}>
          <mesh ref={dialPocket}>
            <circleGeometry args={[1, 96]} />
            <meshStandardMaterial map={tex.pocket} transparent roughness={0.62} metalness={0.05} />
          </mesh>
          <mesh ref={dialWrist} position={[0, 0, 0.002]}>
            <circleGeometry args={[1, 96]} />
            <meshStandardMaterial map={tex.wrist} transparent roughness={0.55} metalness={0.05} />
          </mesh>
          <mesh ref={dialWall} position={[0, 0, 0.004]}>
            <circleGeometry args={[1, 96]} />
            <meshStandardMaterial map={tex.wall} transparent roughness={0.5} metalness={0.05} />
          </mesh>

          {/* recessed chapter ring */}
          <mesh ref={chapterRef} position={[0, 0, -0.04]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[1.04, 0.86, 1, 96, 1, true]} />
            <meshStandardMaterial
              ref={pushMetal}
              color="#c7ccd4"
              metalness={0.4}
              roughness={0.45}
              side={THREE.BackSide}
            />
          </mesh>

          {/* applied hour markers */}
          <group ref={markersRef} position={[0, 0, 0.02]}>
            {markerAngles.map((a, i) => (
              <group
                key={i}
                position={[Math.sin(a) * 0.82, Math.cos(a) * 0.82, 0]}
                rotation={[0, 0, -a]}
              >
                <mesh position={[0, 0, 0.03]}>
                  <boxGeometry args={[0.05, 0.14, 0.05]} />
                  <meshStandardMaterial color="#c7ccd4" metalness={0.5} roughness={0.3} />
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

          {/* hands */}
          <group ref={handsRef} position={[0, 0, 0.05]}>
            <group ref={hourRef}>
              <mesh geometry={handGeo.hour}>
                <meshStandardMaterial color="#1c1c24" metalness={0.6} roughness={0.3} />
              </mesh>
            </group>
            <group ref={minRef}>
              <mesh geometry={handGeo.minute}>
                <meshStandardMaterial color="#1c1c24" metalness={0.6} roughness={0.3} />
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

          {/* crystal */}
          <mesh ref={glassRef} position={[0, 0, 0.02]}>
            <sphereGeometry args={[1, 48, 24, 0, TAU, 0, Math.PI * 0.5]} />
            <meshPhysicalMaterial
              transmission={0.62}
              thickness={0.6}
              roughness={0.05}
              ior={1.5}
              clearcoat={1}
              transparent
              opacity={0.35}
              color="#eef3f7"
              depthWrite={false}
            />
          </mesh>
        </group>

        {/* -------- crown -------- */}
        <group ref={crownRef}>
          <mesh rotation={[0, 0, Math.PI / 2]} position={[0.04, 0, 0]}>
            <cylinderGeometry args={[0.09, 0.09, 0.14, 24]} />
            {Metal({ roughness: 0.34 })}
          </mesh>
          {Array.from({ length: 14 }).map((_, i) => {
            const a = (i / 14) * TAU;
            return (
              <mesh
                key={i}
                position={[0.11, Math.cos(a) * 0.09, Math.sin(a) * 0.09]}
                rotation={[a, 0, Math.PI / 2]}
              >
                <boxGeometry args={[0.02, 0.14, 0.018]} />
                {Metal({ roughness: 0.4 })}
              </mesh>
            );
          })}
          <mesh position={[0.2, 0, 0]}>
            <sphereGeometry args={[0.05, 16, 16]} />
            {Metal({ roughness: 0.3 })}
          </mesh>
        </group>

        {/* -------- bow -------- */}
        <group ref={bowRef}>
          <mesh position={[0, 0.16, 0]}>
            <torusGeometry args={[0.17, 0.038, 18, 44]} />
            {Metal()}
          </mesh>
          <mesh position={[0, -0.02, 0]}>
            <cylinderGeometry args={[0.05, 0.07, 0.16, 16]} />
            {Metal({ roughness: 0.3 })}
          </mesh>
        </group>

        {/* -------- lugs + strap -------- */}
        <group ref={lugsRef}>
          {[
            [-0.46, 0.98, 18],
            [0.46, 0.98, -18],
            [-0.46, -0.98, -18],
            [0.46, -0.98, 18],
          ].map(([x, y, rot], i) => (
            <mesh key={i} position={[x, y, 0.02]} rotation={[0, 0, THREE.MathUtils.degToRad(rot)]}>
              <boxGeometry args={[0.22, 0.4, 0.3]} />
              {Metal({ roughness: 0.26 })}
            </mesh>
          ))}
        </group>
        <group ref={strapRef}>
          {[1, -1].map((dir) =>
            Array.from({ length: 5 }).map((_, i) => {
              const t = i / 4;
              const w = 0.86 - t * 0.22;
              return (
                <mesh
                  key={`${dir}-${i}`}
                  position={[0, dir * (1.15 + i * 0.44), -0.04 - t * 0.08]}
                  rotation={[dir * t * 0.18, 0, 0]}
                >
                  <boxGeometry args={[w, 0.36, 0.1]} />
                  <meshStandardMaterial
                    ref={pushMetal}
                    color="#c7ccd4"
                    metalness={0.45}
                    roughness={0.36}
                  />
                </mesh>
              );
            }),
          )}
        </group>

        {/* -------- hourglass -------- */}
        <mesh ref={bulbsRef} geometry={hgGeo}>
          <meshPhysicalMaterial
            transmission={0.82}
            thickness={0.5}
            roughness={0.04}
            ior={1.5}
            clearcoat={1}
            transparent
            opacity={0.16}
            color="#eef3f6"
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
                <cylinderGeometry args={[0.04, 0.04, 2.62, 16]} />
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
          <mesh position={[0, 1.34, 0]}>
            <boxGeometry args={[1.66, 0.18, 1.66]} />
            <meshStandardMaterial color={WOOD} roughness={0.8} metalness={0.08} />
          </mesh>
          <mesh position={[0, 1.24, 0]}>
            <boxGeometry args={[1.4, 0.06, 1.4]} />
            <meshStandardMaterial color={WOOD} roughness={0.75} metalness={0.08} />
          </mesh>
          <mesh position={[0, -1.34, 0]}>
            <boxGeometry args={[1.66, 0.18, 1.66]} />
            <meshStandardMaterial color={WOOD} roughness={0.8} metalness={0.08} />
          </mesh>
          <mesh position={[0, -1.24, 0]}>
            <boxGeometry args={[1.4, 0.06, 1.4]} />
            <meshStandardMaterial color={WOOD} roughness={0.75} metalness={0.08} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
