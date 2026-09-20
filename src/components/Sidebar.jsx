import React from 'react';
import { 
  Plus, MessageSquare, Trash2, Clock, CheckSquare, 
  FileText, Shield, Cpu, Activity, Camera, X, Hash
} from 'lucide-react';

export default function Sidebar({
  isOpen,
  onClose,
  threads,
  activeThreadId,
  onSelectThread,
  onNewThread,
  onDeleteThread,
  onOpenPrivacy,
  onQuickAction,
  tokenUsage = {}
}) {
  const totalTokens = (tokenUsage.gemini?.total || 0) + (tokenUsage.groq?.total || 0) + (tokenUsage.openrouter?.total || 0);

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside className={`fixed lg:static top-0 bottom-0 left-0 z-40 w-72 bg-obsidian-950/95 border-r border-cyan-500/20 flex flex-col transition-transform duration-300 ease-in-out select-none ${
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        {/* Top: New Session & Close for Mobile */}
        <div className="p-4 border-b border-slate-850 flex items-center justify-between gap-2">
          <button
            onClick={() => {
              onNewThread();
              if (window.innerWidth < 1024) onClose();
            }}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold tracking-wide transition-all shadow-cyan-glow/20 active:scale-98"
          >
            <Plus className="w-4 h-4" />
            <span>New Session</span>
          </button>

          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-lg bg-slate-900 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Tools Grid */}
        <div className="p-3 border-b border-slate-850">
          <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-2 px-1">
            Autonomous Tools
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { id: 'timer', label: 'Timer', icon: Clock },
              { id: 'alarm', label: 'Alarm', icon: Activity },
              { id: 'note', label: 'Note', icon: FileText },
              { id: 'task', label: 'Task', icon: CheckSquare },
            ].map(tool => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.id}
                  onClick={() => onQuickAction(tool.id)}
                  className="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-900/60 hover:bg-cyan-950/40 text-slate-300 hover:text-cyan-300 border border-slate-800 hover:border-cyan-500/30 transition-all text-[10px] font-medium"
                >
                  <Icon className="w-4 h-4 mb-1 text-cyan-400" />
                  <span>{tool.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Memory Threads List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-2 px-1 flex items-center justify-between">
            <span>Memory Threads</span>
            <span className="text-[9px] font-mono text-slate-500">{threads.length}</span>
          </div>

          {threads.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400">
              No previous threads. Start chatting with ANYA.
            </div>
          ) : (
            threads.map(thread => {
              const isActive = thread.id === activeThreadId;
              return (
                <div
                  key={thread.id}
                  onClick={() => {
                    onSelectThread(thread.id);
                    if (window.innerWidth < 1024) onClose();
                  }}
                  className={`group flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                    isActive 
                      ? 'bg-cyan-950/30 border-cyan-500/40 text-white shadow-sm' 
                      : 'bg-transparent border-transparent text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <MessageSquare className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                    <div className="truncate text-xs font-medium">
                      {thread.title || 'Conversation'}
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteThread(thread.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-red-400 transition-all"
                    title="Delete Thread"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom: Diagnostics & Privacy Policy */}
        <div className="p-3 border-t border-slate-850 space-y-2 bg-obsidian-950">
          {/* Token Tracker Card */}
          <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                <Cpu className="w-3 h-3 text-cyan-400" />
                <span>Tokens Consumed</span>
              </span>
              <span className="text-[10px] font-mono font-bold text-cyan-300">
                {totalTokens.toLocaleString()}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1 text-[9px] font-mono text-slate-400 text-center pt-1 border-t border-slate-800/60">
              <div>G: {tokenUsage.gemini?.total || 0}</div>
              <div>Q: {tokenUsage.groq?.total || 0}</div>
              <div>R: {tokenUsage.openrouter?.total || 0}</div>
            </div>
          </div>

          <button
            onClick={onOpenPrivacy}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 text-xs transition-colors"
          >
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            <span>Privacy & Architecture</span>
          </button>
        </div>
      </aside>
    </>
  );
}
