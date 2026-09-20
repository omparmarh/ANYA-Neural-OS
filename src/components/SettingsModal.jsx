import React, { useState, useEffect } from 'react';
import { 
  Settings, X, Cpu, Key, Volume2, Globe, Check, AlertCircle, 
  Trash2, RefreshCw, Eye, EyeOff, Terminal, Shield, Zap, ExternalLink, Activity
} from 'lucide-react';
import { keyManager, clearTokenUsage } from '../lib/neuralEngine';

export default function SettingsModal({ isOpen, onClose, settings, onSaveSettings }) {
  const [formData, setFormData] = useState({ ...settings });
  const [apiKeys, setApiKeys] = useState({
    gemini: '',
    groq: '',
    openrouter: '',
    elevenlabs: ''
  });
  const [showKeys, setShowKeys] = useState({
    gemini: false,
    groq: false,
    openrouter: false,
    elevenlabs: false
  });
  const [pingStatus, setPingStatus] = useState(null); // null | 'testing' | 'success' | 'failed'
  const [activeTab, setActiveTab] = useState('freellmapi'); // 'freellmapi' | 'engine' | 'keys' | 'voice' | 'storage'
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [freellmStatus, setFreellmStatus] = useState('checking'); // 'checking' | 'online' | 'offline'

  const checkFreeLLMStatus = async () => {
    setFreellmStatus('checking');
    try {
      const url = (formData.freellmapiUrl || 'http://localhost:3001/v1').replace(/\/+$/, '');
      const key = formData.freellmapiKey || 'freellmapi-3b01700d45e8abec3101dd07b2f4ce0fca08a4eed30f29e0';
      const res = await fetch(`${url}/models`, {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok) {
        setFreellmStatus('online');
      } else {
        setFreellmStatus('offline');
      }
    } catch {
      setFreellmStatus('offline');
    }
  };

  useEffect(() => {
    if (isOpen) {
      setFormData({ ...settings });
      checkFreeLLMStatus();
      try {
        const stored = localStorage.getItem('anya_api_keys');
        if (stored) {
          setApiKeys({ ...apiKeys, ...JSON.parse(stored) });
        }
      } catch {}
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handlePingServer = async () => {
    setPingStatus('testing');
    try {
      const res = await fetch(`${formData.remoteUrl || 'http://127.0.0.1:8000'}/status`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok) {
        setPingStatus('success');
      } else {
        setPingStatus('failed');
      }
    } catch {
      setPingStatus('failed');
    }
  };

  const handleSave = () => {
    // Save API Keys
    localStorage.setItem('anya_api_keys', JSON.stringify(apiKeys));
    onSaveSettings(formData);

    // Sync keys to FreeLLMAPI daemon if in Electron
    if (window.electronAPI?.startFreeLLMAPI) {
      const keys = [];
      if (apiKeys.gemini) {
        apiKeys.gemini.split(',').map(k => k.trim()).filter(Boolean).forEach(k => {
          keys.push({ platform: 'google', key: k });
        });
      }
      if (apiKeys.groq) {
        apiKeys.groq.split(',').map(k => k.trim()).filter(Boolean).forEach(k => {
          keys.push({ platform: 'groq', key: k });
        });
      }
      if (apiKeys.openrouter) {
        apiKeys.openrouter.split(',').map(k => k.trim()).filter(Boolean).forEach(k => {
          keys.push({ platform: 'openrouter', key: k });
        });
      }
      window.electronAPI.startFreeLLMAPI(keys);
    }

    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-2xl bg-obsidian-900 border border-cyan-500/30 rounded-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-obsidian-950">
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-cyan-400" />
            <h3 className="text-sm font-bold tracking-wider uppercase text-white">
              ANYA System Configuration
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-obsidian-950 px-6 gap-2 pt-2 overflow-x-auto scrollbar-none">
          {[
            { id: 'freellmapi', label: '7.4B Free Gateway', icon: Zap },
            { id: 'engine', label: 'Engine Mode', icon: Cpu },
            { id: 'keys', label: 'API Key Pools', icon: Key },
            { id: 'voice', label: 'Voice & Persona', icon: Volume2 },
            { id: 'storage', label: 'Diagnostics & Data', icon: Terminal },
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-all ${
                  active 
                    ? 'border-cyan-400 text-cyan-400 bg-cyan-950/20' 
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs sm:text-sm">
          {activeTab === 'freellmapi' && (
            <div className="space-y-4">
              {/* Status Header Card */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-950/40 via-slate-900/60 to-purple-950/40 border border-cyan-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${
                      freellmStatus === 'online' 
                        ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]' 
                        : freellmStatus === 'checking'
                        ? 'bg-amber-400 animate-spin'
                        : 'bg-red-400'
                    }`} />
                    <span className="font-bold text-xs uppercase tracking-wider text-white">
                      FreeLLMAPI Multi-Provider Gateway
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={checkFreeLLMStatus}
                      className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors"
                      title="Refresh Status"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${freellmStatus === 'checking' ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.electronAPI?.openFreeLLMAPIDashboard) {
                          window.electronAPI.openFreeLLMAPIDashboard();
                        } else {
                          window.open('http://localhost:3001', '_blank');
                        }
                      }}
                      className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Web Dashboard</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800/80 text-[11px]">
                  <div className="bg-black/30 p-2 rounded-lg border border-slate-800">
                    <div className="text-slate-400 font-mono">POOL CAPACITY</div>
                    <div className="text-cyan-300 font-bold mt-0.5">~7.4B Tokens/Mo</div>
                  </div>
                  <div className="bg-black/30 p-2 rounded-lg border border-slate-800">
                    <div className="text-slate-400 font-mono">PROVIDERS</div>
                    <div className="text-purple-300 font-bold mt-0.5">34 Multi-Tier</div>
                  </div>
                  <div className="bg-black/30 p-2 rounded-lg border border-slate-800">
                    <div className="text-slate-400 font-mono">FAILOVER</div>
                    <div className="text-emerald-400 font-bold mt-0.5">Auto 429/5xx</div>
                  </div>
                </div>

                {freellmStatus === 'online' ? (
                  <p className="text-[11px] text-emerald-400/90 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" />
                    <span>Daemon listening on port 3001. All queries load-balanced across free pools.</span>
                  </p>
                ) : freellmStatus === 'checking' ? (
                  <p className="text-[11px] text-amber-400/90">
                    Connecting to local FreeLLMAPI daemon...
                  </p>
                ) : (
                  <div className="flex items-center justify-between text-[11px] text-red-400/90">
                    <span>Gateway not detected on port 3001.</span>
                    {window.electronAPI?.startFreeLLMAPI && (
                      <button
                        type="button"
                        onClick={() => {
                          window.electronAPI.startFreeLLMAPI();
                          setTimeout(checkFreeLLMStatus, 2000);
                        }}
                        className="px-2 py-0.5 rounded bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 text-[11px]"
                      >
                        Start Gateway Daemon
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* FreeLLMAPI Enable Switch */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/40 border border-slate-800">
                <div>
                  <div className="font-bold text-xs text-white">Route Inference via FreeLLMAPI (Priority Tier 0)</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Dispatches queries through the 7.4B free token router before using direct provider API keys.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={formData.useFreeLLMAPI !== false}
                  onChange={(e) => setFormData({ ...formData, useFreeLLMAPI: e.target.checked })}
                  className="w-4 h-4 accent-cyan-400 rounded cursor-pointer"
                />
              </div>

              {/* Model Choice */}
              <div className="space-y-1.5">
                <label className="block text-xs font-mono uppercase text-slate-300">
                  Target Router Model
                </label>
                <select
                  value={formData.freellmapiModel || 'auto'}
                  onChange={(e) => setFormData({ ...formData, freellmapiModel: e.target.value })}
                  className="w-full bg-obsidian-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="auto">Auto (Smart Free-Tier Router - Picks fastest free model)</option>
                  <option value="fusion">Fusion (Multi-Model Synthesis - Panels answer in parallel)</option>
                  <option value="gemini-3.6-flash">Google Gemini 3.6 Flash (Free Endpoints)</option>
                  <option value="gemini-3.7-flash">Google Gemini 3.7 Flash</option>
                  <option value="claude-sonnet-4-5">Claude Sonnet Slot (Auto-routed Free Provider)</option>
                  <option value="gpt-oss-120b">GPT-OSS 120B (Keyless Free Tier)</option>
                  <option value="compound">Compound (Multi-LLM Panel)</option>
                  <option value="nemotron-3.5-lightning">Nemotron 3.5 Lightning</option>
                  <option value="llama-3.3-70b-instruct">Llama 3.3 70B Instruct</option>
                </select>
                <p className="text-[11px] text-slate-500">
                  Auto-routing automatically cycles through 635 free endpoints on HTTP 429 rate limits.
                </p>
              </div>

              {/* Endpoint URL & Key */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-mono uppercase text-slate-400">
                    Gateway Endpoint URL
                  </label>
                  <input
                    type="text"
                    value={formData.freellmapiUrl || 'http://localhost:3001/v1'}
                    onChange={(e) => setFormData({ ...formData, freellmapiUrl: e.target.value })}
                    className="w-full bg-obsidian-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-mono uppercase text-slate-400">
                    Master Gateway Key
                  </label>
                  <input
                    type="password"
                    value={formData.freellmapiKey || 'freellmapi-3b01700d45e8abec3101dd07b2f4ce0fca08a4eed30f29e0'}
                    onChange={(e) => setFormData({ ...formData, freellmapiKey: e.target.value })}
                    className="w-full bg-obsidian-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'engine' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-2">
                  Execution Paradigm
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setFormData({ ...formData, mode: 'autonomous' })}
                    className={`cursor-pointer p-4 rounded-xl border transition-all ${
                      formData.mode === 'autonomous'
                        ? 'bg-cyan-950/30 border-cyan-500 text-white shadow-cyan-glow/20'
                        : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-sm text-cyan-300">Autonomous On-Device</span>
                      {formData.mode === 'autonomous' && <Check className="w-4 h-4 text-cyan-400" />}
                    </div>
                    <p className="text-xs text-slate-400">
                      Zero-server dependency. Dispatches queries directly from browser/webview with client failover.
                    </p>
                  </div>

                  <div
                    onClick={() => setFormData({ ...formData, mode: 'remote' })}
                    className={`cursor-pointer p-4 rounded-xl border transition-all ${
                      formData.mode === 'remote'
                        ? 'bg-cyan-950/30 border-cyan-500 text-white shadow-cyan-glow/20'
                        : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-sm text-cyan-300">Remote Desktop Daemon</span>
                      {formData.mode === 'remote' && <Check className="w-4 h-4 text-cyan-400" />}
                    </div>
                    <p className="text-xs text-slate-400">
                      Connects to local Python server for deep OS AppleScript, shell actions, and Chrome automation.
                    </p>
                  </div>
                </div>
              </div>

              {formData.mode === 'remote' && (
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                  <label className="block text-xs font-mono uppercase text-slate-400">
                    FastAPI Server URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formData.remoteUrl}
                      onChange={(e) => setFormData({ ...formData, remoteUrl: e.target.value })}
                      placeholder="http://127.0.0.1:8000"
                      className="flex-1 bg-obsidian-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                    />
                    <button
                      onClick={handlePingServer}
                      className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${pingStatus === 'testing' ? 'animate-spin' : ''}`} />
                      <span>Ping</span>
                    </button>
                  </div>

                  {pingStatus === 'success' && (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
                      <Check className="w-4 h-4" />
                      <span>Connected to ANYA Daemon server successfully.</span>
                    </div>
                  )}
                  {pingStatus === 'failed' && (
                    <div className="flex items-center gap-1.5 text-xs text-red-400 font-mono">
                      <AlertCircle className="w-4 h-4" />
                      <span>Unable to reach daemon. Verify python server.py is running.</span>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-2">
                  Primary Model Cluster
                </label>
                <select
                  value={formData.primaryProvider}
                  onChange={(e) => setFormData({ ...formData, primaryProvider: e.target.value })}
                  className="w-full bg-obsidian-950 border border-slate-700 rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="gemini">Google Gemini 3.6 Flash (Primary Multimodal & Reasoning)</option>
                  <option value="groq">Groq Llama 3.3 70B (Sub-300ms Fast Execution)</option>
                  <option value="openrouter">OpenRouter Multi-Model (Failover)</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === 'keys' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                Enter comma-separated API keys to enable automatic key rotation upon rate limits (HTTP 429).
              </p>

              {[
                { id: 'gemini', label: 'Gemini API Keys', placeholder: 'AIzaSy...' },
                { id: 'groq', label: 'Groq API Keys', placeholder: 'gsk_...' },
                { id: 'openrouter', label: 'OpenRouter API Keys', placeholder: 'sk-or-v1-...' },
                { id: 'elevenlabs', label: 'ElevenLabs API Key', placeholder: 'sk_...' },
              ].map(item => (
                <div key={item.id} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-mono uppercase text-slate-300">
                      {item.label}
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowKeys({ ...showKeys, [item.id]: !showKeys[item.id] })}
                      className="text-slate-500 hover:text-slate-300 text-xs flex items-center gap-1"
                    >
                      {showKeys[item.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{showKeys[item.id] ? 'Hide' : 'Show'}</span>
                    </button>
                  </div>
                  <input
                    type={showKeys[item.id] ? 'text' : 'password'}
                    value={apiKeys[item.id]}
                    onChange={(e) => setApiKeys({ ...apiKeys, [item.id]: e.target.value })}
                    placeholder={item.placeholder}
                    className="w-full bg-obsidian-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
              ))}
            </div>
          )}

          {activeTab === 'voice' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-2">
                  Voice Synthesis Provider
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, voiceProvider: 'elevenlabs' })}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      formData.voiceProvider === 'elevenlabs'
                        ? 'bg-cyan-950/30 border-cyan-500 text-white'
                        : 'bg-slate-900/40 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="font-bold text-xs text-cyan-300">ElevenLabs Turbo v2</div>
                    <div className="text-[11px] text-slate-400">Crisp, authoritative Adam persona</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, voiceProvider: 'browser' })}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      formData.voiceProvider === 'browser'
                        ? 'bg-cyan-950/30 border-cyan-500 text-white'
                        : 'bg-slate-900/40 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="font-bold text-xs text-cyan-300">Native Web Speech API</div>
                    <div className="text-[11px] text-slate-400">Zero latency browser synthesis</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-2">
                  Assistant Persona
                </label>
                <select
                  value={formData.persona}
                  onChange={(e) => setFormData({ ...formData, persona: e.target.value })}
                  className="w-full bg-obsidian-950 border border-slate-700 rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="sharp">Sharp & Authoritative ("Boss")</option>
                  <option value="jarvis">Cybernetic Executive Jarvis</option>
                  <option value="casual">Casual Intelligent Tech Companion</option>
                  <option value="concise">Concise & Minimalist</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5">
                  Assistant Name
                </label>
                <input
                  type="text"
                  value={formData.assistantName ?? 'Aanya'}
                  onChange={(e) => setFormData({ ...formData, assistantName: e.target.value })}
                  placeholder="Aanya"
                  className="w-full bg-obsidian-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Name the AI assistant identifies herself as (default: Aanya).
                </p>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5">
                  User Addressing Name
                </label>
                <input
                  type="text"
                  value={formData.userName}
                  onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
                  placeholder="Boss"
                  className="w-full bg-obsidian-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          )}

          {activeTab === 'storage' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-xs text-white">Reset Token Counter</div>
                  <div className="text-[11px] text-slate-400">Clear recorded prompt and completion metrics</div>
                </div>
                <button
                  onClick={clearTokenUsage}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
                >
                  Clear Tokens
                </button>
              </div>

              <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/30 flex items-center justify-between">
                <div>
                  <div className="font-bold text-xs text-red-400">Wipe All Local Data</div>
                  <div className="text-[11px] text-slate-400">Deletes all saved threads, notes, and timers</div>
                </div>
                <button
                  onClick={() => {
                    if (window.confirm('Wipe all local memory threads, notes, and timers?')) {
                      localStorage.clear();
                      window.location.reload();
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 text-xs font-semibold"
                >
                  Wipe Memory
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-obsidian-950 border-t border-slate-800">
          <span className="text-[11px] font-mono text-slate-400">ANYA v2.0-universal</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold shadow-cyan-glow flex items-center gap-1.5"
            >
              {saveSuccess ? <Check className="w-4 h-4" /> : null}
              <span>{saveSuccess ? 'Saved' : 'Save Changes'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
