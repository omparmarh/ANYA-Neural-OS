import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff, Paperclip, Camera, X, FileText, ArrowUp } from 'lucide-react';
import { triggerHaptic } from '../lib/neuralEngine';

export default function InputBar({
  onSendMessage,
  onOpenLiveCamera,
  isListening,
  onToggleSpeechRecognition,
  interimTranscript = '',
  disabled = false,
  assistantName = 'Aanya'
}) {
  const [inputText, setInputText] = useState('');
  const [attachment, setAttachment] = useState(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [inputText]);

  const handleSend = (e) => {
    if (e) e.preventDefault();
    if ((!inputText.trim() && !attachment) || disabled) return;
    triggerHaptic(30);
    onSendMessage(inputText.trim(), attachment);
    setInputText('');
    setAttachment(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setAttachment({
        name: file.name, type: file.type, size: file.size,
        base64: event.target?.result,
        previewUrl: file.type.startsWith('image/') ? event.target?.result : null
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const hasContent = inputText.trim() || attachment;

  return (
    <div
      className="relative z-20 input-bar-glass px-3 py-3 sm:px-4"
      style={{ paddingBottom: `max(12px, env(safe-area-inset-bottom, 12px))` }}
    >
      {/* Live Interim Transcript */}
      {isListening && interimTranscript && (
        <div
          className="absolute -top-11 left-3 right-3 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono animate-fade-up"
          style={{
            background: 'rgba(10,20,36,0.95)',
            border: '1px solid rgba(16,185,129,0.40)',
            color: '#6ee7b7',
            backdropFilter: 'blur(14px)',
          }}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
          <span className="truncate">{interimTranscript}</span>
        </div>
      )}

      {/* Attachment Chip */}
      {attachment && (
        <div
          className="mb-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl"
          style={{
            background: 'rgba(6,9,18,0.90)',
            border: '1px solid rgba(0,220,255,0.28)',
          }}
        >
          {attachment.previewUrl ? (
            <img src={attachment.previewUrl} alt="Preview" className="w-5 h-5 rounded object-cover" />
          ) : (
            <FileText className="w-4 h-4 text-cyan-400" />
          )}
          <span className="text-xs font-mono text-slate-300 truncate max-w-[160px]">
            {attachment.name}
          </span>
          <button
            onClick={() => setAttachment(null)}
            className="text-slate-500 hover:text-red-400 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main row */}
      <form onSubmit={handleSend} className="flex items-end gap-2">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.txt,.js,.py,.html,.css"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Left action buttons */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={onOpenLiveCamera}
            className="btn-icon app-no-drag"
            title="Open Camera"
          >
            <Camera className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn-icon app-no-drag"
            title="Attach File"
          >
            <Paperclip className="w-4 h-4" />
          </button>
        </div>

        {/* Text input */}
        <div
          className="flex-1 glass-input rounded-2xl relative overflow-hidden"
          style={{ minHeight: '40px' }}
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${assistantName}…`}
            disabled={disabled}
            className="w-full bg-transparent px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none resize-none max-h-32 app-no-drag"
            style={{
              fontFamily: 'var(--font-sans)',
              lineHeight: '1.5',
            }}
          />
        </div>

        {/* Mic + Send */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={onToggleSpeechRecognition}
            className={`btn-icon app-no-drag ${isListening ? 'btn-mic-active' : ''}`}
            title={isListening ? 'Stop Listening' : 'Voice Input'}
            style={{ animation: isListening ? 'glow-pulse 1.5s ease-in-out infinite' : 'none' }}
          >
            {isListening ? <Mic className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <button
            type="submit"
            disabled={disabled || !hasContent}
            className="btn-send app-no-drag"
            title="Send"
          >
            <ArrowUp className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      </form>
    </div>
  );
}
