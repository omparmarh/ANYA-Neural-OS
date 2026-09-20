import React from 'react';
import { Play, Pause, Plus, Trash2, Timer as TimerIcon } from 'lucide-react';

export default function TimerWidget({ timer, onTogglePause, onAddMinute, onCancel }) {
  const { id, label, remainingSeconds, totalSeconds, isPaused, isFinished } = timer;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  
  const progressPercent = totalSeconds > 0 ? ((totalSeconds - remainingSeconds) / totalSeconds) * 100 : 100;

  return (
    <div className={`relative overflow-hidden rounded-xl border p-4 my-2 transition-all ${
      isFinished 
        ? 'bg-red-950/40 border-red-500/50 shadow-lg shadow-red-500/20 animate-pulse' 
        : 'bg-obsidian-900/90 border-cyan-500/30 shadow-cyan-glow'
    }`}>
      {/* Background Progress Bar */}
      <div 
        className="absolute left-0 bottom-0 top-0 bg-cyan-500/10 transition-all duration-1000 -z-0"
        style={{ width: `${progressPercent}%` }}
      />

      <div className="relative z-10 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-lg border ${
            isFinished ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
          }`}>
            <TimerIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-slate-400">
              {label || 'Countdown Timer'}
            </div>
            <div className="text-2xl font-black font-mono tracking-tight text-white">
              {isFinished ? '00:00 - TIME UP' : formattedTime}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5">
          {!isFinished && (
            <>
              <button
                onClick={() => onTogglePause(id)}
                className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-cyan-500/40 transition-colors"
                title={isPaused ? 'Resume' : 'Pause'}
              >
                {isPaused ? <Play className="w-4 h-4 text-emerald-400 fill-emerald-400" /> : <Pause className="w-4 h-4 text-amber-400 fill-amber-400" />}
              </button>
              <button
                onClick={() => onAddMinute(id)}
                className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-cyan-500/40 transition-colors flex items-center gap-0.5 text-xs font-mono"
                title="Add 1 Minute"
              >
                <Plus className="w-3.5 h-3.5 text-cyan-400" />
                <span>1m</span>
              </button>
            </>
          )}

          <button
            onClick={() => onCancel(id)}
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-red-950/60 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-500/40 transition-colors"
            title="Dismiss / Cancel"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
