import React, { useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  EffectComposer,
  Bloom,
  ChromaticAberration,
  Vignette,
  Noise,
} from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import { Core } from './Core';
import { Particles } from './Particles';
import { Orbits } from './Orbits';
import { useStore, Phase } from '../store';

const spinFor = {
  [Phase.OFFLINE]: 0.08,
  [Phase.BOOT]: 3.2,
  [Phase.DORMANT]: 0.25,
  [Phase.WAKING]: 4.5,
  [Phase.LISTENING]: 1.1,
  [Phase.THINKING]: 2.8,
  [Phase.TOOLING]: 3.6,
  [Phase.SPEAKING]: 1.4,
  offline: 0.08,
  boot: 3.2,
  dormant: 0.25,
  waking: 4.5,
  listening: 1.1,
  thinking: 2.8,
  tooling: 3.6,
  speaking: 1.4,
};

const AMP_CALM = 0.035;
const AMP_LIVE = 0.085;

function isWebGLAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

function CSSReactorFallback({ colour = '#22d3ee' }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden">
      <div
        className="w-96 h-96 rounded-full animate-pulse blur-3xl opacity-35 transition-all duration-700"
        style={{ background: `radial-gradient(circle, ${colour} 0%, transparent 70%)` }}
      />
      <div
        className="w-72 h-72 rounded-full border-2 border-cyan-400/30 animate-spin opacity-30 absolute"
        style={{ animationDuration: '15s' }}
      />
      <div
        className="w-48 h-48 rounded-full border border-cyan-300/40 animate-ping opacity-20 absolute"
        style={{ animationDuration: '3s' }}
      />
    </div>
  );
}

class SceneErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err) {
    console.warn('3D Scene WebGL fallback engaged:', err);
  }
  render() {
    if (this.state.hasError) {
      return <CSSReactorFallback colour={this.props.colour} />;
    }
    return this.props.children;
  }
}

function Rig() {
  const drive = useMemo(
    () => ({
      color: new THREE.Color('#22d3ee'),
      level: 0,
      spin: spinFor.offline,
      amp: AMP_CALM,
      open: 0,
      reactor: {
        color: new THREE.Color('#22d3ee'),
        scale: 1,
        intensity: 1,
        spin: 1,
        style: 0,
        visible: true,
      },
    }),
    [],
  );

  const target = useMemo(() => ({ key: '', color: new THREE.Color() }), []);

  useFrame((state, dt) => {
    const st = useStore.getState();
    const phase = st.phase || 'dormant';
    const accent = st.accent || '#22d3ee';
    const level = st.isListening ? (st.micLevel || 0) : (st.isSpeaking ? (st.speakerLevel || 0) : 0);

    if (target.key !== accent) {
      target.key = accent;
      target.color.set(accent);
    }

    drive.color.lerp(target.color, Math.min(1, dt * 2.5));
    drive.reactor.color.lerp(target.color, Math.min(1, dt * 2.5));

    const sVal = spinFor[phase] || spinFor.dormant;
    drive.spin += (sVal - drive.spin) * Math.min(1, dt * 2);
    drive.amp = phase === 'dormant' || phase === 'offline' ? AMP_CALM : AMP_LIVE;
    drive.open = phase === 'offline' ? 0.28 : phase === 'boot' ? 0.7 : 1.6;

    const idle = phase === 'offline' ? 0.02 : phase === 'dormant' ? 0.05 : 0.12;
    const breathe = (Math.sin(state.clock.elapsedTime * 0.9) * 0.5 + 0.5) * idle;
    const want = Math.max(level, breathe);
    drive.level += (want - drive.level) * Math.min(1, dt * 9);

    const t = state.clock.elapsedTime;
    state.camera.position.x = Math.sin(t * 0.13) * 0.35;
    state.camera.position.y = Math.cos(t * 0.17) * 0.22;
    state.camera.lookAt(0, 0, 0);
  });

  return (
    <>
      <Core drive={drive} />
      <Particles drive={drive} />
      <Orbits />
    </>
  );
}

export default function Scene() {
  const [hasWebGL, setHasWebGL] = useState(true);
  const accent = useStore((s) => s.accent || '#22d3ee');

  useEffect(() => {
    setHasWebGL(isWebGLAvailable());
  }, []);

  if (!hasWebGL) {
    return <CSSReactorFallback colour={accent} />;
  }

  return (
    <div className="scene" style={{ position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none' }}>
      <SceneErrorBoundary colour={accent}>
        <Canvas
          className="scene"
          camera={{ position: [0, 0, 6.2], fov: 45 }}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          dpr={[1, 2]}
          style={{ background: 'transparent' }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0);
          }}
        >
          <Rig />
          <EffectComposer multisampling={0}>
            <Bloom
              intensity={1.15}
              luminanceThreshold={0.22}
              luminanceSmoothing={0.85}
              mipmapBlur
              radius={0.72}
            />
            <ChromaticAberration
              offset={new THREE.Vector2(0.0009, 0.0012)}
              radialModulation={false}
              modulationOffset={0}
            />
            <Noise opacity={0.035} blendFunction={BlendFunction.OVERLAY} />
            <Vignette eskil={false} offset={0.22} darkness={0.95} />
          </EffectComposer>
        </Canvas>
      </SceneErrorBoundary>
    </div>
  );
}