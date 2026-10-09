// AVNI — clap-to-wake detector.
// Energy-shape detector: quiet-before → instant rise → fast collapse.
// Armed only during the OFFLINE phase. No external deps — pure Web Audio.

let analyser = null;
let rafId = null;
let armed = false;
let quietMs = 0;
let peakEnergy = 0;
let lastClapAt = 0;

function getAnalyser() {
  if (analyser) return analyser;
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC();
  analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.85;
  // Route mic into analyser via a hidden MediaStreamAudioSourceNode.
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then((stream) => {
      const src = ctx.createMediaStreamSource(stream);
      src.connect(analyser);
    })
    .catch(() => { analyser = null; });
  return analyser;
}

function energy(buf) {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  return Math.sqrt(sum / buf.length);
}

function loop() {
  const a = analyser;
  if (!a) { rafId = requestAnimationFrame(loop); return; }
  const buf = new Uint8Array(a.frequencyBinCount);
  a.getByteTimeDomainData(buf);
  const e = energy(buf);

  if (armed) {
    if (e < 0.012) {
      quietMs += 16;
      if (quietMs > 120) { peakEnergy = 0; quietMs = 0; }
    } else {
      if (peakEnergy === 0 && quietMs > 60) {
        // Possible clap onset — track the peak.
        peakEnergy = e;
      } else if (peakEnergy > 0) {
        if (e > peakEnergy) peakEnergy = e;
        // Collapse: energy drops sharply after a peak.
        if (e < peakEnergy * 0.45 && peakEnergy > 0.06) {
          const now = performance.now();
          if (now - lastClapAt > 600) {
            lastClapAt = now;
            window.__avniClap && window.__avniClap();
          }
          peakEnergy = 0;
          quietMs = 0;
        } else if (e < 0.012) {
          peakEnergy = 0;
          quietMs = 0;
        }
      }
    }
  }
  rafId = requestAnimationFrame(loop);
}

export function startClapWake(onClap) {
  if (typeof window === 'undefined') return;
  window.__avniClap = onClap;
  if (armed) return;
  armed = true;
  getAnalyser();
  if (!rafId) rafId = requestAnimationFrame(loop);
}

export function stopClapWake() {
  armed = false;
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
}