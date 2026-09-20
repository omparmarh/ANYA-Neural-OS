import React from 'react';
import { CheckSquare, Square, Trash2, Tag } from 'lucide-react';

export default function TodoWidget({ task, onToggleDone, onDelete }) {
  const { id, text, done, priority = 'normal', created } = task;

  const priorityColors = {
    high: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
    normal: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
    low: 'text-slate-400 bg-slate-500/10 border-slate-500/30',
  };

  return (
    <div className={`flex items-center justify-between gap-3 p-3 my-1.5 rounded-xl border transition-all ${
      done 
        ? 'bg-slate-900/40 border-slate-800 opacity-60' 
        : 'bg-obsidian-900/90 border-slate-700/80 hover:border-cyan-500/30'
    }`}>
      <div className="flex items-center gap-3 overflow-hidden">
        <button
          onClick={() => onToggleDone(id)}
          className="text-slate-400 hover:text-cyan-400 transition-colors flex-shrink-0"
        >
          {done ? (
            <CheckSquare className="w-5 h-5 text-emerald-400" />
          ) : (
            <Square className="w-5 h-5" />
          )}
        </button>

        <span className={`text-xs sm:text-sm font-medium truncate ${
          done ? 'line-through text-slate-500' : 'text-slate-200'
        }`}>
          {text}
        </span>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase border ${priorityColors[priority] || priorityColors.normal}`}>
          {priority}
        </span>

        <button
          onClick={() => onDelete(id)}
          className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-red-400 transition-colors"
          title="Delete Task"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
