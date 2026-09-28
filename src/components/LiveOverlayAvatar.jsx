/**
 * ANYA LIVE OVERLAY AVATAR
 * ──────────────────────────────────────────────────────────────────────────────
 * A draggable floating avatar bubble that hovers over all other content.
 * Rendered via React.createPortal into document.body so it sits on top of
 * every other DOM element regardless of z-index stacking contexts.
 *
 * States:
 *   idle       → slow pulsing cyan glow
 *   listening  → animated sound-wave rings
 *   thinking   → spinning arc loader
 *   success    → brief green flash + checkmark
 *   error      → red shake
 *
 * Props:
 *   isActive        — boolean, render or not
 *   onOpen          — called when user taps avatar (open panel)
 *   onClose         — called when user long-presses or taps ✕
 *   avatarState     — 'idle' | 'listening' | 'thinking' | 'success' | 'error'
 *   statusText      — short string shown in bubble above avatar
 *   assistantName   — e.g. "Aanya"
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Mic, Brain, CheckCircle, AlertCircle } from 'lucide-react';

// ─── Avatar Icon by state ─────────────────────────────────────────────────────
function AvatarIcon({ state }) {
  if (state === 'listening') return <Mic className="w-8 h-8 text-cyan-300" />;
  if (state === 'thinking')  return <Brain className="w-8 h-8 text-violet-300 animate-pulse" />;
  if (state === 'success')   return <CheckCircle className="w-8 h-8 text-emerald-400" />;
  if (state === 'error')     return <AlertCircle className="w-8 h-8 text-red-400" />;
  // idle — ANYA face
  return (
    <span style={{ fontSize: 32, lineHeight: 1, filter: 'drop-shadow(0 0 8px rgba(0,220,255,0.9))' }}>
      🤖
    </span>
  );
}

// ─── State-based ring colors ──────────────────────────────────────────────────
const RING_COLORS = {
  idle:      'rgba(0, 220, 255, 0.25)',
  listening: 'rgba(0, 220, 255, 0.55)',
  thinking:  'rgba(139, 92, 246, 0.45)',
  success:   'rgba(52, 211, 153, 0.55)',
  error:     'rgba(248, 113, 113, 0.55)',
};
const GLOW_COLORS = {
  idle:      '0 0 20px rgba(0,220,255,0.4), 0 0 40px rgba(0,220,255,0.15)',
  listening: '0 0 30px rgba(0,220,255,0.7), 0 0 60px rgba(0,220,255,0.3)',
  thinking:  '0 0 20px rgba(139,92,246,0.6), 0 0 40px rgba(139,92,246,0.2)',
  success:   '0 0 24px rgba(52,211,153,0.7), 0 0 50px rgba(52,211,153,0.25)',
  error:     '0 0 20px rgba(248,113,113,0.6), 0 0 40px rgba(248,113,113,0.2)',
};

const AVATAR_SIZE = 72; // px
const EDGE_MARGIN = 12; // px from screen edge

export default function LiveOverlayAvatar({ isActive, onOpen, onClose, avatarState = 'idle', statusText = '', assistantName = 'Aanya' }) {
  // Position — start bottom-right
  const [pos, setPos] = useState(() => ({
    x: window.innerWidth - AVATAR_SIZE - EDGE_MARGIN - 16,
    y: window.innerHeight - AVATAR_SIZE - EDGE_MARGIN - 80,
  }));

  const [isDragging, setIsDragging] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, startPosX: 0, startPosY: 0, moved: false });
  const longPressRef = useRef(null);
  const statusTimeoutRef = useRef(null);

  // Show status text briefly when it changes
  useEffect(() => {
    if (statusText) {
      setShowStatus(true);
      clearTimeout(statusTimeoutRef.current);
      statusTimeoutRef.current = setTimeout(() => setShowStatus(false), 3500);
    } else {
      setShowStatus(false);
    }
    return () => clearTimeout(statusTimeoutRef.current);
  }, [statusText]);

  // ── Touch / Mouse drag ──────────────────────────────────────────────────────
  const handlePointerDown = useCallback((e) => {
    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    dragRef.current = {
      startX: clientX,
      startY: clientY,
      startPosX: pos.x,
      startPosY: pos.y,
      moved: false,
    };
    setIsDragging(true);

    // Long-press to show close button
    longPressRef.current = setTimeout(() => {
      setShowClose(true);
      try { if (navigator.vibrate) navigator.vibrate([30, 20, 30]); } catch {}
    }, 600);
  }, [pos]);

  const handlePointerMove = useCallback((e) => {
    if (!isDragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const dx = clientX - dragRef.current.startX;
    const dy = clientY - dragRef.current.startY;

    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      dragRef.current.moved = true;
      clearTimeout(longPressRef.current);
    }

    const newX = Math.max(EDGE_MARGIN, Math.min(window.innerWidth - AVATAR_SIZE - EDGE_MARGIN, dragRef.current.startPosX + dx));
    const newY = Math.max(EDGE_MARGIN + 60, Math.min(window.innerHeight - AVATAR_SIZE - EDGE_MARGIN, dragRef.current.startPosY + dy));
    setPos({ x: newX, y: newY });
  }, [isDragging]);

  const handlePointerUp = useCallback((e) => {
    clearTimeout(longPressRef.current);
    setIsDragging(false);

    if (!dragRef.current.moved) {
      // It was a tap, not a drag — open the panel
      if (onOpen) onOpen();
    }

    // Snap to nearest vertical edge
    const midScreen = window.innerWidth / 2;
    setPos(prev => ({
      x: prev.x + AVATAR_SIZE / 2 < midScreen
        ? EDGE_MARGIN
        : window.innerWidth - AVATAR_SIZE - EDGE_MARGIN,
      y: prev.y,
    }));

    // Save position to native bridge if available
    try {
      if (window.AnyaBridge?.saveDragPosition) {
        window.AnyaBridge.saveDragPosition(pos.x, pos.y);
      }
    } catch {}
  }, [onOpen, pos]);

  // ── Keyboard: Escape closes ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isActive) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isActive, onClose]);

  if (!isActive) return null;

  const ringColor = RING_COLORS[avatarState] || RING_COLORS.idle;
  const glowStyle = GLOW_COLORS[avatarState] || GLOW_COLORS.idle;

  const avatar = (
    <div
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        zIndex: 2147483647, // maximum z-index
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'none',
        transition: isDragging ? 'none' : 'left 0.35s cubic-bezier(0.34,1.56,0.64,1), top 0.1s ease',
      }}
      onMouseDown={handlePointerDown}
      onMouseMove={handlePointerMove}
      onMouseUp={handlePointerUp}
      onMouseLeave={handlePointerUp}
      onTouchStart={handlePointerDown}
      onTouchMove={handlePointerMove}
      onTouchEnd={handlePointerUp}
    >
      {/* Status bubble above avatar */}
      {showStatus && statusText && (
        <div
          style={{
            position: 'absolute',
            bottom: AVATAR_SIZE + 8,
            left: '50%',
            transform: 'translateX(-50%)',
            minWidth: 140,
            maxWidth: 260,
            whiteSpace: 'nowrap',
            background: 'rgba(6,10,18,0.92)',
            border: '1px solid rgba(0,220,255,0.3)',
            borderRadius: 12,
            padding: '6px 12px',
            fontSize: 11,
            color: '#e2e8f0',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            pointerEvents: 'none',
            animation: 'overlay-status-in 0.2s ease',
            zIndex: 2147483647,
          }}
        >
          {statusText}
          {/* Little triangle */}
          <div style={{
            position: 'absolute',
            bottom: -6,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0, height: 0,
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderTop: '6px solid rgba(0,220,255,0.3)',
          }} />
        </div>
      )}

      {/* Listening ripple rings */}
      {avatarState === 'listening' && (
        <>
          <div className="anya-overlay-ring" style={{ animationDelay: '0s',   borderColor: ringColor }} />
          <div className="anya-overlay-ring" style={{ animationDelay: '0.4s', borderColor: ringColor }} />
          <div className="anya-overlay-ring" style={{ animationDelay: '0.8s', borderColor: ringColor }} />
        </>
      )}

      {/* Main avatar circle */}
      <div
        style={{
          width: AVATAR_SIZE,
          height: AVATAR_SIZE,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, rgba(6,10,20,0.95) 0%, rgba(0,30,50,0.95) 100%)',
          border: `2px solid ${ringColor}`,
          boxShadow: glowStyle,
          backdropFilter: 'blur(24px)',
          position: 'relative',
          animation: avatarState === 'idle' ? 'anya-avatar-idle-pulse 3s ease-in-out infinite' :
                     avatarState === 'success' ? 'anya-avatar-success-flash 0.5s ease' :
                     avatarState === 'error' ? 'anya-avatar-shake 0.4s ease' : 'none',
        }}
      >
        <AvatarIcon state={avatarState} />

        {/* Thinking arc */}
        {avatarState === 'thinking' && (
          <div style={{
            position: 'absolute',
            inset: -4,
            borderRadius: '50%',
            border: '2px solid transparent',
            borderTopColor: 'rgba(139,92,246,0.9)',
            borderRightColor: 'rgba(139,92,246,0.5)',
            animation: 'spin 0.8s linear infinite',
          }} />
        )}

        {/* Idle inner glow */}
        {avatarState === 'idle' && (
          <div style={{
            position: 'absolute',
            inset: 4,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 40% 35%, rgba(0,220,255,0.12) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />
        )}
      </div>

      {/* Close button (appears after long-press) */}
      {showClose && (
        <button
          onClick={(e) => { e.stopPropagation(); setShowClose(false); onClose?.(); }}
          style={{
            position: 'absolute',
            top: -8,
            right: -8,
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: 'rgba(239,68,68,0.9)',
            border: '1.5px solid rgba(255,255,255,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
            zIndex: 2147483647,
          }}
        >
          <X size={12} color="white" />
        </button>
      )}
    </div>
  );

  return createPortal(avatar, document.body);
}
