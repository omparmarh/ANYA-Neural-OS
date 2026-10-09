import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore, Phase } from '../store';
import { playBoot, resumeAudio } from '../lib/sfx';

// Boot log lines for beat 1
const BOOT_LOGS = [
  'MOUNT F:/BACKUP/GHOST… OK',
  'EXTEND SYSTEM MEMORY… OK',
  'INITIALISE NEURAL LINK… OK',
  'VERIFY CORE INTEGRITY… OK',
  'LOAD PERSONALITY MATRIX… OK',
  'CALIBRATE SENSOR ARRAY… OK',
  'SYNC CLOCK TO ATOMIC… OK',
  'ESTABLISH SECURE CHANNEL… OK',
  'WAKE SUBSYSTEM: VOICE… OK',
  'WAKE SUBSYSTEM: VISION… OK',
  'WAKE SUBSYSTEM: BRIDGE… OK',
  'ALL SYSTEMS NOMINAL',
];

// Beat 1: 0-2600ms - Progress bar + boot log
function Beat1({ elapsed, accent, reducedMotion }) {
  const progress = Math.min(elapsed / 2600, 1);
  const filledCells = Math.floor(progress * 22);
  const visibleLogs = Math.floor((elapsed / 2600) * BOOT_LOGS.length);

  return (
    <motion.div
      className="boot-beat beat-1"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0.15 : 0.4, ease: 'easeOut' }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '28px' }}
    >
      <div className="boot-title mono-label" style={{ fontSize: 'clamp(0.7rem, 1.5vw, 0.9rem)', color: accent, letterSpacing: '0.2em' }}>
        INITIATING SYSTEM 1…
      </div>

      {/* 22-cell segmented progress bar */}
      <div className="progress-bar" style={{ display: 'flex', gap: '4px', width: 'clamp(280px, 50vw, 520px)' }}>
        {Array.from({ length: 22 }).map((_, i) => (
          <motion.div
            key={i}
            className="progress-cell"
            initial={{ scaleX: 0, backgroundColor: 'rgba(255,255,255,0.08)' }}
            animate={{
              scaleX: i < filledCells ? 1 : 0,
              backgroundColor: i < filledCells ? accent : 'rgba(255,255,255,0.08)',
            }}
            transition={{
              type: reducedMotion ? 'tween' : 'spring',
              stiffness: 180,
              damping: 12,
              delay: i * 0.03,
            }}
            style={{
              flex: 1,
              height: '8px',
              borderRadius: '2px',
              transformOrigin: 'left center',
              backgroundColor: 'rgba(255,255,255,0.08)',
            }}
          />
        ))}
      </div>

      {/* Scrolling boot log */}
      <div className="boot-log" style={{ width: 'clamp(280px, 50vw, 520px)', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', lineHeight: '1.6', color: 'rgba(148,163,184,0.85)', textAlign: 'left', maxHeight: '200px', overflow: 'hidden' }}>
        <motion.div
          initial={{ y: 0 }}
          animate={{ y: 0 }}
          style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}
        >
          {BOOT_LOGS.slice(0, visibleLogs).map((line, i) => (
            <motion.div
              key={i}
              className="log-line"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: reducedMotion ? 'tween' : 'spring', stiffness: 200, damping: 15, delay: i * 0.06 }}
              style={{ color: i < visibleLogs - 1 ? '#22d3ee' : accent }}
            >
              {line}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}

// Beat 2: 2600-5200ms - Concentric SVG reticle rings + "AVNI" text
function Beat2({ elapsed, accent, reducedMotion }) {
  const beatProgress = Math.min(Math.max((elapsed - 2600) / 2600, 0), 1);
  const ringProgress = Math.min(beatProgress * 1.2, 1);
  const textProgress = Math.max((beatProgress - 0.6) / 0.4, 0);

  return (
    <motion.div
      className="boot-beat beat-2"
      initial={{ opacity: 0 }}
      animate={{ opacity: beatProgress > 0 ? 1 : 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0.15 : 0.3 }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px' }}
    >
      <svg
        viewBox="0 0 320 320"
        width="clamp(200px, 35vw, 320px)"
        height="clamp(200px, 35vw, 320px)"
        style={{ filter: `drop-shadow(0 0 24px ${accent})` }}
      >
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Outer ring */}
        <motion.circle
          cx="160"
          cy="160"
          r="140"
          fill="none"
          stroke={accent}
          strokeWidth="1.5"
          strokeDasharray="879.6"
          strokeDashoffset="879.6"
          filter="url(#glow)"
          initial={{ strokeDashoffset: 879.6 }}
          animate={{ strokeDashoffset: ringProgress * 879.6 }}
          transition={{ type: reducedMotion ? 'tween' : 'spring', stiffness: 120, damping: 10, duration: reducedMotion ? 0.8 : undefined }}
          style={{ opacity: ringProgress > 0.1 ? 1 : 0 }}
        />
        {/* Middle ring */}
        <motion.circle
          cx="160"
          cy="160"
          r="105"
          fill="none"
          stroke={accent}
          strokeWidth="1"
          strokeDasharray="659.7"
          strokeDashoffset="659.7"
          filter="url(#glow)"
          initial={{ strokeDashoffset: 659.7 }}
          animate={{ strokeDashoffset: Math.max(0, (ringProgress - 0.15) / 0.85) * 659.7 }}
          transition={{ type: reducedMotion ? 'tween' : 'spring', stiffness: 140, damping: 12, delay: 0.1, duration: reducedMotion ? 0.6 : undefined }}
          style={{ opacity: ringProgress > 0.25 ? 1 : 0 }}
        />
        {/* Inner ring */}
        <motion.circle
          cx="160"
          cy="160"
          r="70"
          fill="none"
          stroke={accent}
          strokeWidth="1"
          strokeDasharray="439.8"
          strokeDashoffset="439.8"
          filter="url(#glow)"
          initial={{ strokeDashoffset: 439.8 }}
          animate={{ strokeDashoffset: Math.max(0, (ringProgress - 0.3) / 0.7) * 439.8 }}
          transition={{ type: reducedMotion ? 'tween' : 'spring', stiffness: 160, damping: 14, delay: 0.2, duration: reducedMotion ? 0.5 : undefined }}
          style={{ opacity: ringProgress > 0.4 ? 1 : 0 }}
        />
        {/* Center dot */}
        <motion.circle
          cx="160"
          cy="160"
          r="4"
          fill={accent}
          filter="url(#glow)"
          initial={{ scale: 0 }}
          animate={{ scale: ringProgress > 0.7 ? 1 : 0 }}
          transition={{ type: reducedMotion ? 'tween' : 'spring', stiffness: 300, damping: 15, delay: 0.4 }}
        />
      </svg>

      {/* AVNI resolving at center */}
      <motion.div
        className="avni-title"
        initial={{ opacity: 0, scale: 0.8, letterSpacing: '0.5em' }}
        animate={{
          opacity: textProgress,
          scale: 1,
          letterSpacing: '-0.02em',
        }}
        transition={{
          opacity: { duration: reducedMotion ? 0.2 : 0.5, delay: 1.2 },
          scale: { type: reducedMotion ? 'tween' : 'spring', stiffness: 180, damping: 12, delay: 1.2 },
          letterSpacing: { duration: 0.8, delay: 1.2 },
        }}
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
          fontWeight: 700,
          color: accent,
          textShadow: `0 0 32px ${accent}, 0 0 64px ${accent}`,
          letterSpacing: '-0.02em',
        }}
      >
        A.V.N.I.
      </motion.div>

      <motion.div
        className="avni-subtitle mono-label"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: textProgress * 0.7, y: 0 }}
        transition={{ duration: reducedMotion ? 0.2 : 0.4, delay: 1.6 }}
        style={{ fontSize: 'clamp(0.6rem, 1.2vw, 0.8rem)', color: 'rgba(148,163,184,0.7)', letterSpacing: '0.25em' }}
      >
        Autonomous Voice Neural Interface
      </motion.div>
    </motion.div>
  );
}

// Beat 3: 5200-7200ms - Wireframe suit schematic
function Beat3({ elapsed, accent, reducedMotion }) {
  const beatProgress = Math.min(Math.max((elapsed - 5200) / 2000, 0), 1);

  // Humanoid SVG path - simplified wireframe
  const suitPaths = [
    { id: 'head', d: 'M160 60 a20 20 0 1 1 0.1 0', label: 'SENSOR ARRAY', x: 160, y: 32 },
    { id: 'torso', d: 'M160 80 L160 160', label: 'CORE / PWR', x: 160, y: 140 },
    { id: 'left-arm', d: 'M160 95 L100 140', label: 'MANIPULATOR L', x: 88, y: 130 },
    { id: 'right-arm', d: 'M160 95 L220 140', label: 'RT / PWR', x: 224, y: 130 },
    { id: 'left-leg', d: 'M160 160 L110 240', label: 'LOCOMOTION L', x: 96, y: 232 },
    { id: 'right-leg', d: 'M160 160 L210 240', label: 'DEP / MK', x: 214, y: 232 },
  ];

  return (
    <motion.div
      className="boot-beat beat-3"
      initial={{ opacity: 0 }}
      animate={{ opacity: beatProgress > 0 ? 1 : 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0.15 : 0.3 }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', position: 'relative', width: '100%' }}
    >
      <svg
        viewBox="0 0 320 320"
        width="clamp(240px, 40vw, 360px)"
        height="clamp(240px, 40vw, 360px)"
        style={{ filter: `drop-shadow(0 0 16px ${accent}88)` }}
      >
        <defs>
          <filter id="schematic-glow">
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {suitPaths.map((path, i) => (
          <motion.path
            key={path.id}
            d={path.d}
            fill="none"
            stroke={accent}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray={path.id === 'torso' ? 80 : path.id === 'head' ? 125 : 65}
            strokeDashoffset={path.id === 'torso' ? 80 : path.id === 'head' ? 125 : 65}
            filter="url(#schematic-glow)"
            initial={{ strokeDashoffset: path.id === 'torso' ? 80 : path.id === 'head' ? 125 : 65 }}
            animate={{ strokeDashoffset: 0 }}
            transition={{
              type: reducedMotion ? 'tween' : 'spring',
              stiffness: 140,
              damping: 10,
              delay: i * 0.08,
              duration: reducedMotion ? 0.4 : undefined,
            }}
            style={{ opacity: beatProgress > i * 0.12 ? 1 : 0 }}
          />
        ))}
        {/* Callout labels */}
        {suitPaths.map((path, i) => (
          <motion.text
            key={`label-${path.id}`}
            x={path.x}
            y={path.y}
            textAnchor={path.x < 160 ? 'end' : 'start'}
            dominantBaseline="middle"
            fill={accent}
            fontFamily="var(--font-mono)"
            fontSize="8"
            fontWeight={600}
            letterSpacing="0.12em"
            filter="url(#schematic-glow)"
            initial={{ opacity: 0, x: path.x < 160 ? -10 : 10 }}
            animate={{ opacity: beatProgress > 0.5 + i * 0.05 ? 1 : 0, x: 0 }}
            transition={{ type: reducedMotion ? 'tween' : 'spring', stiffness: 180, damping: 12, delay: 0.6 + i * 0.06 }}
          >
            {path.label}
          </motion.text>
        ))}
      </svg>

      <motion.div
        className="beat3-subtitle mono-label"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: beatProgress > 0.7 ? 1 : 0, y: 0 }}
        transition={{ duration: reducedMotion ? 0.2 : 0.3, delay: 1.2 }}
        style={{ fontSize: 'clamp(0.55rem, 1vw, 0.7rem)', color: 'rgba(148,163,184,0.6)', letterSpacing: '0.18em' }}
      >
        SUIT SCHEMATIC RESOLVED
      </motion.div>
    </motion.div>
  );
}

// Beat 4: 7200ms+ - Triangular arc reactor
function Beat4({ elapsed, accent, reducedMotion, onComplete }) {
  const beatProgress = Math.min(Math.max((elapsed - 7200) / 2000, 0), 1);
  const segmentCount = 16;

  useEffect(() => {
    if (beatProgress >= 0.95) {
      const timer = setTimeout(() => onComplete(), reducedMotion ? 100 : 800);
      return () => clearTimeout(timer);
    }
  }, [beatProgress, onComplete, reducedMotion]);

  return (
    <motion.div
      className="boot-beat beat-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0.15 : 0.5, ease: 'easeOut' }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px' }}
    >
      <svg
        viewBox="0 0 300 300"
        width="clamp(180px, 30vw, 280px)"
        height="clamp(180px, 30vw, 280px)"
      >
        <defs>
          <filter id="reactor-glow">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="core-gradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={accent} stopOpacity="1" />
            <stop offset="70%" stopColor={accent} stopOpacity="0.3" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Outer triangular frame */}
        <motion.path
          d="M150 30 L265 255 L35 255 Z"
          fill="none"
          stroke={accent}
          strokeWidth="2"
          strokeDasharray="650"
          strokeDashoffset="650"
          filter="url(#reactor-glow)"
          initial={{ strokeDashoffset: 650 }}
          animate={{ strokeDashoffset: 0 }}
          transition={{ type: reducedMotion ? 'tween' : 'spring', stiffness: 100, damping: 8, duration: reducedMotion ? 0.8 : undefined }}
        />

        {/* 16 radial segments */}
        {Array.from({ length: segmentCount }).map((_, i) => {
          const angle = (i / segmentCount) * Math.PI * 2 - Math.PI / 2;
          const innerR = 55;
          const outerR = 125;
          const cx = 150;
          const cy = 150;
          const x1 = cx + Math.cos(angle) * innerR;
          const y1 = cy + Math.sin(angle) * innerR;
          const x2 = cx + Math.cos(angle) * outerR;
          const y2 = cy + Math.sin(angle) * outerR;

          return (
            <motion.line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={accent}
              strokeWidth="1.5"
              strokeLinecap="round"
              filter="url(#reactor-glow)"
              initial={{ opacity: 0, strokeWidth: 0.5 }}
              animate={{
                opacity: beatProgress > i * 0.05 ? 1 : 0,
                strokeWidth: beatProgress > i * 0.05 ? 2 : 0.5,
              }}
              transition={{
                type: reducedMotion ? 'tween' : 'spring',
                stiffness: 200,
                damping: 12,
                delay: i * 0.04,
                duration: reducedMotion ? 0.3 : undefined,
              }}
            />
          );
        })}

        {/* Central core glow */}
        <motion.circle
          cx="150"
          cy="150"
          r="40"
          fill="url(#core-gradient)"
          filter="url(#reactor-glow)"
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: 1 + beatProgress * 0.15, opacity: beatProgress }}
          transition={{ type: reducedMotion ? 'tween' : 'spring', stiffness: 80, damping: 6, duration: reducedMotion ? 1.2 : undefined }}
          style={{ mixBlendMode: 'screen' }}
        />

        {/* Pulsing inner core */}
        <motion.circle
          cx="150"
          cy="150"
          r="18"
          fill={accent}
          filter="url(#reactor-glow)"
          initial={{ scale: 0 }}
          animate={{ scale: beatProgress > 0.3 ? 1 : 0 }}
          transition={{ type: reducedMotion ? 'tween' : 'spring', stiffness: 250, damping: 10, delay: 0.4 }}
          style={{ mixBlendMode: 'screen', animation: 'pulse 1.5s ease-in-out infinite' }}
        />
      </svg>

      <motion.div
        className="beat4-label mono-label"
        initial={{ opacity: 0 }}
        animate={{ opacity: beatProgress > 0.5 ? 1 : 0 }}
        transition={{ duration: reducedMotion ? 0.2 : 0.4, delay: 1.0 }}
        style={{ fontSize: 'clamp(0.55rem, 1vw, 0.7rem)', color: accent, letterSpacing: '0.2em' }}
      >
        ARC REACTOR ONLINE
      </motion.div>
    </motion.div>
  );
}

// Main Boot component
export default function Boot() {
  const phase = useStore((s) => s.phase);
  const setPhase = useStore((s) => s.setPhase);
  const accent = useStore((s) => s.accent);
  const reducedMotion = useStore((s) => s.reducedMotion);

  const [elapsed, setElapsed] = useState(0);
  const [currentBeat, setCurrentBeat] = useState(1);
  const intervalRef = useRef(null);
  const startTimeRef = useRef(null);

  useEffect(() => {
    if (phase !== Phase.BOOT) return;

    resumeAudio();
    playBoot();
    startTimeRef.current = performance.now();

    intervalRef.current = setInterval(() => {
      const now = performance.now();
      const ms = now - startTimeRef.current;
      setElapsed(ms);

      if (ms < 2600) setCurrentBeat(1);
      else if (ms < 5200) setCurrentBeat(2);
      else if (ms < 7200) setCurrentBeat(3);
      else setCurrentBeat(4);
    }, 16);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [phase]);

  const handleComplete = () => {
    setPhase(Phase.DORMANT);
  };

  if (phase !== Phase.BOOT) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        className="boot-overlay"
        initial={{ opacity: 1, filter: 'blur(0px)' }}
        exit={{ opacity: 0, filter: 'blur(10px)' }}
        transition={{
          type: reducedMotion ? 'tween' : 'spring',
          stiffness: 100,
          damping: 12,
          duration: reducedMotion ? 0.3 : 0.8,
        }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100,
          background: 'var(--surface-0)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <AnimatePresence mode="popLayout">
          {currentBeat === 1 && <Beat1 key="beat1" elapsed={elapsed} accent={accent} reducedMotion={reducedMotion} />}
          {currentBeat === 2 && <Beat2 key="beat2" elapsed={elapsed} accent={accent} reducedMotion={reducedMotion} />}
          {currentBeat === 3 && <Beat3 key="beat3" elapsed={elapsed} accent={accent} reducedMotion={reducedMotion} />}
          {currentBeat === 4 && <Beat4 key="beat4" elapsed={elapsed} accent={accent} reducedMotion={reducedMotion} onComplete={handleComplete} />}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}