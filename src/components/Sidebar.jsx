import React from 'react';
import {
  Plus, MessageSquare, Trash2, Clock, CheckSquare,
  FileText, Shield, Cpu, Activity, X, LogOut, User
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
  tokenUsage = {},
  currentUser,
  onLogout
}) {
  const totalTokens = (tokenUsage.gemini?.total || 0) + (tokenUsage.groq?.total || 0) + (tokenUsage.openrouter?.total || 0);

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'rgba(2,4,10,0.75)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-50 w-[270px] flex flex-col select-none transition-transform duration-300 ease-in-out glass-sidebar ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        {/* ── Header row ──────────────────────────────────────── */}
        <div className="p-3 border-b border-white/[0.06] flex items-center justify-between gap-2">
          {/* Brand mini */}
          <div className="flex items-center gap-2 pl-1">
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, rgba(0,200,255,0.28) 0%, rgba(0,100,200,0.18) 100%)',
                border: '1px solid rgba(0,210,255,0.38)',
                boxShadow: '0 0 12px rgba(0,210,255,0.22)',
              }}
            >
              <Cpu className="w-3.5 h-3.5 text-cyan-300" />
            </div>
            <span
              className="text-[11px] font-black tracking-wider font-mono"
              style={{
                background: 'linear-gradient(90deg,#67e8f9,#22d3ee)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              ANYA OS
            </span>
          </div>

          <button
            onClick={onClose}
            className="lg:hidden btn-icon"
            style={{ padding: '6px', borderRadius: '8px' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── New Chat Button ──────────────────────────────────── */}
        <div className="px-3 pt-3 pb-2">
          <button
            className="btn-new-chat app-no-drag"
            onClick={() => {
              onNewThread();
              if (window.innerWidth < 1024) onClose();
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Session</span>
          </button>
        </div>

        {/* ── Quick Tools ──────────────────────────────────────── */}
        <div className="px-3 pb-2">
          <div className="section-label mb-2">Autonomous Tools</div>
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { id: 'timer',  label: 'Timer',  icon: Clock },
              { id: 'alarm',  label: 'Alarm',  icon: Activity },
              { id: 'note',   label: 'Notes',  icon: FileText },
              { id: 'task',   label: 'Tasks',  icon: CheckSquare },
            ].map(tool => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.id}
                  onClick={() => onQuickAction(tool.id)}
                  className="quick-chip app-no-drag"
                >
                  <Icon className="w-4 h-4 text-cyan-400" />
                  <span>{tool.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Divider ─────────────────────────────────────────── */}
        <div className="mx-3 border-t border-white/[0.05]" />

        {/* ── Thread List ──────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          <div className="section-label px-2 py-1.5 flex items-center justify-between">
            <span>Memory Threads</span>
            <span className="text-[9px] font-mono" style={{ color: 'rgba(100,116,139,0.55)' }}>
              {threads.length}
            </span>
          </div>

          {threads.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <MessageSquare className="w-8 h-8 mx-auto mb-3 text-slate-700" />
              <p className="text-xs text-slate-500 font-mono">No sessions yet.</p>
              <p className="text-[10px] text-slate-600 mt-1">Start a new conversation.</p>
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
                  className={`thread-item group flex items-center justify-between app-no-drag ${isActive ? 'active' : ''}`}
                >
                  <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
                    <MessageSquare
                      className="w-3.5 h-3.5 flex-shrink-0"
                      style={{ color: isActive ? '#67e8f9' : 'rgba(100,116,139,0.6)' }}
                    />
                    <span
                      className="truncate text-xs font-medium min-w-0"
                      style={{ color: isActive ? '#e2e8f0' : 'rgba(148,163,184,0.75)' }}
                    >
                      {thread.title || 'Conversation'}
                    </span>
                  </div>

                  <button
                    onClick={e => { e.stopPropagation(); onDeleteThread(thread.id); }}
                    className="opacity-0 group-hover:opacity-100 flex-shrink-0 p-1 rounded-md transition-all"
                    style={{ color: 'rgba(100,116,139,0.8)' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(100,116,139,0.8)'}
                    title="Delete Thread"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* ── Footer: Token Tracker + User + Privacy ──────────── */}
        <div className="p-3 border-t border-white/[0.05] space-y-2">
          {/* Token Tracker */}
          <div
            className="p-2.5 rounded-xl"
            style={{
              background: 'rgba(0,220,255,0.04)',
              border: '1px solid rgba(0,220,255,0.12)',
            }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5">
                <Cpu className="w-3 h-3 text-cyan-400" />
                Tokens Used
              </span>
              <span className="text-[10px] font-mono font-bold text-cyan-300">
                {totalTokens.toLocaleString()}
              </span>
            </div>
            <div
              className="grid grid-cols-3 gap-1 text-[9px] font-mono text-center pt-1.5"
              style={{ borderTop: '1px solid rgba(255,255,255,0.05)', color: 'rgba(100,116,139,0.7)' }}
            >
              <div>G: {tokenUsage.gemini?.total || 0}</div>
              <div>Q: {tokenUsage.groq?.total || 0}</div>
              <div>R: {tokenUsage.openrouter?.total || 0}</div>
            </div>
          </div>

          {/* User row */}
          {currentUser && (
            <div className="flex items-center gap-2 px-1">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  background: 'rgba(16,185,129,0.14)',
                  border: '1px solid rgba(16,185,129,0.30)',
                }}
              >
                <User className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-medium text-slate-300 truncate">{currentUser.name || currentUser.email}</div>
                <div className="text-[9px] font-mono text-slate-500">{currentUser.role || 'user'}</div>
              </div>
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="p-1 rounded-md text-slate-500 hover:text-red-400 transition-colors app-no-drag"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Privacy */}
          <button
            onClick={onOpenPrivacy}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-slate-500 hover:text-slate-300 text-[11px] transition-colors app-no-drag"
          >
            <Shield className="w-3.5 h-3.5 text-cyan-500/60" />
            <span>Privacy &amp; Architecture</span>
          </button>
        </div>
      </aside>
    </>
  );
}
