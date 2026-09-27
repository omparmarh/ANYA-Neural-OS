import React from 'react';
import { AlertTriangle, RefreshCw, Trash2, Cpu } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ANYA Core Exception caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetState = () => {
    try {
      localStorage.removeItem('anya_local_chats');
      localStorage.removeItem('anya_settings');
    } catch {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#030509] text-white select-none overflow-hidden font-sans">
          {/* Background Cyber Grid */}
          <div 
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              backgroundImage: `
                radial-gradient(circle at 50% 50%, rgba(239, 68, 68, 0.15) 0%, transparent 60%),
                linear-gradient(to right, rgba(239, 68, 68, 0.05) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(239, 68, 68, 0.05) 1px, transparent 1px)
              `,
              backgroundSize: '100% 100%, 36px 36px, 36px 36px'
            }}
          />

          <div className="relative w-full max-w-lg p-6 bg-[#060a12]/95 border border-red-500/30 rounded-2xl shadow-[0_0_50px_rgba(239,68,68,0.2)] backdrop-blur-xl">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-950/60 border border-red-500/40 flex items-center justify-center text-red-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-wider uppercase text-red-400 flex items-center gap-2">
                  <span>Neural Core Interrupted</span>
                </h2>
                <p className="text-xs font-mono text-slate-400">
                  Subsystem exception caught. Safe mode engaged.
                </p>
              </div>
            </div>

            {/* Error Message Box */}
            <div className="p-3 my-4 bg-black/60 border border-white/10 rounded-xl font-mono text-xs text-red-300 break-words max-h-36 overflow-y-auto">
              {this.state.error?.toString() || 'Unknown Runtime Exception'}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={this.handleReload}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-bold rounded-xl text-xs uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(0,240,255,0.4)] cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Restart Core</span>
              </button>

              <button
                onClick={this.handleResetState}
                className="flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-white/10 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer"
                title="Clears local cache and resets session"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Reset Cache</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
