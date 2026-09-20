import React from 'react';
import { Bell, BellOff, Trash2, Clock } from 'lucide-react';

export default function AlarmWidget({ alarm, onToggleActive, onDelete }) {
  const { id, time, label, active, isRinging } = alarm;

  return (
    <div className={`relative overflow-hidden rounded-xl border p-4 my-2 transition-all ${
      isRinging 
        ? 'bg-amber-950/40 border-amber-500/60 shadow-lg shadow-amber-500/20 animate-bounce' 
        : 'bg-obsidian-900/90 border-slate-700/80 hover:border-cyan-500/30'
    }`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-lg border ${
            isRinging 
              ? 'bg-amber-500/20 border-amber-500 text-amber-400' 
              : active 
                ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' 
                : 'bg-slate-800 border-slate-700 text-slate-500'
          }`}>
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-slate-400">
              {label || 'Scheduled Alarm'}
            </div>
            <div className={`text-2xl font-black font-mono tracking-tight ${active ? 'text-white' : 'text-slate-500 line-through'}`}>
              {time}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggleActive(id)}
            className={`p-2 rounded-lg border transition-colors ${
              active 
                ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-300' 
                : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'
            }`}
            title={active ? 'Disable Alarm' : 'Enable Alarm'}
          >
            {active ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
          </button>

          <button
            onClick={() => onDelete(id)}
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-red-950/60 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-500/40 transition-colors"
            title="Delete Alarm"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
