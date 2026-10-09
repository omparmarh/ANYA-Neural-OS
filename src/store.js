// AVNI Neural OS — Zustand Store
// Drives the 3D reactor ball, HUD chrome, and live-mode state machine.
// Single source of truth for phase, voice, and UI effects.

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

const DEFAULT_ACCENT = '#22d3ee';

export const Phase = {
  OFFLINE: 'offline',
  BOOT: 'boot',
  DORMANT: 'dormant',
  WAKING: 'waking',
  LISTENING: 'listening',
  THINKING: 'thinking',
  TOOLING: 'tooling',
  SPEAKING: 'speaking',
};

// Spin rate, colour, and displacement amplitude per phase — the ball's personality.
const PHASE_STYLE = {
  [Phase.OFFLINE]:    { spin: 0.06,  open: 0.22, colour: '#1e293b', amp: 0.02 },
  [Phase.BOOT]:       { spin: 3.4,   open: 0.72, colour: '#22d3ee', amp: 0.10 },
  [Phase.DORMANT]:    { spin: 0.22,  open: 0.30, colour: '#38bdf8', amp: 0.03 },
  [Phase.WAKING]:     { spin: 4.6,   open: 0.80, colour: '#f59e0b', amp: 0.14 },
  [Phase.LISTENING]:  { spin: 1.05,  open: 0.62, colour: '#22d3ee', amp: 0.08 },
  [Phase.THINKING]:   { spin: 2.8,   open: 0.70, colour: '#f0a93c', amp: 0.10 },
  [Phase.TOOLING]:    { spin: 3.6,   open: 0.78, colour: '#a78bfa', amp: 0.12 },
  [Phase.SPEAKING]:   { spin: 1.35,  open: 0.66, colour: '#34d399', amp: 0.09 },
};

const DEFAULTS = {
  accent: DEFAULT_ACCENT,
  phase: Phase.OFFLINE,
  liveMode: false,        // the floating 3-D ball / live conversation mode
  isListening: false,
  isSpeaking: false,
  interimTranscript: '',
  isThinking: false,
  micLevel: 0,
  speakerLevel: 0,
  statusText: 'OFFLINE',
  effects: [],
  toast: null,
  reducedMotion: false,
};

export const useStore = create(devtools((set, get) => ({
  ...DEFAULTS,

  // ── Phase ──────────────────────────────────────────────────
  setPhase: (phase) => set((s) => {
    const style = PHASE_STYLE[phase] || PHASE_STYLE[Phase.DORMANT];
    const statusMap = {
      [Phase.OFFLINE]: 'OFFLINE',
      [Phase.BOOT]: 'INITIALISING',
      [Phase.DORMANT]: 'STANDBY',
      [Phase.WAKING]: 'WAKING',
      [Phase.LISTENING]: 'LISTENING',
      [Phase.THINKING]: 'THINKING',
      [Phase.TOOLING]: 'ACCESSING SYSTEMS',
      [Phase.SPEAKING]: 'RESPONDING',
    };
    return { phase, statusText: statusMap[phase] ?? phase.toUpperCase(), ...style };
  }),
  setAccent: (c) => set({ accent: c }),
  setLiveMode: (on) => set((s) => {
    if (on && s.phase === Phase.OFFLINE) {
      // First live activation — boot the system.
      return { liveMode: true, phase: Phase.BOOT };
    }
    return { liveMode: on };
  }),

  // ── Voice ──────────────────────────────────────────────────
  setIsListening: (v) => set({ isListening: v, phase: v ? Phase.LISTENING : get().phase }),
  setIsSpeaking: (v) => set({ isSpeaking: v, phase: v ? Phase.SPEAKING : get().phase }),
  setInterimTranscript: (t) => set({ interimTranscript: t }),
  setMicLevel: (v) => set({ micLevel: v }),
  setSpeakerLevel: (v) => set({ speakerLevel: v }),
  setIsThinking: (v) => set({ isThinking: v, phase: v ? Phase.THINKING : get().phase }),
  setTooling: (v) => set({ phase: v ? Phase.TOOLING : get().phase }),

  // ── Chat / threads (mirrors App.jsx state) ─────────────────
  threads: [],
  activeThreadId: null,
  setThreads: (t) => set({ threads: t }),
  setActiveThreadId: (id) => set({ activeThreadId: id }),
  appendMessage: (threadId, msg) => set((s) => ({
    threads: s.threads.map((t) =>
      t.id === threadId ? { ...t, messages: [...(t.messages || []), msg] } : t
    ),
  })),
  updateThreadMessages: (threadId, msgs) => set((s) => ({
    threads: s.threads.map((t) => t.id === threadId ? { ...t, messages: msgs } : t),
  })),

  // ── UI effects / toasts ────────────────────────────────────
  pushEffect: (effect) => set((s) => ({ effects: [...s.effects, { ...effect, id: Math.random().toString(36).slice(2) }] })),
  popEffect: (id) => set((s) => ({ effects: s.effects.filter((e) => e.id !== id) })),
  showToast: (text, kind = 'info') => set({ toast: { text, kind, id: Math.random().toString(36).slice(2) } }),
  clearToast: () => set({ toast: null }),
  setReducedMotion: (v) => set({ reducedMotion: v }),

  // ── Reset ──────────────────────────────────────────────────
  reset: () => set({ ...DEFAULTS }),
}), 'store'));