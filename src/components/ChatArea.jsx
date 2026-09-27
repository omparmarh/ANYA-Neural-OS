import React, { useEffect, useRef, useState } from 'react';
import {
  Bot, User, Copy, Check, FileText, ExternalLink,
  Sparkles, Terminal, Volume2, Zap
} from 'lucide-react';
import { marked } from 'marked';
import TimerWidget from './TimerWidget';
import AlarmWidget from './AlarmWidget';
import NoteWidget from './NoteWidget';
import TodoWidget from './TodoWidget';
import AppLauncherWidget from './AppLauncherWidget';
import MediaControlWidget from './MediaControlWidget';

marked.setOptions({ gfm: true, breaks: true });

// ── Welcome prompts ────────────────────────────────────────────
const QUICK_PROMPTS = [
  { icon: '⏱', label: 'Set a 25-min deep focus timer' },
  { icon: '📸', label: 'Scan my camera and analyze' },
  { icon: '💬', label: 'Open WhatsApp and message Alex' },
  { icon: '🔍', label: 'Search quantum computing news' },
  { icon: '📄', label: 'Create a PDF report template' },
  { icon: '🎵', label: 'Play lo-fi study music on YouTube' },
];

export default function ChatArea({
  messages,
  isThinking,
  settings,
  onSpeakMessage,
  onToggleTimerPause,
  onAddMinuteToTimer,
  onCancelTimer,
  onToggleAlarmActive,
  onDeleteAlarm,
  onUpdateNote,
  onDeleteNote,
  onToggleTaskDone,
  onDeleteTask
}) {
  const scrollRef = useRef(null);
  const [copiedIndex, setCopiedIndex] = useState(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  const handleCopyCode = (code, index) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // ── Render message content ──────────────────────────────────
  const renderMessageContent = (content, msgIndex) => {
    if (!content) return null;

    const parts = content.split(/(```[\s\S]*?```)/g);

    return parts.map((part, pIdx) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const lines = part.slice(3, -3).trim().split('\n');
        const lang = lines[0].trim();
        const code = lines.slice(lang.match(/^[a-z0-9_+#-]+$/i) ? 1 : 0).join('\n');
        const uniqueKey = `${msgIndex}-${pIdx}`;

        return (
          <div key={uniqueKey} className="code-block-wrapper my-2.5">
            <div className="code-block-header">
              <span>{lang || 'code'}</span>
              <button
                onClick={() => handleCopyCode(code, uniqueKey)}
                className="flex items-center gap-1 hover:text-cyan-400 transition-colors"
              >
                {copiedIndex === uniqueKey ? (
                  <><Check className="w-3 h-3 text-emerald-400" /><span className="text-emerald-400">Copied!</span></>
                ) : (
                  <><Copy className="w-3 h-3" /><span>Copy</span></>
                )}
              </button>
            </div>
            <div className="code-block-body">
              <code>{code}</code>
            </div>
          </div>
        );
      }

      const parsedHtml = marked.parse(part);
      return (
        <div
          key={pIdx}
          className="markdown-content"
          dangerouslySetInnerHTML={{ __html: parsedHtml }}
        />
      );
    });
  };

  const assistantName = settings?.assistantName || 'Aanya';

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 cyber-grid select-text"
      style={{ scrollBehavior: 'smooth' }}
    >
      {/* ── Welcome / Empty State ──────────────────────────────── */}
      {messages.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-center p-5 gap-6">
          {/* Core Icon */}
          <div className="relative">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(0,200,255,0.18) 0%, rgba(0,120,180,0.12) 100%)',
                border: '1px solid rgba(0,210,255,0.35)',
                boxShadow: '0 0 36px rgba(0,210,255,0.22), 0 0 80px rgba(0,210,255,0.08)',
              }}
            >
              <Zap className="w-7 h-7 text-cyan-300" />
            </div>
            <span
              className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400"
              style={{ boxShadow: '0 0 10px rgba(52,211,153,0.8)', animation: 'glow-pulse 2s ease-in-out infinite' }}
            />
          </div>

          {/* Title */}
          <div className="space-y-2">
            <h2
              className="text-xl font-black tracking-wider"
              style={{
                background: 'linear-gradient(90deg, #e2e8f0 0%, #67e8f9 60%, #22d3ee 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {assistantName} Neural OS
            </h2>
            <p className="text-xs text-slate-500 max-w-xs font-mono leading-relaxed">
              Autonomous AI — voice commands, device tools, multi-model execution, deep workflows.
            </p>
          </div>

          {/* Quick prompts grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full max-w-sm">
            {QUICK_PROMPTS.map((p, idx) => (
              <div key={idx} className="welcome-card">
                <div className="text-base mb-1">{p.icon}</div>
                <div className="text-[11px] text-slate-400 leading-snug font-medium">{p.label}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* ── Messages ─────────────────────────────────────────── */
        <div className="space-y-5 max-w-3xl mx-auto">
          {messages.map((msg, index) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id || index}
                className={`flex gap-3 animate-fade-up ${isUser ? 'flex-row-reverse ml-auto' : 'mr-auto'}`}
                style={{ maxWidth: '88%' }}
              >
                {/* Avatar */}
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 self-end"
                  style={{
                    background: isUser
                      ? 'rgba(14,165,233,0.14)'
                      : 'rgba(0,220,255,0.12)',
                    border: isUser
                      ? '1px solid rgba(14,165,233,0.28)'
                      : '1px solid rgba(0,220,255,0.28)',
                    boxShadow: isUser ? 'none' : '0 0 12px rgba(0,220,255,0.14)',
                  }}
                >
                  {isUser
                    ? <User className="w-4 h-4 text-sky-300" />
                    : <Bot className="w-4 h-4 text-cyan-300" />
                  }
                </div>

                {/* Bubble + footer */}
                <div className={`flex flex-col gap-1.5 min-w-0 ${isUser ? 'items-end' : 'items-start'}`}>
                  <div className={`px-4 py-3 ${isUser ? 'msg-user' : 'msg-ai'}`}>
                    {/* Attachment preview */}
                    {msg.attachment && (
                      <div
                        className="mb-2.5 p-2 rounded-xl flex items-center gap-2"
                        style={{
                          background: 'rgba(3,5,10,0.80)',
                          border: '1px solid rgba(255,255,255,0.08)',
                        }}
                      >
                        {msg.attachment.type?.startsWith('image/') ? (
                          <img
                            src={msg.attachment.previewUrl || msg.attachment.base64}
                            alt="Attachment"
                            className="w-14 h-14 rounded-lg object-cover"
                            style={{ border: '1px solid rgba(0,220,255,0.20)' }}
                          />
                        ) : (
                          <FileText className="w-8 h-8 text-cyan-400 flex-shrink-0" />
                        )}
                        <div className="overflow-hidden">
                          <div className="text-xs font-semibold text-white truncate">{msg.attachment.name || 'File'}</div>
                          <div className="text-[10px] font-mono text-slate-500">{msg.attachment.type || 'Document'}</div>
                        </div>
                      </div>
                    )}

                    {/* Text */}
                    {isUser ? (
                      <p className="text-sm text-slate-100 leading-relaxed whitespace-pre-wrap break-words">
                        {msg.content}
                      </p>
                    ) : (
                      <div>{renderMessageContent(msg.content, index)}</div>
                    )}

                    {/* Tool Widgets */}
                    {msg.toolWidgets && msg.toolWidgets.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {msg.toolWidgets.map((tw, twIdx) => {
                          if (tw.tool === 'set_timer') return <TimerWidget key={twIdx} timer={tw.timer} onTogglePause={onToggleTimerPause} onAddMinute={onAddMinuteToTimer} onCancel={onCancelTimer} />;
                          if (tw.tool === 'set_alarm') return <AlarmWidget key={twIdx} alarm={tw.alarm} onToggleActive={onToggleAlarmActive} onDelete={onDeleteAlarm} />;
                          if (tw.tool === 'create_note') return <NoteWidget key={twIdx} note={tw.note} onUpdate={onUpdateNote} onDelete={onDeleteNote} />;
                          if (tw.tool === 'add_task') return <TodoWidget key={twIdx} task={tw.task} onToggleDone={onToggleTaskDone} onDelete={onDeleteTask} />;
                          if (tw.tool === 'media_control' || tw.tool === 'play_media') return <MediaControlWidget key={twIdx} action={tw.args?.action || 'play'} app={tw.args?.app || 'ytmusic'} query={tw.args?.query || ''} url={tw.res?.url || tw.url || ''} />;
                          if (tw.tool === 'open_app') return <AppLauncherWidget key={twIdx} appName={tw.args?.app || 'App'} query={tw.args?.query || ''} directUrl={tw.url} />;

                          if (tw.tool === 'web_search') return (
                            <div key={twIdx} className="p-3 rounded-xl font-mono text-xs space-y-1.5" style={{ background: 'rgba(0,220,255,0.05)', border: '1px solid rgba(0,220,255,0.20)' }}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-cyan-400 font-bold text-[11px]">
                                  <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                                  <span>LIVE RAG RETRIEVAL</span>
                                </div>
                                {tw.url && <a href={tw.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-cyan-300 transition-colors"><span>Source</span><ExternalLink className="w-3 h-3" /></a>}
                              </div>
                              <div className="text-[11px] text-slate-400">Query: <span className="text-white font-semibold">"{tw.args?.query || ''}"</span></div>
                              {tw.ragData?.snippets?.length > 0 && (
                                <div className="text-[10px] text-slate-500 space-y-0.5 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                  {tw.ragData.snippets.slice(0, 2).map((s, si) => (
                                    <div key={si} className="truncate">• <span className="text-cyan-400">{s.title}:</span> {s.content}</div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );

                          if (tw.tool === 'generate_pdf' || tw.tool === 'create_pdf') return (
                            <div key={twIdx} className="p-3 rounded-xl font-mono text-xs flex items-center justify-between" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.28)' }}>
                              <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-emerald-400" /><div><div className="font-bold text-white text-[11px]">{tw.args?.title || 'Generated PDF'}</div><div className="text-[10px] text-emerald-400/70">Saved to Desktop</div></div></div>
                              <span className="badge-emerald">READY</span>
                            </div>
                          );

                          if (tw.tool === 'generate_ppt' || tw.tool === 'create_ppt' || tw.tool === 'generate_presentation') return (
                            <div key={twIdx} className="p-3 rounded-xl font-mono text-xs flex items-center justify-between" style={{ background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.28)' }}>
                              <div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-cyan-400" /><div><div className="font-bold text-white text-[11px]">{tw.args?.title || 'Generated Presentation'}</div><div className="text-[10px] text-cyan-400/70">16:9 Deck saved to Desktop</div></div></div>
                              <span className="badge-cyan">PPT</span>
                            </div>
                          );

                          if (tw.tool === 'create_file' || tw.tool === 'write_file') return (
                            <div key={twIdx} className="p-2.5 rounded-xl font-mono text-xs flex items-center justify-between" style={{ background: 'rgba(3,5,10,0.80)', border: '1px solid rgba(0,220,255,0.20)' }}>
                              <div className="flex items-center gap-2 truncate"><Terminal className="w-4 h-4 text-cyan-400 flex-shrink-0" /><span className="text-slate-400 truncate">Created: <span className="text-cyan-300 font-semibold">{tw.path || tw.args?.filePath}</span></span></div>
                              <span className="badge-cyan ml-2">WRITTEN</span>
                            </div>
                          );

                          if (tw.tool === 'run_command' || tw.tool === 'execute_command') return (
                            <div key={twIdx} className="p-3 rounded-xl font-mono text-xs space-y-1.5" style={{ background: 'rgba(3,5,10,0.90)', border: '1px solid rgba(255,255,255,0.08)' }}>
                              <div className="flex items-center gap-1.5 text-cyan-400 font-bold text-[11px]"><Terminal className="w-3.5 h-3.5" /><span>$ {tw.args?.command}</span></div>
                              {tw.output && <pre className="text-[10px] text-slate-400 bg-black/40 p-2 rounded-lg max-h-24 overflow-y-auto">{tw.output}</pre>}
                            </div>
                          );

                          return null;
                        })}
                      </div>
                    )}
                  </div>

                  {/* Timestamp + speak */}
                  <div
                    className={`flex items-center gap-2 text-[10px] font-mono px-1 ${isUser ? 'justify-end' : 'justify-start'}`}
                    style={{ color: 'rgba(100,116,139,0.55)' }}
                  >
                    {msg.timestamp && <span>{msg.timestamp}</span>}
                    {!isUser && (
                      <button
                        onClick={() => onSpeakMessage(msg.content)}
                        className="hover:text-cyan-400 transition-colors"
                        title="Speak"
                      >
                        <Volume2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Thinking Indicator ───────────────────────────────── */}
      {isThinking && (
        <div className="flex gap-3 mt-5 max-w-3xl mx-auto animate-fade-up">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 self-end"
            style={{
              background: 'rgba(0,220,255,0.12)',
              border: '1px solid rgba(0,220,255,0.28)',
              boxShadow: '0 0 12px rgba(0,220,255,0.14)',
            }}
          >
            <Bot className="w-4 h-4 text-cyan-300" />
          </div>
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, rgba(14,20,36,0.90) 0%, rgba(10,14,28,0.80) 100%)',
              border: '1px solid rgba(0,220,255,0.14)',
              borderRadius: '4px 18px 18px 18px',
            }}
          >
            <div className="flex items-center gap-1">
              <span className="thinking-dot" />
              <span className="thinking-dot" />
              <span className="thinking-dot" />
            </div>
            <span
              className="text-xs font-mono"
              style={{ color: 'rgba(103,232,249,0.75)' }}
            >
              {assistantName} is thinking…
            </span>
          </div>
        </div>
      )}

      {/* Bottom spacer */}
      <div className="h-4" />
    </div>
  );
}
