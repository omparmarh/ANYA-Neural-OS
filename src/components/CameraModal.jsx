import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, RefreshCw, Check, Video, Mic, MicOff, Volume2, Sparkles } from 'lucide-react';
import { triggerHaptic } from '../lib/neuralEngine';

export default function CameraModal({ isOpen, onClose, onCapture, assistantName = 'Aanya' }) {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); // 'user' or 'environment'
  const [error, setError] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [mode, setMode] = useState('snapshot'); // 'snapshot' | 'live_chat'
  const [isListeningLive, setIsListeningLive] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      stopLiveSpeech();
      setCapturedImage(null);
      setLiveTranscript('');
      return;
    }

    startCamera();

    return () => {
      stopCamera();
      stopLiveSpeech();
    };
  }, [isOpen, facingMode]);

  const startCamera = async () => {
    setError(null);
    try {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setError('Unable to access camera. Please check macOS camera permissions.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      try {
        stream.getTracks().forEach(t => t.stop());
      } catch {}
      setStream(null);
    }
  };

  const getFrameDataUrl = () => {
    if (!videoRef.current) return null;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  };

  const takeSnapshot = () => {
    const dataUrl = getFrameDataUrl();
    if (dataUrl) {
      triggerHaptic(50);
      setCapturedImage(dataUrl);
    }
  };

  const handleConfirm = () => {
    if (capturedImage) {
      onCapture({
        base64: capturedImage,
        type: 'image/jpeg',
        name: `camera_snapshot_${Date.now()}.jpg`,
        previewUrl: capturedImage
      });
      onClose();
    }
  };

  const toggleFacingMode = () => {
    setFacingMode(prev => (prev === 'user' ? 'environment' : 'user'));
  };

  // ─── Live Audio / Speech in Camera Viewport ────────────────────────────────
  const stopLiveSpeech = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    setIsListeningLive(false);
  };

  const toggleLiveSpeech = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser environment.');
      return;
    }

    if (isListeningLive) {
      stopLiveSpeech();
      return;
    }

    try {
      stopLiveSpeech();
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListeningLive(true);
        triggerHaptic(40);
      };

      recognition.onresult = (event) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) final += event.results[i][0].transcript;
          else interim += event.results[i][0].transcript;
        }
        setLiveTranscript(interim || final);

        if (final.trim()) {
          const promptText = final.trim();
          const snapshotBase64 = getFrameDataUrl();
          triggerHaptic([60, 40, 60]);

          onCapture({
            base64: snapshotBase64,
            type: 'image/jpeg',
            name: `live_vision_${Date.now()}.jpg`,
            previewUrl: snapshotBase64
          }, promptText);

          setLiveTranscript('');
        }
      };

      recognition.onerror = () => {
        setIsListeningLive(false);
      };

      recognition.onend = () => {
        setIsListeningLive(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.warn('Failed to start live speech:', e);
      setIsListeningLive(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md select-none">
      <div className="relative w-full max-w-xl bg-obsidian-900 border border-cyan-500/40 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-obsidian-950">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <h3 className="text-xs font-mono font-bold tracking-wider uppercase text-cyan-300">
              {assistantName} Live Vision & Voice System
            </h3>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => { setMode('snapshot'); stopLiveSpeech(); setCapturedImage(null); }}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold transition-all ${
                mode === 'snapshot'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Snapshot
            </button>
            <button
              onClick={() => { setMode('live_chat'); setCapturedImage(null); }}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold transition-all flex items-center gap-1 ${
                mode === 'live_chat'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Video className="w-3 h-3" />
              <span>Live Mode</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder / Live Video feed */}
        <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
          {error ? (
            <div className="p-6 text-center text-xs font-mono text-red-400 max-w-md">{error}</div>
          ) : capturedImage ? (
            <img src={capturedImage} alt="Captured" className="w-full h-full object-contain" />
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          )}

          {/* Target Reticle Overlay */}
          {!capturedImage && !error && (
            <div className="pointer-events-none absolute inset-0 border border-cyan-500/30 m-4 rounded-xl flex flex-col justify-between p-3">
              <div className="flex justify-between items-start">
                <span className="w-4 h-4 border-t-2 border-l-2 border-cyan-400" />
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/60 backdrop-blur text-[9px] font-mono text-cyan-400 border border-cyan-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                  <span>REC 1080P • REAL-TIME FEED</span>
                </div>
                <span className="w-4 h-4 border-t-2 border-r-2 border-cyan-400" />
              </div>

              {/* Live Transcript Overlay */}
              {mode === 'live_chat' && liveTranscript && (
                <div className="self-center bg-black/75 border border-emerald-500/50 rounded-xl px-3 py-1.5 backdrop-blur text-xs font-mono text-emerald-300 animate-pulse max-w-[90%] text-center">
                  "{liveTranscript}"
                </div>
              )}

              <div className="flex justify-between items-end">
                <span className="w-4 h-4 border-b-2 border-l-2 border-cyan-400" />
                <span className="text-[9px] font-mono text-slate-400 tracking-wider">
                  {mode === 'live_chat' ? 'SPEAK TO ANALYZE REAL-TIME FRAME' : 'TAP SNAPSHOT TO CAPTURE'}
                </span>
                <span className="w-4 h-4 border-b-2 border-r-2 border-cyan-400" />
              </div>
            </div>
          )}
        </div>

        {/* Actions Footer */}
        <div className="flex items-center justify-between p-3 sm:p-4 bg-obsidian-950 border-t border-slate-800">
          <button
            onClick={toggleFacingMode}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-mono"
            title="Switch Camera"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Flip</span>
          </button>

          {mode === 'live_chat' ? (
            <div className="flex items-center gap-2">
              <button
                onClick={toggleLiveSpeech}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono text-xs font-bold transition-all shadow-lg ${
                  isListeningLive
                    ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/40 animate-pulse'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/40'
                }`}
              >
                <Mic className="w-4 h-4" />
                <span>{isListeningLive ? 'Listening (Tap to Pause)' : 'Start Live Voice Chat'}</span>
              </button>
            </div>
          ) : capturedImage ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCapturedImage(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-semibold"
              >
                Retake
              </button>
              <button
                onClick={handleConfirm}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-mono font-bold shadow-cyan-glow"
              >
                <Check className="w-4 h-4" />
                <span>Send to {assistantName}</span>
              </button>
            </div>
          ) : (
            <button
              onClick={takeSnapshot}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono shadow-cyan-glow transition-all active:scale-95"
            >
              <Camera className="w-4 h-4" />
              <span>Capture Frame</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
