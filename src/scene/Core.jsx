import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// The AVNI reactor ball — a camera-facing plane with a polar GLSL fragment shader.
// Driven by the zustand store: spin rate, open aperture, colour, and mic/speaker level.
export function Core({ spin = 1, open = 0.6, colour = '#22d3ee', level = 0, amp = 0.08 }) {
  const meshRef = useRef();

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uSpin: { value: spin },
    uOpen: { value: open },
    uColour: { value: new THREE.Color(colour) },
    uLevel: { value: level },
  }), []);

  useFrame((state, delta) => {
    const m = meshRef.current?.material;
    if (!m) return;
    m.uniforms.uTime.value += delta;
    m.uniforms.uSpin.value = spin;
    m.uniforms.uOpen.value = open;
    m.uniforms.uLevel.value = level;
  });

  return (
    <mesh ref={meshRef} scale={[1 + amp, 1 + amp, 1 + amp]}>
      <planeGeometry args={[2.4, 2.4, 64, 64]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={/* glsl */`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={/* glsl */`
          precision highp float;
          varying vec2 vUv;
          uniform float uTime, uSpin, uOpen, uLevel;
          uniform vec3 uColour;

          float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
          }
          float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(hash(i), hash(i + vec2(1,0)), f.x),
              mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x),
              f.y
            );
          }

          void main() {
            vec2 uv = vUv * 2.0 - 1.0;
            float r = length(uv);
            float a = atan(uv.y, uv.x);
            float t = uTime * uSpin;

            float ring = smoothstep(uOpen - 0.25, uOpen + 0.05, r);
            float dust = noise(vec2(a * 6.0 + t, r * 8.0 - t * 0.5));
            dust = pow(dust, 2.4) * 0.6;
            float sweep = sin(a * 4.0 - t * 3.0) * 0.5 + 0.5;
            sweep = pow(sweep, 6.0) * 0.35;
            float core = smoothstep(0.18, 0.0, r);
            float coreGlow = pow(core, 2.0);

            vec3 col = uColour;
            col *= (ring * 0.6 + dust + sweep + coreGlow * 1.4);
            col += coreGlow * 0.5;
            col += col * uLevel * 0.5;

            float fres = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);
            col += fres * uColour * 0.3;

            gl_FragColor = vec4(col, 1.0);
          }
        `}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}