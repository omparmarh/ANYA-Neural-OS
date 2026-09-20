import React from 'react';
import { ShieldCheck, X, Lock, Database, Cpu, EyeOff } from 'lucide-react';

export default function PrivacyPolicyModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-2xl bg-obsidian-900 border border-cyan-500/30 rounded-2xl overflow-hidden shadow-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-obsidian-950">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
            <h3 className="text-sm font-bold tracking-wider uppercase text-white">
              ANYA Neural OS · Privacy & Architecture Policy
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
          <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/20 flex items-start gap-3">
            <Lock className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-white font-semibold mb-1">Local-First Storage Paradigm</h4>
              <p className="text-slate-400 text-xs">
                Your conversation logs, active timers, alarms, notes, and task lists are saved directly in your device browser storage (LocalStorage/IndexedDB). They are never sold, collected, or routed through third-party telemetry servers.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
            <Cpu className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-white font-semibold mb-1">Direct Model Dispatch</h4>
              <p className="text-slate-400 text-xs">
                In Autonomous On-Device mode, prompts and attachments are transmitted directly from your client to the official Google Gemini, Groq, or OpenRouter API endpoints using encrypted HTTPS requests with your configured API keys.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
            <EyeOff className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-white font-semibold mb-1">Microphone & Camera Permissions</h4>
              <p className="text-slate-400 text-xs">
                Speech recognition and camera snapshots are initiated solely by explicit user interaction. Camera streams are processed locally into image frames for multi-modal analysis and terminated immediately after capture.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
            <Database className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-white font-semibold mb-1">Remote Daemon & Local Execution</h4>
              <p className="text-slate-400 text-xs">
                When using the Desktop Python Daemon, automation commands (AppleScript, shell scripts, and system controls) execute entirely on your local machine via localhost (127.0.0.1:8000).
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3 bg-obsidian-950 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
