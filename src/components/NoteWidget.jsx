import React, { useState } from 'react';
import { FileText, Copy, Check, Trash2, Edit3, Save } from 'lucide-react';

export default function NoteWidget({ note, onUpdate, onDelete }) {
  const { id, title, content, timestamp } = note;
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(title || 'Quick Note');
  const [editedContent, setEditedContent] = useState(content || '');

  const handleCopy = () => {
    navigator.clipboard.writeText(`${title}\n\n${content}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    onUpdate(id, { title: editedTitle, content: editedContent });
    setIsEditing(false);
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-700/80 bg-obsidian-900/90 p-4 my-2 shadow-lg transition-all hover:border-cyan-500/30">
      <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-cyan-400" />
          {isEditing ? (
            <input
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              className="bg-slate-950 border border-cyan-500/40 rounded px-2 py-0.5 text-xs font-semibold text-white focus:outline-none"
            />
          ) : (
            <h4 className="text-sm font-semibold text-white tracking-wide">{title || 'Quick Note'}</h4>
          )}
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[10px] font-mono text-slate-400 mr-1">{timestamp || 'Saved'}</span>
          
          {isEditing ? (
            <button
              onClick={handleSave}
              className="p-1.5 rounded-lg bg-emerald-950/40 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-900/40 transition-colors"
              title="Save Note"
            >
              <Save className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-cyan-300 transition-colors"
              title="Edit Note"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-cyan-300 transition-colors"
            title="Copy Note"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => onDelete(id)}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-red-400 transition-colors"
            title="Delete Note"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {isEditing ? (
        <textarea
          value={editedContent}
          onChange={(e) => setEditedContent(e.target.value)}
          rows={3}
          className="w-full bg-slate-950 border border-cyan-500/40 rounded p-2 text-xs text-slate-200 focus:outline-none font-mono"
        />
      ) : (
        <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
          {content}
        </p>
      )}
    </div>
  );
}
