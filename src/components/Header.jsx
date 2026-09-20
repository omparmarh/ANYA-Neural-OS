import React, { useState, useEffect } from 'react';
import {
  Menu, Settings, Battery, BatteryCharging,
  Flashlight, VolumeX, Bell, Minus, X, Maximize2
} from 'lucide-react';
import VoiceWaveform from './VoiceWaveform';
import { getDeviceBattery } from '../lib/neuralEngine';
import { toggleTorch } from '../lib/toolDispatcher';

// ─── Platform helpers ─────────────────────────────────────────────────────────
const isElectron = typeof window !== 'undefined' && /Electron/i.test(window.navigator.userAgent);
const isMacOS = typeof window !== 'undefined' && window.electronAPI?.platform === 'darwin';
// On macOS Electron the native traffic lights sit at x:18 y:18 (set in main.cjs)
const hasNativeTraffic = isElectron && isMacOS;

// ─── Custom traffic-light dots (Windows / Linux Electron) ─────────────────────
function WinControls() {
  return (
    <div className="flex items-center gap-1.5 app-no-drag">
      <button
        onClick={() => window.electronAPI?.minimizeWindow?.()}
        className="w-3 h-3 rounded-full bg-[#fdbc40] hover:brightness-125 flex items-center justify-center group transition-all"
        title="Minimize"
      >
        <Minus className="w-2 h-2 text-[#7d5e00] opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
      <button
        onClick={() => window.electronAPI?.maximizeWindow?.()}
        className="w-3 h-3 rounded-full bg-[#34c748] hover:brightness-125 flex items-center justify-center group transition-all"
        title="Maximize"
      >
        <Maximize2 className="w-[7px] h-[7px] text-[#1a5c27] opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
      <button
        onClick={() => window.electronAPI?.closeWindow?.()}
        className="w-3 h-3 rounded-full bg-[#fe5f57] hover:brightness-125 flex items-center justify-center group transition-all"
        title="Close"
      >
        <X className="w-2 h-2 text-[#7c1410] opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    </div>
  );
}

// ─── Main Header ──────────────────────────────────────────────────────────────
export default function Header({
  settings,
  onOpenSettings,
  onToggleSidebar,
  isListening,
  isSpeaking,
  onEmergencyStop,
  activeTimersCount = 0,
  onToggleWidgetsTray,
  showWidgetsTray
}) {
  const [battery, setBattery] = useState({ level: 100, charging: false });
  const [torchActive, setTorchActive] = useState(false);

  useEffect(() => {
    getDeviceBattery().then(b => setBattery(b));
    const interval = setInterval(() => getDeviceBattery().then(b => setBattery(b)), 30000);
    return () => clearInterval(interval);
  }, []);

  const handleTorchToggle = async () => {
    const res = await toggleTorch();
    if (res.success) setTorchActive(res.active);
  };

  // Reserve 78px left padding for native macOS traffic lights
  const leftPad = hasNativeTraffic ? 'pl-[78px]' : 'pl-3';
  const assistantName = settings?.assistantName || 'Aanya';

  return (
    <header
      className={`relative h-[52px] flex items-center justify-between z-40 select-none ${leftPad} pr-3 sm:pr-4 app-drag-region header-glass`}
    >
      {/* Top shimmer highlight - liquid glass edge catch-light */}
      <div
        className="absolute top-0 left-0 right-0 h-px pointer-events-none"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.22) 25%, rgba(0,210,255,0.32) 60%, transparent 100%)'
        }}
      />

      {/* ── LEFT: win-controls (non-mac) + sidebar toggle + brand ─────── */}
      <div className="flex items-center gap-2.5 app-no-drag">
        {isElectron && !hasNativeTraffic && (
          <div className="mr-2">
            <WinControls />
          </div>
        )}

        {/* Sidebar toggle */}
        <button
          onClick={onToggleSidebar}
          className="p-[7px] rounded-xl text-slate-300 hover:text-cyan-300 transition-all"
          style={{
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.11)',
            backdropFilter: 'blur(10px)',
          }}
          title="Toggle Sidebar"
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Brand logo + name */}
        <div className="flex items-center gap-2">
          <div
            className="relative w-7 h-7 rounded-xl overflow-hidden flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, rgba(0,210,255,0.28) 0%, rgba(0,100,255,0.16) 100%)',
              border: '1px solid rgba(0,210,255,0.42)',
              boxShadow: '0 0 14px rgba(0,210,255,0.28)',
            }}
          >
            <img src="/anya-logo.png" alt="Aanya Logo" className="w-full h-full object-cover" draggable={false} />
            <span className="absolute inset-0 rounded-xl border border-cyan-400/30 animate-ping opacity-20 pointer-events-none" />
          </div>

          <div className="leading-tight">
            <div className="flex items-center gap-1.5">
              <span
                className="font-black font-mono tracking-wider text-[13px]"
                style={{
                  background: 'linear-gradient(90deg, #67e8f9, #22d3ee, #38bdf8)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                {assistantName}
              </span>
              <span
                className="text-[9px] font-mono px-1.5 py-px rounded font-bold tracking-wider"
                style={{
                  background: 'rgba(0,210,255,0.13)',
                  border: '1px solid rgba(0,210,255,0.26)',
                  color: '#67e8f9',
                }}
              >
                OS
              </span>
            </div>
            <div
              className="hidden sm:block text-[8px] font-mono uppercase tracking-[0.18em]"
              style={{ color: 'rgba(148,163,184,0.65)' }}
            >
              {settings?.mode === 'autonomous' ? 'Autonomous Mode' : 'Daemon Linked'}
            </div>
          </div>
        </div>
      </div>

      {/* ── CENTER: voice waveform (absolutely centered) ─────────────────── */}
      <div className="flex items-center gap-2 app-no-drag absolute left-1/2 -translate-x-1/2">
        <VoiceWaveform isListening={isListening} isSpeaking={isSpeaking} />
        {isSpeaking && (
          <button
            onClick={onEmergencyStop}
            className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono transition-all animate-pulse"
            style={{
              background: 'rgba(239,68,68,0.16)',
              border: '1px solid rgba(239,68,68,0.36)',
              color: '#fca5a5',
              backdropFilter: 'blur(10px)',
            }}
            title={`Silence ${assistantName}`}
          >
            <VolumeX className="w-3.5 h-3.5" />
            <span>Stop</span>
          </button>
        )}
      </div>

      {/* ── RIGHT: torch, timers, battery, settings ──────────────────────── */}
      <div className="flex items-center gap-2 app-no-drag">
        {/* Torch */}
        <button
          onClick={handleTorchToggle}
          className="hidden sm:flex p-[7px] rounded-xl transition-all"
          style={{
            background: torchActive ? 'rgba(251,191,36,0.18)' : 'rgba(255,255,255,0.07)',
            border: torchActive ? '1px solid rgba(251,191,36,0.48)' : '1px solid rgba(255,255,255,0.11)',
            color: torchActive ? '#fbbf24' : 'rgba(148,163,184,0.75)',
            boxShadow: torchActive ? '0 0 14px rgba(251,191,36,0.22)' : 'none',
          }}
          title="Toggle Torch"
        >
          <Flashlight className="w-4 h-4" />
        </button>

        {/* Active timers badge */}
        {activeTimersCount > 0 && (
          <button
            onClick={onToggleWidgetsTray}
            className="flex items-center gap-1.5 px-2.5 py-[5px] rounded-xl text-xs font-mono transition-all"
            style={{
              background: showWidgetsTray ? 'rgba(0,210,255,0.20)' : 'rgba(0,210,255,0.09)',
              border: showWidgetsTray ? '1px solid rgba(0,210,255,0.55)' : '1px solid rgba(0,210,255,0.22)',
              color: '#67e8f9',
              boxShadow: showWidgetsTray ? '0 0 14px rgba(0,210,255,0.18)' : 'none',
            }}
            title="Active Timers"
          >
            <Bell className="w-3.5 h-3.5" />
            <span className="font-bold">{activeTimersCount}</span>
          </button>
        )}

        {/* Battery */}
        <div
          className="flex items-center gap-1 px-2 py-[5px] rounded-xl"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.10)',
          }}
        >
          {battery.charging ? (
            <BatteryCharging className="w-4 h-4 text-emerald-400" />
          ) : (
            <Battery className="w-4 h-4" style={{ color: battery.level < 20 ? '#f87171' : '#67e8f9' }} />
          )}
          <span
            className="text-[11px] font-mono font-semibold"
            style={{ color: battery.level < 20 ? '#f87171' : 'rgba(203,213,225,0.9)' }}
          >
            {battery.level}%
          </span>
        </div>

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          className="p-[7px] rounded-xl text-slate-300 hover:text-cyan-300 transition-all"
          style={{
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.11)',
            backdropFilter: 'blur(10px)',
          }}
          title="System Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}

