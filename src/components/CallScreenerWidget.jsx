import React, { useState, useEffect } from 'react';
import { Phone, PhoneCall, PhoneOff, Mic, Send, Sparkles, X, User, Volume2 } from 'lucide-react';
import { takeoverCall, hangupCall, sendCallInstruction } from '../lib/telephonyBridge';
import { triggerHaptic } from '../lib/neuralEngine';

export default function CallScreenerWidget({ callSession, onClose, assistantName = 'Aanya' }) {
  const [customInstruction, setCustomInstruction] = useState('');
  const [isTakingOver, setIsTakingOver] = useState(false);
  const [isEnding, setIsEnding] = useState(false);

  if (!callSession) return null;

  const handleTakeover = async () => {
    setIsTakingOver(true);
    triggerHaptic([100, 50, 100]);
    await takeoverCall(callSession.callSid);
    setTimeout(() => setIsTakingOver(false), 2000);
  };

  const handleHangup = async () => {
    setIsEnding(true);
    triggerHaptic(50);
    await hangupCall(callSession.callSid);
    setTimeout(() => {
      setIsEnding(false);
      onClose();
    }, 1000);
  };

  const handleSendInstruction = async (text) => {
    const val = (text || customInstruction).trim();
    if (!val) return;
    triggerHaptic(30);
    await sendCallInstruction(callSession.callSid, val);
    setCustomInstruction('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md select-none animate-fade-in">
      <div className="relative w-full max-w-lg bg-obsidian-900 border border-cyan-500/50 rounded-2xl overflow-hidden shadow-2xl flex flex-col space-y-0 border-cyan-glow">
        
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-obsidian-950 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <PhoneCall className="w-3.5 h-3.5 animate-bounce" />
              LIVE {assistantName.toUpperCase()} CALL SCREENER
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Caller Info Banner */}
        <div className="p-4 bg-gradient-to-r from-cyan-950/40 via-obsidian-900 to-obsidian-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
              <User className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white font-mono">
                {callSession.callerName || callSession.callerNumber || 'Incoming Caller'}
              </h3>
              <div className="text-[11px] font-mono text-cyan-400 flex items-center gap-2">
                <span>{callSession.callerNumber}</span>
                <span>•</span>
                <span className="text-emerald-400 font-semibold">{callSession.state || 'SCREENING'}</span>
              </div>
            </div>
          </div>

          <div className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300">
            {callSession.duration ? `${callSession.duration}s` : 'Active'}
          </div>
        </div>

        {/* Executive AI Summary Box */}
        <div className="p-3 bg-obsidian-950/90 border-b border-slate-800 font-mono text-xs">
          <div className="flex items-center gap-1.5 text-[11px] text-cyan-400 font-bold mb-1">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>AI EXECUTIVE CALL SUMMARY</span>
          </div>
          <div className="text-slate-200 text-[11px] leading-relaxed bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
            {callSession.summary || 'Aanya is conversing with the caller to identify reason for call...'}
          </div>
        </div>

        {/* Live Transcript Stream */}
        <div className="p-4 max-h-48 overflow-y-auto space-y-2 bg-obsidian-900/60 font-mono text-xs">
          {callSession.transcript && callSession.transcript.length > 0 ? (
            callSession.transcript.map((t, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${t.speaker === 'Aanya' ? 'items-start' : 'items-end'}`}
              >
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-[11px] leading-relaxed border ${
                  t.speaker === 'Aanya'
                    ? 'bg-cyan-950/40 border-cyan-500/30 text-cyan-200'
                    : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200'
                }`}>
                  <div className="text-[9px] font-bold opacity-75 mb-0.5">
                    {t.speaker} • {t.timestamp}
                  </div>
                  <div>{t.text}</div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-6 text-slate-400 text-xs font-mono">
              Listening to caller responses in real time...
            </div>
          )}
        </div>

        {/* Quick Instructions & Controls */}
        <div className="p-4 bg-obsidian-950 border-t border-slate-800 space-y-3">
          
          {/* Quick Chip Actions */}
          <div className="flex flex-wrap gap-1.5">
            {[
              "Tell them I'm in a meeting",
              "Driving, will call back in 30m",
              "Ask them to email details",
            ].map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleSendInstruction(chip)}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] font-mono text-slate-300 hover:text-cyan-300 transition-colors"
              >
                + {chip}
              </button>
            ))}
          </div>

          {/* Custom Instruction Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={customInstruction}
              onChange={(e) => setCustomInstruction(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendInstruction()}
              placeholder="Tell Aanya what to speak to caller..."
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
            />
            <button
              onClick={() => handleSendInstruction()}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 font-mono text-xs flex items-center gap-1"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Major Actions (Take Over vs Hang Up) */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              onClick={handleTakeover}
              disabled={isTakingOver}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50"
            >
              <Phone className="w-4 h-4 fill-current" />
              <span>{isTakingOver ? 'Bridging Call...' : 'Take Over Call'}</span>
            </button>

            <button
              onClick={handleHangup}
              disabled={isEnding}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 font-mono font-bold text-xs transition-all active:scale-95 disabled:opacity-50"
            >
              <PhoneOff className="w-4 h-4" />
              <span>{isEnding ? 'Ending Call...' : 'Decline / Hang Up'}</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
