import React, { useEffect, useRef, useState } from 'react';
import { 
  Bot, User, Copy, Check, FileText, ExternalLink, 
  Sparkles, Terminal, Volume2 
} from 'lucide-react';
import TimerWidget from './TimerWidget';
import AlarmWidget from './AlarmWidget';
import NoteWidget from './NoteWidget';
import TodoWidget from './TodoWidget';
import AppLauncherWidget from './AppLauncherWidget';
import MediaControlWidget from './MediaControlWidget';

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

  // Render message content with code blocks & markdown formatting
  const renderMessageContent = (content, msgIndex) => {
    if (!content) return null;

    // Split text by markdown code blocks ```lang ... ```
    const parts = content.split(/(```[\s\S]*?```)/g);

    return parts.map((part, pIdx) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const lines = part.slice(3, -3).trim().split('\n');
        const lang = lines[0].trim();
        const code = lines.slice(lang.match(/^[a-z0-9_-]+$/i) ? 1 : 0).join('\n');
        const uniqueKey = `${msgIndex}-${pIdx}`;

        return (
          <div key={uniqueKey} className="my-2 rounded-xl bg-obsidian-950 border border-slate-800 overflow-hidden font-mono text-xs">
            <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/80 border-b border-slate-800 text-[11px] text-slate-400">
              <span>{lang || 'code'}</span>
              <button
                onClick={() => handleCopyCode(code, uniqueKey)}
                className="flex items-center gap-1 hover:text-cyan-400 transition-colors"
              >
                {copiedIndex === uniqueKey ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-3 overflow-x-auto text-slate-200 leading-relaxed">
              <code>{code}</code>
            </pre>
          </div>
        );
      }

      // Regular text with basic formatting
      return (
        <span key={pIdx} className="whitespace-pre-wrap">
          {part}
        </span>
      );
    });
  };

  return (
    <div 
      ref={scrollRef}
      className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-4 cyber-grid select-text"
    >
      {messages.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
          <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-obsidian-900 border border-cyan-500/40 shadow-cyan-glow">
            <Bot className="w-8 h-8 text-cyan-400" />
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
          </div>

          <div className="space-y-1">
            <h2 className="text-lg sm:text-xl font-black tracking-wider text-white">
              ANYA NEURAL OPERATING SYSTEM
            </h2>
            <p className="text-xs text-slate-400 max-w-md font-mono">
              Autonomous dual-engine AI assistant ready for voice commands, device tools, multi-model execution, and deep workflows.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-md w-full pt-2">
            {[
              "Set a 15 minute deep work timer",
              "Open WhatsApp and message Alex",
              "Take a camera snapshot and inspect",
              "Search YouTube for quantum computing",
            ].map((prompt, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-xl bg-obsidian-900/80 border border-slate-800 text-xs text-slate-300 font-mono text-left hover:border-cyan-500/40 transition-colors"
              >
                &gt; {prompt}
              </div>
            ))}
          </div>
        </div>
      ) : (
        messages.map((msg, index) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id || index}
              className={`flex gap-3 max-w-3xl ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
            >
              {/* Avatar Icon */}
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border ${
                isUser 
                  ? 'bg-blue-600/20 border-blue-500/40 text-blue-300' 
                  : 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300 shadow-cyan-glow/20'
              }`}>
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              {/* Message Bubble */}
              <div className={`space-y-2 max-w-[85%] sm:max-w-[78%] ${
                isUser ? 'items-end' : 'items-start'
              }`}>
                <div className={`rounded-2xl p-3.5 sm:p-4 text-xs sm:text-sm leading-relaxed border ${
                  isUser 
                    ? 'bg-blue-950/40 border-blue-500/30 text-blue-50 shadow-sm' 
                    : 'bg-obsidian-900/90 border-cyan-500/20 text-slate-100 shadow-md'
                }`}>
                  {/* Attachment Preview */}
                  {msg.attachment && (
                    <div className="mb-2 p-2 rounded-xl bg-obsidian-950/80 border border-slate-800 flex items-center gap-2">
                      {msg.attachment.type?.startsWith('image/') ? (
                        <img 
                          src={msg.attachment.previewUrl || msg.attachment.base64} 
                          alt="Attachment" 
                          className="w-16 h-16 rounded-lg object-cover border border-cyan-500/20"
                        />
                      ) : (
                        <FileText className="w-8 h-8 text-cyan-400 flex-shrink-0" />
                      )}
                      <div className="overflow-hidden">
                        <div className="text-xs font-semibold text-white truncate">
                          {msg.attachment.name || 'Attached File'}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">
                          {msg.attachment.type || 'Document'}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Main Text Content */}
                  <div>{renderMessageContent(msg.content, index)}</div>

                  {/* Embedded Tool Widgets */}
                  {msg.toolWidgets && msg.toolWidgets.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {msg.toolWidgets.map((tw, twIdx) => {
                        if (tw.tool === 'set_timer') {
                          return (
                            <TimerWidget
                              key={twIdx}
                              timer={tw.timer}
                              onTogglePause={onToggleTimerPause}
                              onAddMinute={onAddMinuteToTimer}
                              onCancel={onCancelTimer}
                            />
                          );
                        }
                        if (tw.tool === 'set_alarm') {
                          return (
                            <AlarmWidget
                              key={twIdx}
                              alarm={tw.alarm}
                              onToggleActive={onToggleAlarmActive}
                              onDelete={onDeleteAlarm}
                            />
                          );
                        }
                        if (tw.tool === 'create_note') {
                          return (
                            <NoteWidget
                              key={twIdx}
                              note={tw.note}
                              onUpdate={onUpdateNote}
                              onDelete={onDeleteNote}
                            />
                          );
                        }
                        if (tw.tool === 'add_task') {
                          return (
                            <TodoWidget
                              key={twIdx}
                              task={tw.task}
                              onToggleDone={onToggleTaskDone}
                              onDelete={onDeleteTask}
                            />
                          );
                        }
                        if (tw.tool === 'media_control' || tw.tool === 'play_media') {
                          return (
                            <MediaControlWidget
                              key={twIdx}
                              action={tw.args?.action || 'play'}
                              app={tw.args?.app || 'ytmusic'}
                              query={tw.args?.query || ''}
                              url={tw.res?.url || tw.url || ''}
                            />
                          );
                        }
                        if (tw.tool === 'open_app') {
                          return (
                            <AppLauncherWidget
                              key={twIdx}
                              appName={tw.args?.app || 'App'}
                              query={tw.args?.query || ''}
                              directUrl={tw.url}
                            />
                          );
                        }
                        if (tw.tool === 'web_search') {
                          return (
                            <div key={twIdx} className="p-3 rounded-xl bg-obsidian-950/90 border border-cyan-500/30 font-mono text-xs text-cyan-200 flex flex-col gap-1.5 shadow-md">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 font-bold text-cyan-400">
                                  <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                                  <span>LIVE RAG SEARCH RETRIEVAL</span>
                                </div>
                                {tw.url && (
                                  <a
                                    href={tw.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-cyan-300 transition-colors"
                                  >
                                    <span>Source</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                              <div className="text-slate-300 text-[11px]">
                                Query: <span className="text-white font-semibold">"{tw.args?.query || ''}"</span>
                              </div>
                              {tw.ragData?.snippets && tw.ragData.snippets.length > 0 && (
                                <div className="text-[10px] text-slate-400 bg-slate-900/60 p-2 rounded-lg border border-slate-800 space-y-1">
                                  <div className="font-semibold text-slate-300">Indexed Knowledge Snippets:</div>
                                  {tw.ragData.snippets.slice(0, 2).map((s, sIdx) => (
                                    <div key={sIdx} className="truncate text-slate-300">
                                      • <span className="text-cyan-300 font-semibold">{s.title}:</span> {s.content}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        }
                        if (tw.tool === 'generate_pdf' || tw.tool === 'create_pdf') {
                          return (
                            <div key={twIdx} className="p-3 rounded-xl bg-obsidian-950/90 border border-emerald-500/40 font-mono text-xs text-emerald-300 flex items-center justify-between shadow-md">
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-emerald-400" />
                                <div>
                                  <div className="font-bold text-white">{tw.args?.title || 'Generated PDF Document'}</div>
                                  <div className="text-[10px] text-emerald-400/80">Saved autonomously to Desktop & opened</div>
                                </div>
                              </div>
                              <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                                READY
                              </span>
                            </div>
                          );
                        }
                        if (tw.tool === 'generate_ppt' || tw.tool === 'create_ppt' || tw.tool === 'generate_presentation') {
                          return (
                            <div key={twIdx} className="p-3 rounded-xl bg-obsidian-950/90 border border-purple-500/40 font-mono text-xs text-purple-300 flex items-center justify-between shadow-md">
                              <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-purple-400" />
                                <div>
                                  <div className="font-bold text-white">{tw.args?.title || 'Generated PPT Presentation'}</div>
                                  <div className="text-[10px] text-purple-300/80">16:9 Presentation Deck saved to Desktop & opened</div>
                                </div>
                              </div>
                              <span className="px-2 py-1 rounded bg-purple-500/20 text-purple-300 text-[10px] font-bold border border-purple-500/30">
                                PPT DECK
                              </span>
                            </div>
                          );
                        }
                        if (tw.tool === 'create_file' || tw.tool === 'write_file') {
                          return (
                            <div key={twIdx} className="p-2.5 rounded-xl bg-obsidian-950/90 border border-cyan-500/30 font-mono text-xs text-cyan-200 flex items-center justify-between shadow-md">
                              <div className="flex items-center gap-2 truncate">
                                <Terminal className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                                <div className="truncate">
                                  <span className="text-slate-400">Created file: </span>
                                  <span className="text-cyan-300 font-semibold">{tw.path || tw.args?.filePath}</span>
                                </div>
                              </div>
                              <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-bold">
                                WRITTEN
                              </span>
                            </div>
                          );
                        }
                        if (tw.tool === 'create_folder' || tw.tool === 'mkdir') {
                          return (
                            <div key={twIdx} className="p-2.5 rounded-xl bg-obsidian-950/90 border border-blue-500/30 font-mono text-xs text-blue-200 flex items-center justify-between shadow-md">
                              <div className="flex items-center gap-2 truncate">
                                <Terminal className="w-4 h-4 text-blue-400 flex-shrink-0" />
                                <div className="truncate">
                                  <span className="text-slate-400">Created folder: </span>
                                  <span className="text-blue-300 font-semibold">{tw.path || tw.args?.folderPath}</span>
                                </div>
                              </div>
                              <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-bold">
                                MKDIR
                              </span>
                            </div>
                          );
                        }
                        if (tw.tool === 'run_command' || tw.tool === 'execute_command') {
                          return (
                            <div key={twIdx} className="p-3 rounded-xl bg-obsidian-950/90 border border-slate-700 font-mono text-xs text-slate-200 space-y-1 shadow-md">
                              <div className="flex items-center justify-between text-cyan-400 font-bold text-[11px]">
                                <div className="flex items-center gap-1.5">
                                  <Terminal className="w-3.5 h-3.5" />
                                  <span>Executed Command: {tw.args?.command}</span>
                                </div>
                              </div>
                              {tw.output && (
                                <pre className="text-[10px] text-slate-300 bg-black/60 p-2 rounded-lg max-h-24 overflow-y-auto">
                                  {tw.output}
                                </pre>
                              )}
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  )}
                </div>

                {/* Message Timestamp & Speech Trigger */}
                <div className={`flex items-center gap-2 text-[10px] font-mono text-slate-400 px-1 ${
                  isUser ? 'justify-end' : 'justify-start'
                }`}>
                  <span>{msg.timestamp || ''}</span>
                  {!isUser && (
                    <button
                      onClick={() => onSpeakMessage(msg.content)}
                      className="hover:text-cyan-400 transition-colors"
                      title="Speak Answer"
                    >
                      <Volume2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}

      {/* Thinking Indicator */}
      {isThinking && (
        <div className="flex gap-3 max-w-3xl mr-auto items-center">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 shadow-cyan-glow/20">
            <Bot className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-obsidian-900/90 border border-cyan-500/30 text-xs font-mono text-cyan-300">
            <Sparkles className="w-4 h-4 animate-spin-slow text-cyan-400" />
            <span className="animate-pulse">{settings?.assistantName || 'Aanya'} is synthesizing neural response...</span>
          </div>
        </div>
      )}
    </div>
  );
}
