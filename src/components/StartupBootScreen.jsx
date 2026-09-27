import React, { useState, useEffect, useRef } from 'react';
import { Cpu, ShieldCheck, Zap, Terminal } from 'lucide-react';

export default function StartupBootScreen({ onComplete }) {
  const [bootPhase, setBootPhase] = useState(0);
  const [telemetryText, setTelemetryText] = useState('INITIALIZING QUANTUM RUNTIME...');
  const [progress, setProgress] = useState(12);

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const sequence = [
      { delay: 250, phase: 1, progress: 38, text: 'LOADING NEURAL WEIGHTS & CORE MEMORY...' },
      { delay: 600, phase: 2, progress: 72, text: 'SYNCHRONIZING SECURE TELEMETRY & MULTI-MODEL MATRIX...' },
      { delay: 1050, phase: 3, progress: 95, text: 'ANYA NEURAL OS v2.0 ONLINE // SYSTEM READY' },
      { delay: 1450, phase: 4, progress: 100, text: 'WELCOME COMMANDER. ACCESS GRANTED.' },
    ];

    const timers = sequence.map(step =>
      setTimeout(() => {
        setBootPhase(step.phase);
        setProgress(step.progress);
        setTelemetryText(step.text);
      }, step.delay)
    );

    const finishTimer = setTimeout(() => {
      onCompleteRef.current?.();
    }, 1800);

    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(finishTimer);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#030509] text-white select-none overflow-hidden font-sans">
      {/* Background Cyber Grid */}
      <div 
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(circle at 50% 50%, rgba(0, 240, 255, 0.12) 0%, transparent 60%),
            linear-gradient(to right, rgba(0, 240, 255, 0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0, 240, 255, 0.05) 1px, transparent 1px)
          `,
          backgroundSize: '100% 100%, 36px 36px, 36px 36px'
        }}
      />

      {/* Holographic Glowing Core */}
      <div className="relative flex items-center justify-center mb-10">
        {/* Outer Pulsing Ring */}
        <div className="w-36 h-36 rounded-full border border-cyan-500/30 animate-ping absolute opacity-30" />
        
        {/* Rotating Segmented Ring */}
        <div 
          className="w-28 h-28 rounded-full border-2 border-dashed border-cyan-400/40 animate-spin absolute"
          style={{ animationDuration: '8s' }}
        />

        {/* Inner Counter-Rotating Hex Ring */}
        <div 
          className="w-20 h-20 rounded-full border border-cyan-300/60 animate-spin absolute"
          style={{ animationDuration: '4s', animationDirection: 'reverse' }}
        />

        {/* Central Eye / Reactor Core */}
        <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400 to-teal-600 flex items-center justify-center shadow-[0_0_35px_rgba(0,240,255,0.7)]">
          <Zap className="w-6 h-6 text-slate-950 animate-pulse" />
        </div>
      </div>

      {/* Title & Brand */}
      <div className="text-center space-y-2 z-10 px-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-[10px] font-mono tracking-widest text-cyan-400 uppercase">
          <Cpu className="w-3 h-3 text-cyan-400" />
          <span>Autonomous Neural Intelligence</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-black tracking-widest text-white drop-shadow-[0_2px_12px_rgba(0,240,255,0.4)]">
          ANYA <span className="text-cyan-400 font-mono text-xl sm:text-2xl font-light">OS</span>
        </h1>

        <p className="text-xs font-mono text-slate-400 tracking-wider h-5 transition-all duration-300">
          {telemetryText}
        </p>
      </div>

      {/* Progress Bar Container */}
      <div className="w-72 max-w-[80vw] mt-8 z-10 space-y-2">
        <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-cyan-500/20">
          <div 
            className="h-full bg-gradient-to-r from-teal-400 via-cyan-400 to-cyan-200 transition-all duration-300 rounded-full shadow-[0_0_10px_rgba(0,240,255,0.6)]"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
          <span>BOOT_STAGE_0{bootPhase}</span>
          <span className="text-cyan-400 font-semibold">{progress}%</span>
        </div>
      </div>

      {/* Skip Button */}
      <button
        onClick={onComplete}
        className="mt-8 text-[11px] font-mono text-slate-500 hover:text-cyan-400 transition-colors uppercase tracking-wider px-3 py-1 rounded hover:bg-slate-900/40"
      >
        [ Press to Skip ]
      </button>
    </div>
  );
}
