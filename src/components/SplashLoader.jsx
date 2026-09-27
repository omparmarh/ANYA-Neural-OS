import React, { useEffect, useState } from 'react';
import { Bot, Sparkles, Shield, Zap } from 'lucide-react';

export default function SplashLoader({ onComplete }) {
  const [progress, setProgress] = useState(0);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setFadingOut(true);
            setTimeout(onComplete, 600);
          }, 400);
          return 100;
        }
        return prev + Math.floor(Math.random() * 20) + 10;
      });
    }, 150);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#05070c] text-slate-100 transition-opacity duration-600 select-none ${
      fadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
    }`}>
      {/* Background Cyber Grid & Glow */}
      <div className="absolute inset-0 cyber-grid opacity-30 pointer-events-none" />
      <div className="absolute w-96 h-96 rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute w-96 h-96 rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center space-y-6 max-w-sm w-full p-6 text-center">
        {/* Animated Neural Logo Core */}
        <div className="relative flex items-center justify-center w-24 h-24 rounded-3xl bg-obsidian-900 border border-cyan-500/50 shadow-cyan-glow animate-pulse">
          <Bot className="w-12 h-12 text-cyan-400 animate-bounce" />
          <div className="absolute -inset-1.5 rounded-3xl border border-cyan-400/30 animate-spin-slow pointer-events-none" />
          <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 animate-ping" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-black tracking-widest text-white uppercase font-mono">
            ANYA <span className="text-cyan-400">OS</span>
          </h1>
          <p className="text-xs font-mono text-slate-400 tracking-wider">
            BI-ARTIFICIAL NEURAL TERMINAL v2.0
          </p>
        </div>

        {/* Loading Progress Bar */}
        <div className="w-full space-y-2 pt-4">
          <div className="flex justify-between text-[10px] font-mono text-cyan-400">
            <span>INITIALIZING NEURAL CORES</span>
            <span>{Math.min(progress, 100)}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-200 shadow-cyan-glow"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 pt-2">
          <Zap className="w-3 h-3 text-cyan-400" />
          <span>Zero-Server Autonomous Multi-Model Engine</span>
        </div>
      </div>
    </div>
  );
}