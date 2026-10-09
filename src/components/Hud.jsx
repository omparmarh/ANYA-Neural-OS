import { motion, AnimatePresence } from 'framer-motion';
import { useStore, Phase } from '../store';

// Phase to status text mapping
const PHASE_STATUS = {
  [Phase.OFFLINE]: 'OFFLINE',
  [Phase.BOOT]: 'INITIALISING',
  [Phase.DORMANT]: 'STANDBY',
  [Phase.WAKING]: 'WAKING',
  [Phase.LISTENING]: 'LISTENING',
  [Phase.THINKING]: 'PROCESSING',
  [Phase.TOOLING]: 'ACCESSING SYSTEMS',
  [Phase.SPEAKING]: 'RESPONDING',
};

// System labels for left rail
const SYSTEMS = [
  { id: 'core', label: 'CORE', key: 'core' },
  { id: 'voice', label: 'VOICE', key: 'voice' },
  { id: 'brain', label: 'BRAIN', key: 'brain' },
  { id: 'memory', label: 'MEMORY', key: 'memory' },
  { id: 'bridge', label: 'BRIDGE', key: 'bridge' },
];

// Corner bracket component
function Corner({ position, accent, reducedMotion }) {
  const size = 24;
  const thickness = 2;

  const styles = {
    tl: { top: 20, left: 20, borderTop: `${thickness}px solid ${accent}`, borderLeft: `${thickness}px solid ${accent}`, borderRadius: `${size}px 0 0 0` },
    tr: { top: 20, right: 20, borderTop: `${thickness}px solid ${accent}`, borderRight: `${thickness}px solid ${accent}`, borderRadius: `0 ${size}px 0 0` },
    bl: { bottom: 20, left: 20, borderBottom: `${thickness}px solid ${accent}`, borderLeft: `${thickness}px solid ${accent}`, borderRadius: `0 0 0 ${size}px` },
    br: { bottom: 20, right: 20, borderBottom: `${thickness}px solid ${accent}`, borderRight: `${thickness}px solid ${accent}`, borderRadius: `0 0 ${size}px 0` },
  };

  return (
    <motion.div
      className={`hud-corner hud-corner-${position}`}
      style={{
        position: 'absolute',
        width: size,
        height: size,
        opacity: 0.6,
        pointerEvents: 'none',
        ...styles[position],
        boxShadow: `0 0 12px ${accent}44`,
      }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 0.6, scale: 1 }}
      transition={{ type: reducedMotion ? 'tween' : 'spring', stiffness: 120, damping: 10, delay: 0.3 }}
    />
  );
}

// Top HUD bar
function HudTop({ phase, statusText, accent, reducedMotion }) {
  const isOnline = phase !== Phase.OFFLINE && phase !== Phase.BOOT;

  return (
    <motion.div
      className="hud-top"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        padding: '20px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        pointerEvents: 'none',
        zIndex: 10,
      }}
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: isOnline ? 1 : 0.3 }}
      exit={{ y: -60, opacity: 0 }}
      transition={{ type: reducedMotion ? 'tween' : 'spring', stiffness: 120, damping: 14, duration: reducedMotion ? 0.3 : undefined }}
    >
      {/* Brand mark */}
      <div className="hud-brand" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <motion.span
          className="brand-mark mono-label"
          style={{
            fontSize: 'clamp(0.75rem, 1.5vw, 1rem)',
            fontWeight: 700,
            color: accent,
            letterSpacing: '0.18em',
            textShadow: `0 0 16px ${accent}88`,
          }}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: reducedMotion ? 'tween' : 'spring', stiffness: 180, damping: 12, delay: 0.1 }}
        >
          A.V.N.I.
        </motion.span>
        <motion.span
          className="brand-sub mono-label"
          style={{
            fontSize: 'clamp(0.5rem, 0.9vw, 0.65rem)',
            color: 'rgba(148,163,184,0.65)',
            letterSpacing: '0.15em',
            fontWeight: 500,
          }}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: reducedMotion ? 'tween' : 'spring', stiffness: 180, damping: 12, delay: 0.15 }}
        >
          Autonomous Voice Neural Interface
        </motion.span>
      </div>

      {/* Center: status dot + text */}
      <div className="hud-status" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <motion.div
          className="status-dot"
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: isOnline ? accent : '#64748b',
            boxShadow: isOnline ? `0 0 12px ${accent}, 0 0 24px ${accent}66` : 'none',
            animation: isOnline ? 'glow-pulse 2s ease-in-out infinite' : 'none',
          }}
          animate={{ scale: isOnline ? [1, 1.2, 1] : 1 }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <motion.span
          className="status-text mono-label"
          style={{
            fontSize: 'clamp(0.6rem, 1.1vw, 0.75rem)',
            fontWeight: 600,
            color: isOnline ? accent : '#64748b',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
          animate={{ opacity: [1, 0.6, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          {statusText}
        </motion.span>
      </div>

      {/* Right: accent indicator */}
      <motion.div
        className="hud-accent-indicator"
        style={{
          width: 12,
          height: 12,
          borderRadius: '3px',
          background: `linear-gradient(135deg, ${accent} 0%, ${accent}88 100%)`,
          boxShadow: `0 0 16px ${accent}88`,
        }}
        animate={{ rotateZ: [0, 360] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
      />
    </motion.div>
  );
}

// Left rail - Systems
function RailLeft({ phase, accent, reducedMotion }) {
  const isActive = phase !== Phase.OFFLINE && phase !== Phase.BOOT;

  return (
    <motion.div
      className="rail-left"
      style={{
        position: 'absolute',
        top: '50%',
        left: 20,
        transform: 'translateY(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        pointerEvents: 'none',
        zIndex: 10,
      }}
      initial={{ x: -60, opacity: 0 }}
      animate={{ x: 0, opacity: isActive ? 1 : 0.2 }}
      exit={{ x: -60, opacity: 0 }}
      transition={{ type: reducedMotion ? 'tween' : 'spring', stiffness: 120, damping: 14, duration: reducedMotion ? 0.3 : undefined }}
    >
      <motion.span className="rail-label mono-label" style={{ fontSize: '0.55rem', color: 'rgba(148,163,184,0.5)', letterSpacing: '0.18em', textTransform: 'uppercase', paddingLeft: '4px' }}>SYSTEMS</motion.span>
      {SYSTEMS.map((sys, i) => (
        <motion.div
          key={sys.id}
          className="system-item"
          style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: reducedMotion ? 'tween' : 'spring', stiffness: 180, damping: 12, delay: 0.2 + i * 0.06 }}
        >
          <motion.div
            className="system-dot"
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: phase === Phase.LISTENING || phase === Phase.SPEAKING || phase === Phase.THINKING ? accent : 'rgba(148,163,184,0.4)',
              boxShadow: phase === Phase.LISTENING || phase === Phase.SPEAKING || phase === Phase.THINKING ? `0 0 8px ${accent}` : 'none',
            }}
            animate={{ scale: phase === Phase.LISTENING ? [1, 1.5, 1] : phase === Phase.SPEAKING ? [1, 1.3, 1] : 1 }}
            transition={{ duration: phase === Phase.LISTENING ? 0.8 : phase === Phase.SPEAKING ? 1.2 : 0, repeat: Infinity }}
          />
          <span className="system-label mono-label" style={{ fontSize: '0.6rem', color: 'rgba(148,163,184,0.7)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{sys.label}</span>
        </motion.div>
      ))}
    </motion.div>
  );
}

// Right rail - Signal / Mic level
function RailRight({ micLevel, isListening, accent, reducedMotion }) {
  const isActive = isListening;

  return (
    <motion.div
      className="rail-right"
      style={{
        position: 'absolute',
        top: '50%',
        right: 20,
        transform: 'translateY(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        alignItems: 'flex-end',
        pointerEvents: 'none',
        zIndex: 10,
      }}
      initial={{ x: 60, opacity: 0 }}
      animate={{ x: 0, opacity: isActive ? 1 : 0.15 }}
      exit={{ x: 60, opacity: 0 }}
      transition={{ type: reducedMotion ? 'tween' : 'spring', stiffness: 120, damping: 14, duration: reducedMotion ? 0.3 : undefined }}
    >
      <motion.span className="rail-label mono-label" style={{ fontSize: '0.55rem', color: 'rgba(148,163,184,0.5)', letterSpacing: '0.18em', textTransform: 'uppercase', paddingRight: '4px' }}>SIGNAL</motion.span>

      <motion.div
        className="mic-meter"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '8px',
          minWidth: '100px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <motion.span
            className="mic-percent mono-label"
            style={{ fontSize: 'clamp(1.2rem, 3vw, 1.8rem)', fontWeight: 700, color: accent, letterSpacing: '0.05em', minWidth: '50px', textAlign: 'right' }}
            animate={{ textShadow: isActive ? [`0 0 8px ${accent}`, `0 0 16px ${accent}`, `0 0 8px ${accent}`] : 'none' }}
            transition={{ duration: 0.5, repeat: Infinity }}
          >
            {Math.round(micLevel * 100)}%
          </motion.span>
          <motion.div
            className="mic-state"
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: isActive ? '#34d399' : '#64748b',
              boxShadow: isActive ? '0 0 12px #34d399' : 'none',
            }}
            animate={{ scale: isActive ? [1, 1.3, 1] : 1 }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        </div>

        {/* Vertical bar meter */}
        <motion.div
          className="mic-bar-container"
          style={{ width: '6px', height: '120px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden', position: 'relative' }}
        >
          <motion.div
            className="mic-bar-fill"
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              background: `linear-gradient(to top, ${accent} 0%, ${accent}88 50%, ${accent}44 100%)`,
              borderRadius: '3px 3px 0 0',
              boxShadow: `0 0 16px ${accent}88`,
            }}
            animate={{ height: `${Math.max(micLevel * 100, 3)}%` }}
            transition={{ duration: 0.05, ease: 'linear' }}
          />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

// Tool badge - shows when phase === TOOLING
function ToolBadge({ phase, toolName, accent, reducedMotion }) {
  if (phase !== Phase.TOOLING) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="tool-badge"
        key="tool-badge"
        style={{
          position: 'absolute',
          top: 100,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 20px',
          background: `rgba(10,14,26,0.9)`,
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: `1px solid ${accent}44`,
          borderRadius: '999px',
          boxShadow: `0 0 24px ${accent}22, inset 0 1px 0 rgba(255,255,255,0.05)`,
          pointerEvents: 'none',
          zIndex: 20,
        }}
        initial={{ opacity: 0, scale: 0.9, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: -10 }}
        transition={{ type: reducedMotion ? 'tween' : 'spring', stiffness: 200, damping: 14 }}
      >
        <motion.div
          className="tool-spinner"
          style={{
            width: 16,
            height: 16,
            border: `2px solid ${accent}33`,
            borderTopColor: accent,
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        <span className="tool-text mono-label" style={{ fontSize: '0.6rem', color: accent, letterSpacing: '0.1em', fontWeight: 600 }}>
          ACCESSING {toolName?.toUpperCase() || 'SYSTEMS'}
        </span>
      </motion.div>
    </AnimatePresence>
  );
}

// Conversation log - last 4 turns
function LogPanel({ messages, accent, reducedMotion }) {
  const recentMessages = useMemo(() => {
    if (!messages || messages.length === 0) return [];
    return messages.slice(-8); // Last 4 turns (user + assistant)
  }, [messages]);

  if (recentMessages.length === 0) return null;

  return (
    <motion.div
      className="hud-log"
      style={{
        position: 'absolute',
        bottom: 140,
        left: 20,
        right: 20,
        maxWidth: '600px',
        margin: '0 auto',
        padding: '16px 20px',
        background: 'rgba(10,14,26,0.85)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        border: `1px solid ${accent}22`,
        borderRadius: '12px',
        boxShadow: `0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)`,
        pointerEvents: 'none',
        zIndex: 10,
        overflow: 'hidden',
      }}
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.98 }}
      transition={{ type: reducedMotion ? 'tween' : 'spring', stiffness: 120, damping: 14 }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflow: 'auto' }}>
        {recentMessages.map((msg, i) => (
          <motion.div
            key={`${msg.id}-${i}`}
            className="log-entry"
            style={{
              display: 'flex',
              gap: '10px',
              padding: '8px 10px',
              background: msg.role === 'user' ? `rgba(34,211,238,0.08)` : `rgba(167,139,250,0.06)`,
              border: `1px solid ${msg.role === 'user' ? `${accent}22` : '#a78bfa22'}`,
              borderRadius: '8px',
              fontSize: '0.7rem',
              lineHeight: '1.5',
              color: '#cbd5e1',
            }}
            initial={{ opacity: 0, x: msg.role === 'user' ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: reducedMotion ? 'tween' : 'spring', stiffness: 180, damping: 12, delay: i * 0.04 }}
          >
            <span className="log-role mono-label" style={{ fontSize: '0.55rem', color: msg.role === 'user' ? accent : '#a78bfa', letterSpacing: '0.1em', fontWeight: 600, flexShrink: 0, marginTop: '2px' }}>
              {msg.role === 'user' ? 'USER' : 'AVNI'}
            </span>
            <span className="log-content" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {msg.content?.slice(0, 120)}
            </span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// Live caption - interim transcript
function Caption({ interimTranscript, isListening, accent, reducedMotion }) {
  if (!interimTranscript && !isListening) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="hud-caption"
        key="caption"
        style={{
          position: 'absolute',
          bottom: 280,
          left: '50%',
          transform: 'translateX(-50%)',
          maxWidth: '700px',
          padding: '14px 24px',
          background: 'rgba(10,14,26,0.9)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          border: `1px solid ${accent}44`,
          borderRadius: '12px',
          boxShadow: `0 0 32px ${accent}22, inset 0 1px 0 rgba(255,255,255,0.05)`,
          pointerEvents: 'none',
          zIndex: 15,
          textAlign: 'center',
        }}
        initial={{ opacity: 0, y: 10, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.97 }}
        transition={{ type: reducedMotion ? 'tween' : 'spring', stiffness: 180, damping: 14 }}
      >
        <motion.span
          className="caption-text"
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'clamp(0.9rem, 1.8vw, 1.1rem)',
            fontWeight: 400,
            color: '#f1f5f9',
            letterSpacing: '-0.01em',
          }}
          animate={{ opacity: isListening ? [1, 0.5, 1] : 1 }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          {interimTranscript || (isListening ? '…' : '')}
        </motion.span>
      </motion.div>
    </AnimatePresence>
  );
}

// Bottom hint line
function HudBottom({ phase, accent, reducedMotion }) {
  const hints = {
    [Phase.OFFLINE]: 'click · clap · or press Space to power up',
    [Phase.BOOT]: 'initialising…',
    [Phase.DORMANT]: 'say "hey avni" · Space to talk · G hands · V voice',
    [Phase.WAKING]: 'waking systems…',
    [Phase.LISTENING]: 'listening… press Space to stop',
    [Phase.THINKING]: 'processing…',
    [Phase.TOOLING]: 'accessing systems…',
    [Phase.SPEAKING]: 'responding… press Space to interrupt',
  };

  return (
    <motion.div
      className="hud-bottom"
      style={{
        position: 'absolute',
        bottom: 20,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        padding: '0 20px',
        pointerEvents: 'none',
        zIndex: 10,
      }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ type: reducedMotion ? 'tween' : 'spring', stiffness: 120, damping: 14, delay: 0.5 }}
    >
      <span className="hud-hint mono-label" style={{ fontSize: 'clamp(0.55rem, 1vw, 0.7rem)', color: 'rgba(148,163,184,0.6)', letterSpacing: '0.1em' }}>
        {hints[phase] || hints[Phase.DORMANT]}
      </span>
    </motion.div>
  );
}

// FX overlays - glitch/pulse/scan/shake/flash
function FxLayer({ effects, accent, reducedMotion }) {
  if (!effects || effects.length === 0) return null;

  return (
    <div className="hud-fx" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 30, overflow: 'hidden' }}>
      {effects.map((fx) => {
        const style = {
          position: 'absolute',
          inset: 0,
          opacity: 0,
          pointerEvents: 'none',
        };

        switch (fx.type) {
          case 'glitch':
            return (
              <motion.div
                key={fx.id}
                style={{ ...style, background: `repeating-linear-gradient(90deg, ${accent}11 0, ${accent}11 2px, transparent 2px, transparent 4px)`, mixBlendMode: 'screen' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.4, 0, 0.3, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              />
            );
          case 'pulse':
            return (
              <motion.div
                key={fx.id}
                style={{ ...style, background: `radial-gradient(circle at center, ${accent}33 0%, transparent 70%)`, mixBlendMode: 'screen' }}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: [0, 0.6, 0], scale: [0.5, 1.5, 2] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            );
          case 'scan':
            return (
              <motion.div
                key={fx.id}
                style={{ ...style, top: 0, height: '4px', background: `linear-gradient(90deg, transparent, ${accent}, transparent)`, boxShadow: `0 0 24px ${accent}`, mixBlendMode: 'screen' }}
                initial={{ opacity: 0, y: 0 }}
                animate={{ opacity: [0, 1, 0], y: ['0%', '100%'] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8, ease: 'easeInOut' }}
              />
            );
          case 'shake':
            return (
              <motion.div
                key={fx.id}
                style={{ ...style }}
                initial={{ x: 0 }}
                animate={{ x: [-8, 8, -6, 6, -4, 4, -2, 2, 0] }}
                exit={{ x: 0 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              >
                <div style={{ position: 'absolute', inset: 0, background: 'inherit' }} />
              </motion.div>
            );
          case 'flash':
            return (
              <motion.div
                key={fx.id}
                style={{ ...style, background: accent, mixBlendMode: 'screen' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.8, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
              />
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

// Main HUD component
export default function Hud() {
  const phase = useStore((s) => s.phase);
  const statusText = useStore((s) => s.statusText);
  const accent = useStore((s) => s.accent);
  const micLevel = useStore((s) => s.micLevel);
  const isListening = useStore((s) => s.isListening);
  const interimTranscript = useStore((s) => s.interimTranscript);
  const effects = useStore((s) => s.effects);
  const reducedMotion = useStore((s) => s.reducedMotion);

  // messages and toolName not available via store in this setup — skip log panel in live mode
  const messages = [];
  const toolName = null;

  return (
    <>
      {/* Four corner brackets */}
      <Corner position="tl" accent={accent} reducedMotion={reducedMotion} />
      <Corner position="tr" accent={accent} reducedMotion={reducedMotion} />
      <Corner position="bl" accent={accent} reducedMotion={reducedMotion} />
      <Corner position="br" accent={accent} reducedMotion={reducedMotion} />

      {/* Top bar */}
      <HudTop phase={phase} statusText={statusText} accent={accent} reducedMotion={reducedMotion} />

      {/* Left rail - Systems */}
      <RailLeft phase={phase} accent={accent} reducedMotion={reducedMotion} />

      {/* Right rail - Signal */}
      <RailRight micLevel={micLevel} isListening={isListening} accent={accent} reducedMotion={reducedMotion} />

      {/* Tool badge */}
      <ToolBadge phase={phase} toolName={toolName} accent={accent} reducedMotion={reducedMotion} />

      {/* Conversation log */}
      <LogPanel messages={messages} accent={accent} reducedMotion={reducedMotion} />

      {/* Live caption */}
      <Caption interimTranscript={interimTranscript} isListening={isListening} accent={accent} reducedMotion={reducedMotion} />

      {/* Bottom hint */}
      <HudBottom phase={phase} accent={accent} reducedMotion={reducedMotion} />

      {/* FX overlays */}
      <FxLayer effects={effects} accent={accent} reducedMotion={reducedMotion} />

      {/* HUD keyframe animations injected as plain style tag */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes glow-pulse {
          0%, 100% { box-shadow: 0 0 8px currentColor; }
          50% { box-shadow: 0 0 20px currentColor, 0 0 32px currentColor; }
        }
      `}</style>
    </>
  );
}