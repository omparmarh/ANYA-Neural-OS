import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const COUNT = 4000;

const vertex = /* glsl */ `
  uniform float uTime;
  uniform float uLevel;
  uniform float uSize;

  attribute float aSeed;
  attribute float aRadius;

  varying float vAlpha;

  void main() {
    float t = uTime * (0.06 + aSeed * 0.05);

    // Rotate each point about Y at its own rate — parallax.
    float c = cos(t), s = sin(t);
    vec3 p = vec3(position.x * c - position.z * s, position.y, position.x * s + position.z * c);

    // Loudness pushes the shell out and adds jitter.
    float push = 1.0 + uLevel * 0.35 + sin(uTime * 2.0 + aSeed * 12.0) * 0.02;
    p *= push;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;

    vAlpha = smoothstep(-11.5, -2.5, mv.z)
           * (0.30 + uLevel * 0.35)
           * (1.0 - aRadius * 0.55);

    gl_PointSize = uSize * (1.0 + uLevel * 0.7) * (13.0 / -mv.z);
  }
`;

const fragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  varying float vAlpha;

  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d);
    if (r > 0.5) discard;
    float falloff = 1.0 - smoothstep(0.0, 0.5, r);
    gl_FragColor = vec4(uColor, vAlpha * falloff * uIntensity);
  }
`;

export function Particles({ drive }) {
  const mat = useRef(null);
  const pts = useRef(null);

  const { positions, seeds, radii } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const seeds = new Float32Array(COUNT);
    const radii = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      const u = Math.random() * 2 - 1;
      const theta = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      const radius = 1.9 + Math.pow(Math.random(), 2) * 2.6;
      positions[i * 3] = Math.cos(theta) * r * radius;
      positions[i * 3 + 1] = u * radius;
      positions[i * 3 + 2] = Math.sin(theta) * r * radius;
      seeds[i] = Math.random();
      radii[i] = (radius - 1.9) / 2.6;
    }
    return { positions, seeds, radii };
  }, []);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uLevel: { value: 0 },
      uSize: { value: 3.4 },
      uColor: { value: new THREE.Color('#00e5ff') },
      uIntensity: { value: 1 },
    }),
    [],
  );

  useFrame((state, dt) => {
    if (!mat.current || !pts.current) return;
    const u = mat.current.uniforms;
    pts.current.visible = drive.reactor.visible;
    u.uIntensity.value = drive.reactor.intensity;
    u.uTime.value = state.clock.elapsedTime;
    u.uLevel.value += (drive.level - u.uLevel.value) * Math.min(1, dt * 6);
    u.uColor.value.lerp(drive.color, Math.min(1, dt * 3));
  });

  return (
    <points ref={pts} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSeed" args={[seeds, 1]} />
        <bufferAttribute attach="attributes-aRadius" args={[radii, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={mat}
        uniforms={uniforms}
        vertexShader={vertex}
        fragmentShader={fragment}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}
export default Particles;
