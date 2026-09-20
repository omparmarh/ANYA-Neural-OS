import React, { useState } from 'react';
import { Play, Pause, SkipForward, ExternalLink, Radio, Disc } from 'lucide-react';
import { executeMediaControl } from '../lib/toolDispatcher';

export default function MediaControlWidget({ action = 'play', app = 'ytmusic', query = '', url = '' }) {
  const [isPlaying, setIsPlaying] = useState(action !== 'pause');
  const [loading, setLoading] = useState(false);

  const appTitle = (app.toLowerCase().includes('youtube') && !app.toLowerCase().includes('music'))
    ? 'YouTube'
    : (app.toLowerCase().includes('spotify') ? 'Spotify' : 'YouTube Music');

  const handleTogglePlay = async () => {
    setLoading(true);
    const nextAction = isPlaying ? 'pause' : 'play';
    await executeMediaControl(nextAction, app);
    setIsPlaying(!isPlaying);
    setLoading(false);
  };

  const handleNextTrack = async () => {
    setLoading(true);
    await executeMediaControl('next', app);
    setLoading(false);
  };

  const handleOpenTab = () => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      executeMediaControl('play', app, query);
    }
  };

  return (
    <div className="flex flex-col gap-2 p-3.5 my-2.5 rounded-xl border border-rose-500/30 bg-obsidian-900/95 shadow-lg shadow-rose-950/20 max-w-md">
      {/* Header Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center w-6 h-6 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
          </div>
          <span className="text-[10px] font-mono tracking-widest text-rose-400/90 uppercase font-semibold">
            Host Device Audio Bridge
          </span>
        </div>
        <span className="text-[10px] font-mono text-slate-500 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
          Tab Reused
        </span>
      </div>

      {/* Main Track Info */}
      <div className="flex items-center justify-between gap-3 mt-1">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-rose-900/40 to-slate-900 border border-rose-500/30 text-rose-400 flex-shrink-0">
            <Disc className={`w-5 h-5 ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '4s' }} />
          </div>
          <div className="overflow-hidden">
            <div className="text-sm font-semibold text-white truncate">
              {query || 'Current Media Stream'}
            </div>
            <div className="text-xs text-rose-300/80 flex items-center gap-1.5">
              <span>{appTitle}</span>
              <span className="inline-block w-1 h-1 rounded-full bg-emerald-400"></span>
              <span className="text-[10px] text-emerald-400 font-mono">Playing on Chrome</span>
            </div>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={handleTogglePlay}
            disabled={loading}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 transition-all active:scale-95"
            title={isPlaying ? 'Pause on device' : 'Play on device'}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </button>
          <button
            onClick={handleNextTrack}
            disabled={loading}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all active:scale-95"
            title="Next Track"
          >
            <SkipForward className="w-4 h-4" />
          </button>
          <button
            onClick={handleOpenTab}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 transition-all active:scale-95"
            title="Focus browser tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
