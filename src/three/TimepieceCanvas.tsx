import { Canvas } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
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
  /** intro: 0..3 morph position. app: ignored (uses skin.shape). */
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
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 0, 7.2], fov: 38 }}
      style={{ width: '100%', height: '100%' }}
    >
      <ambientLight intensity={1.05} />
      <hemisphereLight intensity={0.75} color="#e8ecff" groundColor="#20202c" />
      <directionalLight position={[3, 5, 6]} intensity={3.2} />
      <directionalLight position={[-5, 2, 3]} intensity={1.6} color={skin.accent} />
      <directionalLight position={[0, -3, 4]} intensity={0.8} color="#ffffff" />

      <Environment resolution={64} frames={1}>
        <Lightformer intensity={3} position={[0, 3.5, 3]} scale={[8, 4, 1]} />
        <Lightformer intensity={1.6} position={[-4, 1, 2]} scale={[3, 4, 1]} color="#b9c6ff" />
        <Lightformer intensity={1.4} position={[4, -1, 2]} scale={[3, 3, 1]} color={skin.accent} />
        <Lightformer intensity={1} position={[0, -4, -3]} scale={[8, 3, 1]} />
      </Environment>

      <group>
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
      </group>
    </Canvas>
  );
}
