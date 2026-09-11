import { Canvas } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import type { ClockSkin } from '../clock/skins';
import { SHAPE_INDEX } from '../clock/skins';
import Timepiece from './Timepiece';

const FACE_HEX: Record<string, { face: string; ink: string }> = {
  midnight: { face: '#252533', ink: '#ecebf6' },
  porcelain: { face: '#f4f0e4', ink: '#2c281f' },
  blueprint: { face: '#123a63', ink: '#e2efff' },
  onyx: { face: '#1b1b1e', ink: '#f4f4f4' },
  solar: { face: '#2c1a12', ink: '#ffe9d6' },
};

interface Props {
  skin: ClockSkin;
  mode: 'intro' | 'app';
  morph?: number;
  assemble?: number;
  remainingSeconds?: number;
  phaseTotalSeconds?: number;
  running?: boolean;
}

export default function TimepieceCanvas({
  skin,
  mode,
  morph = 0,
  assemble = 1,
  remainingSeconds = 0,
  phaseTotalSeconds = 0,
  running = false,
}: Props) {
  const colors = FACE_HEX[skin.face] ?? FACE_HEX.midnight;
  const targetF = mode === 'app' ? SHAPE_INDEX[skin.shape] : morph;

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 0, 7.2], fov: 38 }}
      style={{ width: '100%', height: '100%' }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.02;
      }}
    >
      {/* soft studio key + fill so metals never read pure black */}
      <ambientLight intensity={0.82} />
      <hemisphereLight intensity={0.55} color="#eef1ff" groundColor="#20202c" />
      <directionalLight
        position={[3.5, 5, 6]}
        intensity={2.6}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0002}
      />
      <directionalLight position={[-5, 2, 3]} intensity={1.1} color={skin.accent} />
      <directionalLight position={[0, -3, 4]} intensity={0.5} />

      {/* procedural softbox environment for reflections */}
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={5} position={[0, 5, 3]} scale={[12, 6, 1]} />
        <Lightformer form="rect" intensity={2.5} position={[-6, 1, 2]} scale={[3, 8, 1]} color="#c3ccff" />
        <Lightformer form="rect" intensity={2.5} position={[6, 0, 2]} scale={[3, 6, 1]} color={skin.accent} />
        <Lightformer form="rect" intensity={1.5} position={[0, -5, -2]} scale={[10, 4, 1]} />
        <Lightformer form="ring" intensity={2} position={[0, 0, -9]} scale={7} />
      </Environment>

      <Timepiece
        targetF={targetF}
        accent={skin.accent}
        face={colors.face}
        ink={colors.ink}
        remainingSeconds={remainingSeconds}
        phaseTotalSeconds={phaseTotalSeconds}
        running={running}
        mode={mode}
        assemble={assemble}
        pointer={mode === 'app'}
      />

      {mode === 'app' && (
        <ContactShadows
          position={[0, -2.15, 0]}
          scale={11}
          blur={2.6}
          opacity={0.45}
          far={4.5}
          resolution={512}
          color="#000000"
        />
      )}
    </Canvas>
  );
}
