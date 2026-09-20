import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, Mic, MicOff, Paperclip, Camera, X, FileText, 
  Sparkles, ArrowUp 
} from 'lucide-react';
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

  // Auto-resize textarea height
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

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setAttachment({
        name: file.name,
        type: file.type,
        size: file.size,
        base64: event.target?.result,
        previewUrl: file.type.startsWith('image/') ? event.target?.result : null
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="relative border-t border-cyan-500/20 bg-obsidian-950/95 backdrop-blur-xl p-3 sm:p-4 z-20">
      {/* Live Interim Speech Bubble */}
      {isListening && interimTranscript && (
        <div className="absolute -top-12 left-4 right-4 bg-obsidian-900/90 border border-emerald-500/40 rounded-xl px-3 py-2 flex items-center gap-2 shadow-lg animate-pulse z-30">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-xs font-mono text-emerald-300 truncate">
            {interimTranscript}
          </span>
        </div>
      )}

      {/* Attachment Preview Chip */}
      {attachment && (
        <div className="mb-2 inline-flex items-center gap-2 bg-obsidian-900 border border-cyan-500/40 rounded-xl px-3 py-1.5 shadow-sm">
          {attachment.previewUrl ? (
            <img src={attachment.previewUrl} alt="Preview" className="w-6 h-6 rounded object-cover" />
          ) : (
            <FileText className="w-4 h-4 text-cyan-400" />
          )}
          <span className="text-xs font-mono text-slate-200 truncate max-w-[180px]">
            {attachment.name}
          </span>
          <button
            onClick={() => setAttachment(null)}
            className="p-0.5 rounded text-slate-400 hover:text-red-400"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Input Controls */}
      <form onSubmit={handleSend} className="flex items-end gap-2">
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.txt,.js,.py,.html,.css"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Action Buttons: Camera & File Upload */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onOpenLiveCamera}
            className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-cyan-400 border border-slate-800 transition-colors"
            title="Open Live Camera Scanner"
          >
            <Camera className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-cyan-400 border border-slate-800 transition-colors"
            title="Attach Document / Image"
          >
            <Paperclip className="w-4 h-4" />
          </button>
        </div>

        {/* Text Input Box */}
        <div className="flex-1 relative rounded-xl border border-cyan-500/30 bg-obsidian-900/90 focus-within:border-cyan-500/60 focus-within:shadow-cyan-glow/20 transition-all">
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Command ${assistantName} or ask anything...`}
            disabled={disabled}
            className="w-full bg-transparent px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none resize-none max-h-32"
          />
        </div>

        {/* Voice Recognition Mic Trigger */}
        <button
          type="button"
          onClick={onToggleSpeechRecognition}
          className={`p-2.5 rounded-xl border transition-all ${
            isListening 
              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-emerald-glow animate-pulse' 
              : 'bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-cyan-400 border border-slate-800'
          }`}
          title={isListening ? 'Stop Listening' : 'Start Speech Recognition'}
        >
          {isListening ? <Mic className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        {/* Send Button */}
        <button
          type="submit"
          disabled={disabled || (!inputText.trim() && !attachment)}
          className="p-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:hover:bg-cyan-500 text-slate-950 font-bold border border-cyan-400 shadow-cyan-glow transition-all active:scale-95"
          title="Send Message"
        >
          <ArrowUp className="w-4 h-4 stroke-[2.5]" />
        </button>
      </form>
    </div>
  );
}
