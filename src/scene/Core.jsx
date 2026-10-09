import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * The reactor.
 * Modelled on the JARVIS: A Second Screen Experience interface.
 * Drawn as a camera-facing plane with a polar fragment shader.
 */

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform vec3  uColor;
  uniform vec3  uHot;
  uniform float uLevel;
  uniform float uPhase;
  uniform float uOpen;
  uniform float uZoom;
  uniform float uIntensity;
  uniform float uStyle;

  varying vec2 vUv;

  // -- value noise + fbm ----------------------------------------------------
  vec2 hash(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(dot(hash(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
          dot(hash(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
      mix(dot(hash(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
          dot(hash(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
      u.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p *= 2.02;
      a *= 0.5;
    }
    return v;
  }

  // A soft complete circle at radius r0, w wide.
  float band(float r, float r0, float w) {
    return exp(-pow((r - r0) / w, 2.0));
  }

  #define TAU 6.28318530718

  void main() {
    vec2 p = (vUv * 2.0 - 1.0) * uZoom;
    float r = length(p);
    float a = atan(p.y, p.x);

    vec2 ring = vec2(cos(a), sin(a));

    // -- the main ring ------------------------------------------------------
    float wob   = fbm(ring * 2.6 + vec2(uPhase * 0.22, 0.0)) * 0.055;
    float grain = fbm(ring * 9.0 - vec2(uPhase * 0.4, 0.0)) * 0.020;
    float R = 0.74 + wob + grain + uLevel * 0.03;

    // Erosion: outer boundary is eaten away in patches
    float erode = smoothstep(-0.25, 0.35, fbm(ring * 5.0 + vec2(uPhase * 0.5, 3.0)));

    // -- style ---------------------------------------------------------------
    float wSphere = clamp(1.0 - abs(uStyle - 1.0), 0.0, 1.0);
    float wWire   = clamp(1.0 - abs(uStyle - 2.0), 0.0, 1.0);

    float kOutline = mix(1.0, 0.45, wSphere) * mix(1.0, 0.70, wWire);
    float kDust    = mix(1.0, 0.30, wSphere) * mix(1.0, 0.80, wWire);
    float kLines   = mix(1.0, 0.35, wSphere) * mix(1.0, 3.00, wWire);
    float kMesh    = mix(1.0, 0.60, wSphere) * mix(1.0, 2.60, wWire);
    float kWash    = mix(1.0, 1.60, wSphere) * mix(1.0, 0.00, wWire);
    float kGlow    = mix(1.0, 2.20, wSphere) * mix(1.0, 0.30, wWire);

    float outer = band(r, R, 0.030) * (0.45 + erode * 0.6);
    float wall  = band(r, R - 0.055, 0.020) * 0.5;
    float edge  = band(r, R + 0.004, 0.007) * (0.5 + uLevel * 0.45);

    // Dust: bright motes clinging to the outer edge
    float speck = fbm(ring * 46.0 + vec2(uPhase * 0.15, 11.0));
    speck = pow(max(speck, 0.0), 3.0);
    float dust = speck * band(r, R + 0.028, 0.055) * (1.4 + uLevel);

    // -- radar sweep --------------------------------------------------------
    float sweepA = mod(uPhase * 0.55, TAU);
    float dA = mod(a - sweepA + TAU + 3.14159, TAU) - 3.14159;
    float wake = smoothstep(-2.6, -0.15, dA) * (1.0 - smoothstep(0.0, 0.22, dA));
    float radar = wake * band(r, R - 0.02, 0.075) * (0.55 + uLevel * 0.45);

    // -- concentric hairlines inside ---------------------------------------
    float lines =
        band(r, 0.615, 0.0035) * 0.45
      + band(r, 0.560, 0.0030) * 0.28
      + band(r, 0.470, 0.0035) * 0.36;

    // -- the textured core disc --------------------------------------------
    float m1 = (sin(a * 96.0 + uPhase * 0.6) * 0.5 + 0.5)
             * (sin(r * 210.0) * 0.5 + 0.5);
    float m2 = (sin(a * 60.0 - uPhase * 0.4) * 0.5 + 0.5)
             * (sin(r * 150.0 - uPhase) * 0.5 + 0.5);
    float mesh = mix(m1, m2, 0.5);
    float core = smoothstep(0.40, 0.36, r);
    float coreTex = core * (0.04 * kWash + mesh * 0.12 * kMesh) * (0.55 + uLevel * 0.9);
    float coreEdge = band(r, 0.385, 0.010) * (0.55 + uLevel * 0.5);

    // A slow pulse rippling out through the core
    float pulse = band(r, fract(uPhase * 0.08) * 0.40, 0.020) * core * 0.45;

    // -- inner glow ---------------------------------------------------------
    float bloom = exp(-r * 3.4) * (0.16 + uLevel * 0.34);

    float bodyFill = wSphere * smoothstep(R + 0.02, R - 0.32, r)
                   * (0.10 + uLevel * 0.10);

    float v = (outer + wall + edge + coreEdge) * kOutline
            + dust * kDust
            + radar
            + lines * kLines
            + coreTex + pulse
            + bloom * kGlow
            + bodyFill;

    vec3 col = mix(uColor, uHot,
      clamp(edge * 1.3 + radar * 0.7 + pulse * 0.5 + dust * 0.4, 0.0, 1.0));

    // Radial reveal on power-up
    v *= smoothstep(0.0, 0.35, uOpen - r * 0.45);

    v *= uIntensity;

    gl_FragColor = vec4(col * v, v);
  }
`;

const HALF = 2.7;
const RING_R = 0.74;
const FIT = 0.60;

export function Core({ drive }) {
  const mat = useRef(null);
  const mesh = useRef(null);
  const viewport = useThree((s) => s.viewport);

  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color('#19c4c4') },
      uHot: { value: new THREE.Color('#c9fdff') },
      uLevel: { value: 0 },
      uPhase: { value: 0 },
      uOpen: { value: 0 },
      uZoom: { value: 1.2 },
      uIntensity: { value: 1 },
      uStyle: { value: 0 },
    }),
    [],
  );

  useFrame((_, dt) => {
    if (!mat.current || !mesh.current) return;
    const u = mat.current.uniforms;
    const r = drive.reactor;

    mesh.current.visible = r.visible;
    mesh.current.scale.setScalar(r.scale);

    const fit = Math.min(viewport.width, viewport.height);
    u.uZoom.value = (RING_R * HALF) / (FIT * 0.5 * fit);
    u.uLevel.value += (drive.level - u.uLevel.value) * Math.min(1, dt * 8);
    u.uPhase.value += dt * (0.5 + u.uLevel.value * 0.7) * r.spin;
    u.uOpen.value += (drive.open - u.uOpen.value) * Math.min(1, dt * 1.6);
    u.uIntensity.value = r.intensity;
    u.uStyle.value = r.style;
    u.uColor.value.lerp(r.color, Math.min(1, dt * 2.5));
  });

  return (
    <mesh ref={mesh} frustumCulled={false}>
      <planeGeometry args={[5.4, 5.4]} />
      <shaderMaterial
        ref={mat}
        uniforms={uniforms}
        vertexShader={vertex}
        fragmentShader={fragment}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}
export default Core;