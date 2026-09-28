/**
 * ANYA LIVE OVERLAY PANEL
 * ──────────────────────────────────────────────────────────────────────────────
 * The expanded HUD panel that slides up when the user taps the floating avatar.
 *
 * Features:
 *   • Mic button — starts/stops speech recognition via speechCapture.js
 *   • Live interim transcript shown while speaking
 *   • Command executed instantly via anyaOverlay.js runCommand()
 *   • Status string shown: "✅ Opened WhatsApp", "💬 Sending message..."
 *   • For conversational queries (needsModel=true): calls AI API directly and
 *     streams answer text into the panel
 *   • Auto-collapses after 4s of inactivity
 *   • ✕ button to close panel (return to avatar idle state)
 *
 * Props:
 *   isOpen          — boolean
 *   onClose         — fn: collapse panel back to avatar
 *   onAvatarState   — fn(state): update avatar visual state
 *   onStatusText    — fn(text): update status bubble on avatar
 *   settings        — app settings (apiKey, assistantName, etc.)
 *   onSendToChat    — fn(text, response): optionally log exchange to main chat
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Mic, MicOff, X, Zap, Bot, ChevronDown } from 'lucide-react';
import { startSpeech, stopSpeech, isListening } from '../lib/speechCapture';
import { runCommand } from '../lib/anyaOverlay';
import { thinkOnDevice } from '../lib/neuralEngine';

const PANEL_WIDTH = 320;
const AUTO_CLOSE_MS = 5000;

export default function LiveOverlayPanel({ isOpen, onClose, onAvatarState, onStatusText, settings = {}, onSendToChat }) {
  const [isListeningState, setIsListeningState] = useState(false);
  const [interim, setInterim] = useState('');
  const [lastCommand, setLastCommand] = useState('');
  const [statusLine, setStatusLine] = useState('Tap the mic or speak a command');
  const [aiAnswer, setAiAnswer] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const autoCloseRef = useRef(null);
  const panelRef = useRef(null);
  const assistantName = settings.assistantName || 'Aanya';

  // ── Auto-close after inactivity ─────────────────────────────────────────────
  const resetAutoClose = useCallback(() => {
    clearTimeout(autoCloseRef.current);
    autoCloseRef.current = setTimeout(() => {
      if (!isListeningState && !isThinking) {
        stopSpeech();
        onClose?.();
      }
    }, AUTO_CLOSE_MS);
  }, [isListeningState, isThinking, onClose]);

  useEffect(() => {
    if (isOpen) resetAutoClose();
    return () => clearTimeout(autoCloseRef.current);
  }, [isOpen, resetAutoClose]);

  // ── Clean up speech on unmount ───────────────────────────────────────────────
  useEffect(() => {
    return () => { stopSpeech(); clearTimeout(autoCloseRef.current); };
  }, []);

  // ── Execute a voice/text command ─────────────────────────────────────────────
  const executeCommand = useCallback(async (text) => {
    if (!text.trim()) return;
    setLastCommand(text);
    setInterim('');
    setAiAnswer('');
    setIsThinking(true);
    onAvatarState?.('thinking');
    setStatusLine(`⚡ ${text}`);
    resetAutoClose();

    try {
      const result = await runCommand(text, assistantName);

      if (result.needsModel) {
        // Conversational query — ask the AI model
        setStatusLine('🧠 Thinking...');
        try {
          const modelMessages = [{ role: 'user', content: text }];
          const reply = await thinkOnDevice(modelMessages, settings);
          const cleanReply = reply
            .replace(/\*\*/g, '').replace(/\*/g, '').replace(/#{1,6}\s/g, '')
            .trim();
          setAiAnswer(cleanReply);
          setStatusLine('✅ Done');
          onAvatarState?.('success');
          onStatusText?.('✅ ' + cleanReply.slice(0, 40) + (cleanReply.length > 40 ? '…' : ''));
          onSendToChat?.(text, cleanReply);
        } catch (e) {
          setStatusLine('⚠️ Could not reach AI');
          onAvatarState?.('error');
        }
      } else {
        // Tool/device action executed
        const allOk = result.results.every(r => r.res?.success !== false);
        if (allOk) {
          setStatusLine(result.statusText || '✅ Done');
          onAvatarState?.('success');
          onStatusText?.(result.statusText || '✅ Done');
        } else {
          const errTool = result.results.find(r => r.res?.success === false);
          const errMsg = errTool?.res?.error || 'Action failed';
          setStatusLine(`⚠️ ${errMsg}`);
          onAvatarState?.('error');
          onStatusText?.(`⚠️ ${errMsg}`);
        }
      }
    } catch (e) {
      console.error('[LiveOverlay] Command error:', e);
      setStatusLine(`⚠️ Error: ${e.message}`);
      onAvatarState?.('error');
    } finally {
      setIsThinking(false);
      resetAutoClose();
      // Return to idle after brief success/error display
      setTimeout(() => {
        onAvatarState?.('idle');
        onStatusText?.('');
      }, 2500);
    }
  }, [assistantName, settings, onAvatarState, onStatusText, onSendToChat, resetAutoClose]);

  // ── Mic toggle ────────────────────────────────────────────────────────────────
  const handleMicToggle = useCallback(() => {
    if (isListeningState) {
      stopSpeech();
      setIsListeningState(false);
      setInterim('');
      onAvatarState?.('idle');
      return;
    }

    const started = startSpeech({
      assistantName,
      onInterim: (t) => {
        setInterim(t);
        resetAutoClose();
      },
      onFinal: (t) => {
        setIsListeningState(false);
        onAvatarState?.('thinking');
        executeCommand(t);
      },
      onError: (err) => {
        console.warn('[LiveOverlay] Speech error:', err);
        setIsListeningState(false);
        setInterim('');
        setStatusLine('⚠️ Mic error — tap to retry');
        onAvatarState?.('error');
        setTimeout(() => { onAvatarState?.('idle'); setStatusLine('Tap mic to speak'); }, 2000);
      },
    });

    if (started) {
      setIsListeningState(true);
      onAvatarState?.('listening');
      setStatusLine('Listening...');
      setAiAnswer('');
      resetAutoClose();
      try { if (navigator.vibrate) navigator.vibrate(40); } catch {}
    }
  }, [isListeningState, assistantName, onAvatarState, executeCommand, resetAutoClose]);

  if (!isOpen) return null;

  const panel = (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        bottom: 100,
        right: 16,
        width: PANEL_WIDTH,
        zIndex: 2147483646,
        background: 'linear-gradient(145deg, rgba(6,10,20,0.97) 0%, rgba(0,30,50,0.97) 100%)',
        border: '1px solid rgba(0,220,255,0.22)',
        borderRadius: 20,
        backdropFilter: 'blur(32px) saturate(180%)',
        WebkitBackdropFilter: 'blur(32px) saturate(180%)',
        boxShadow: '0 8px 48px rgba(0,0,0,0.7), 0 0 40px rgba(0,220,255,0.08)',
        overflow: 'hidden',
        animation: 'anya-panel-slide-in 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Zap size={14} color="#00dcff" />
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', color: '#67e8f9', textTransform: 'uppercase' }}>
            {assistantName} · Live Mode
          </span>
        </div>
        <button
          onClick={() => { stopSpeech(); onClose?.(); }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: 4, color: 'rgba(255,255,255,0.45)', display: 'flex',
          }}
        >
          <ChevronDown size={16} />
        </button>
      </div>

      {/* Status line */}
      <div style={{
        padding: '12px 16px 10px',
        fontSize: 12,
        color: isThinking ? '#a78bfa' : 'rgba(255,255,255,0.65)',
        minHeight: 36,
        transition: 'color 0.3s',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}>
        {interim ? (
          <span style={{ color: '#67e8f9' }}>💬 {interim}</span>
        ) : (
          statusLine
        )}
      </div>

      {/* AI Answer */}
      {aiAnswer && (
        <div style={{
          padding: '12px 16px',
          maxHeight: 180,
          overflowY: 'auto',
          fontSize: 13,
          color: '#e2e8f0',
          lineHeight: 1.6,
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          background: 'rgba(0,0,0,0.2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <Bot size={14} color="#67e8f9" style={{ marginTop: 2, flexShrink: 0 }} />
            <span>{aiAnswer}</span>
          </div>
        </div>
      )}

      {/* Mic Button */}
      <div style={{ padding: '16px', display: 'flex', justifyContent: 'center' }}>
        <button
          onClick={handleMicToggle}
          disabled={isThinking}
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            border: `2px solid ${isListeningState ? 'rgba(0,220,255,0.7)' : isThinking ? 'rgba(139,92,246,0.5)' : 'rgba(0,220,255,0.2)'}`,
            cursor: isThinking ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            background: isListeningState
              ? 'linear-gradient(135deg, rgba(0,220,255,0.3) 0%, rgba(0,150,255,0.2) 100%)'
              : isThinking
                ? 'linear-gradient(135deg, rgba(139,92,246,0.3) 0%, rgba(99,46,186,0.2) 100%)'
                : 'linear-gradient(135deg, rgba(0,220,255,0.12) 0%, rgba(0,30,60,0.8) 100%)',
            boxShadow: isListeningState
              ? '0 0 24px rgba(0,220,255,0.5), 0 4px 16px rgba(0,0,0,0.4)'
              : '0 4px 16px rgba(0,0,0,0.4)',
          }}
        >
          {isThinking ? (
            <div style={{
              width: 28, height: 28, border: '2px solid transparent',
              borderTopColor: '#a78bfa', borderRadius: '50%',
              animation: 'spin 0.7s linear infinite',
            }} />
          ) : isListeningState ? (
            <MicOff size={24} color="#00dcff" />
          ) : (
            <Mic size={24} color="rgba(0,220,255,0.7)" />
          )}
        </button>
      </div>

      {/* Mic hint */}
      <div style={{ textAlign: 'center', paddingBottom: 14, fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
        {isListeningState ? 'Tap to stop listening' : isThinking ? 'Processing...' : 'Tap to speak a command'}
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
