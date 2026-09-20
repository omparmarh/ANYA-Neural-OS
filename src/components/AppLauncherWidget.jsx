import React from 'react';
import { ExternalLink, Play, Globe, MessageSquare, Music, Video, MapPin, Phone, Mail } from 'lucide-react';
import { executeAppLaunch } from '../lib/toolDispatcher';

export default function AppLauncherWidget({ appName, query, directUrl }) {
  const getAppIcon = (name = '') => {
    const lower = name.toLowerCase();
    if (lower.includes('whatsapp') || lower.includes('message')) return <MessageSquare className="w-5 h-5 text-emerald-400" />;
    if (lower.includes('youtube') || lower.includes('video')) return <Video className="w-5 h-5 text-red-400" />;
    if (lower.includes('spotify') || lower.includes('music')) return <Music className="w-5 h-5 text-emerald-300" />;
    if (lower.includes('maps')) return <MapPin className="w-5 h-5 text-amber-400" />;
    if (lower.includes('phone') || lower.includes('call')) return <Phone className="w-5 h-5 text-cyan-400" />;
    if (lower.includes('mail') || lower.includes('email')) return <Mail className="w-5 h-5 text-blue-400" />;
    return <Globe className="w-5 h-5 text-cyan-400" />;
  };

  const handleLaunch = () => {
    if (directUrl) {
      window.open(directUrl, '_blank', 'noopener,noreferrer');
    } else {
      executeAppLaunch(appName, query);
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 p-3.5 my-2 rounded-xl border border-cyan-500/30 bg-obsidian-900/90 shadow-cyan-glow/20">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
          {getAppIcon(appName)}
        </div>
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
            Native App Action
          </div>
          <div className="text-sm font-bold text-white">
            {appName.toUpperCase()} {query ? `· "${query}"` : ''}
          </div>
        </div>
      </div>

      <button
        onClick={handleLaunch}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-semibold tracking-wide transition-all shadow-sm"
      >
        <span>Open</span>
        <ExternalLink className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
