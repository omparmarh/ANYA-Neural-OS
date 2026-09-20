import React, { useEffect, useRef } from 'react';

/**
 * Animated Cybernetic Soundwave Visualizer
 * Reacts dynamically to STT (listening) and TTS (speaking) states with cyan/blue audio waves.
 */
export default function VoiceWaveform({ isListening = false, isSpeaking = false, volume = 0.5 }) {
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let phase = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;

      const active = isListening || isSpeaking;
      const baseAmp = active ? (isSpeaking ? 16 : 12) : 2;
      const speed = active ? 0.08 : 0.02;
      phase += speed;

      // Draw multi-layer cybernetic sine waves (Electric Cyan & Cyber Blue - NO purple)
      const waves = [
        { color: 'rgba(0, 240, 255, 0.85)', amp: baseAmp * 1.2, freq: 0.04, shift: 0 },
        { color: 'rgba(59, 130, 246, 0.65)', amp: baseAmp * 0.9, freq: 0.03, shift: 1.5 },
        { color: 'rgba(16, 185, 129, 0.45)', amp: baseAmp * 0.6, freq: 0.05, shift: 3.0 },
      ];

      waves.forEach(wave => {
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = wave.color;

        for (let x = 0; x < width; x++) {
          // Windowing envelope so waves taper off at edges
          const envelope = Math.sin((x / width) * Math.PI);
          const y = centerY + Math.sin(x * wave.freq + phase + wave.shift) * wave.amp * envelope;

          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      });

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isListening, isSpeaking, volume]);

  return (
    <div className="relative flex items-center justify-center h-10 w-44 bg-obsidian-900/80 rounded-lg border border-cyan-500/20 px-2 py-1 shadow-cyan-glow/20">
      <canvas
        ref={canvasRef}
        width={160}
        height={36}
        className="w-full h-full"
      />
      <div className="absolute top-1 right-2 flex items-center gap-1">
        <span className={`w-1.5 h-1.5 rounded-full ${isSpeaking ? 'bg-cyan-400 animate-ping' : isListening ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
        <span className="text-[9px] font-mono uppercase tracking-wider text-slate-400">
          {isSpeaking ? 'VOX' : isListening ? 'REC' : 'IDLE'}
        </span>
      </div>
    </div>
  );
}
