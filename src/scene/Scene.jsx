import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom, Noise, Vignette } from '@react-three/postprocessing';
import { useStore, Phase } from '../store';
import { Core } from './Core';

// Dust shell — 1200 points drifting around the reactor.
export function Particles({ count = 1200, radius = 2.6 }) {
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = radius * (0.3 + Math.random() * 0.7);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, [count, radius]);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} itemSize={3} count={count} />
      </bufferGeometry>
      <pointsMaterial size={0.022} color="#22d3ee" transparent opacity={0.7} sizeAttenuation />
    </points>
  );
}

// Scene wrapper — the 3D background behind the HUD.
export default function Scene() {
  const phase = useStore((s) => s.phase);
  const accent = useStore((s) => s.accent);
  const micLevel = useStore((s) => s.micLevel);
  const speakerLevel = useStore((s) => s.speakerLevel);
  const isListening = useStore((s) => s.isListening);
  const isSpeaking = useStore((s) => s.isSpeaking);

  const style = {
    [Phase.OFFLINE]:    { spin: 0.06, open: 0.22, colour: '#1e293b', amp: 0.02 },
    [Phase.BOOT]:       { spin: 3.4,  open: 0.72, colour: accent,    amp: 0.10 },
    [Phase.DORMANT]:    { spin: 0.22, open: 0.30, colour: '#38bdf8', amp: 0.03 },
    [Phase.WAKING]:     { spin: 4.6,  open: 0.80, colour: '#f59e0b', amp: 0.14 },
    [Phase.LISTENING]:  { spin: 1.05, open: 0.62, colour: accent,    amp: 0.08 },
    [Phase.THINKING]:   { spin: 2.8,  open: 0.70, colour: '#f0a93c', amp: 0.10 },
    [Phase.TOOLING]:    { spin: 3.6,  open: 0.78, colour: '#a78bfa', amp: 0.12 },
    [Phase.SPEAKING]:   { spin: 1.35, open: 0.66, colour: '#34d399', amp: 0.09 },
  }[phase] || { spin: 0.22, open: 0.30, colour: accent, amp: 0.03 };

  const level = isListening ? micLevel : (isSpeaking ? speakerLevel : 0);

  return (
    <div className="scene" style={{ position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none' }}>
      <Canvas
        camera={{ position: [0, 0, 5.5], fov: 45 }}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
        dpr={[1, 2]}
        style={{ background: 'transparent' }}
        onCreated={({ gl }) => {
          // Fully transparent background so the CSS surface shows through
          gl.setClearColor(0x000000, 0);
        }}
      >
        <Core
          spin={style.spin}
          open={style.open}
          colour={style.colour}
          level={level}
          amp={style.amp}
        />

        <Particles />

        <EffectComposer>
          <Bloom luminanceThreshold={0.15} luminanceSmoothing={0.4} intensity={1.15} radius={0.5} />
          <Noise opacity={0.05} />
          <Vignette offset={0.3} darkness={0.6} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}