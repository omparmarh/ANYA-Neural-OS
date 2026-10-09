// AVNI — synthesized sound effects (no asset files needed).
// Web Audio API only. Respects prefers-reduced-motion by skipping non-critical chimes.

let ctx = null;

function getCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  ctx = new AC();
  return ctx;
}

export async function resumeAudio() {
  try { if (ctx && ctx.state === 'suspended') await ctx.resume(); }
  catch {}
}

// A short "power on" riser + chime.
export function playBoot() {
  try {
    const c = getCtx();
    const now = c.currentTime;
    // Riser
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.55);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.18, now + 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
    osc.connect(g).connect(c.destination);
    osc.start(now);
    osc.stop(now + 0.85);
    // Chime
    [880, 1320, 1760].forEach((f, i) => {
      const o = c.createOscillator();
      const gg = c.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      const t = now + 0.18 + i * 0.06;
      gg.gain.setValueAtTime(0.0001, t);
      gg.gain.exponentialRampToValueAtTime(0.14, t + 0.02);
      gg.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(gg).connect(c.destination);
      o.start(t);
      o.stop(t + 0.55);
    });
  } catch (e) { /* audio not critical */ }
}

// A single bright "click" for ignition.
export function playIgnition() {
  try {
    const c = getCtx();
    const now = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(1200, now);
    o.frequency.exponentialRampToValueAtTime(2400, now + 0.08);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    o.connect(g).connect(c.destination);
    o.start(now);
    o.stop(now + 0.3);
  } catch {}
}

// A soft "pop" for UI feedback.
export function playPop() {
  try {
    const c = getCtx();
    const now = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.value = 900;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    o.connect(g).connect(c.destination);
    o.start(now);
    o.stop(now + 0.15);
  } catch {}
}

// A low "thud" for transitions.
export function playThud() {
  try {
    const c = getCtx();
    const now = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, now);
    o.frequency.exponentialRampToValueAtTime(40, now + 0.18);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    o.connect(g).connect(c.destination);
    o.start(now);
    o.stop(now + 0.25);
  } catch {}
}

// A "success" chord.
export function playSuccess() {
  try {
    const c = getCtx();
    const now = c.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      const t = now + i * 0.05;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      o.connect(g).connect(c.destination);
      o.start(t);
      o.stop(t + 0.45);
    });
  } catch {}
}