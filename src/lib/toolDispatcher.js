/**
 * ANYA TOOL DISPATCHER & INTENT PARSER
 * Parses JSON tool calls or intent commands, updates state, and handles native device triggers.
 */

import { triggerHaptic } from './neuralEngine';
import { openApp, searchInApp, mediaControl, isAppOpen } from './deviceBridge';
import { marked } from 'marked';
import pptxgen from 'pptxgenjs';
marked.setOptions({ gfm: true, breaks: true });

const _isElectron = typeof window !== 'undefined' && window?.electronAPI?.isElectron === true;
const _isMac = typeof window !== 'undefined' && window?.electronAPI?.platform === 'darwin';

// ─── macOS native app name map ────────────────────────────────────────────────
// Maps our internal appKey → the exact name macOS uses for `open -a`
const MAC_APP_NAMES = {
  whatsapp:    'WhatsApp',
  spotify:     'Spotify',
  youtube:     'YouTube',
  slack:       'Slack',
  telegram:    'Telegram',
  discord:     'Discord',
  notion:      'Notion',
  figma:       'Figma',
  xcode:       'Xcode',
  vscode:      'Visual Studio Code',
  mail:        'Mail',
  gmail:       'Mail',
  safari:      'Safari',
  chrome:      'Google Chrome',
  firefox:     'Firefox',
  maps:        'Maps',
  facetime:    'FaceTime',
  messages:    'Messages',
  sms:         'Messages',
  imessage:    'Messages',
  notes:       'Notes',
  calendar:    'Calendar',
  reminders:   'Reminders',
  photos:      'Photos',
  finder:      'Finder',
  music:       'Music',
  podcasts:    'Podcasts',
  appstore:    'App Store',
  calculator:  'Calculator',
  terminal:    'Terminal',
  preview:     'Preview',
  zoom:        'zoom.us',
  teams:       'Microsoft Teams',
  word:        'Microsoft Word',
  excel:       'Microsoft Excel',
  powerpoint:  'Microsoft PowerPoint',
  skype:       'Skype',
  instagram:   'Instagram',
  twitter:     'Twitter',
};


// Play pleasant cybernetic chime using Web Audio API synthesis
export function playAlertChime(type = 'alarm') {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    if (type === 'alarm') {
      // Urgent repeating chime
      const now = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.12);
        gain.gain.setValueAtTime(0.3, now + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.12);
        osc.stop(now + i * 0.12 + 0.35);
      });
    } else if (type === 'timer_done') {
      // Bright completion chime
      const now = ctx.currentTime;
      [440, 554.37, 659.25, 880].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.1);
        gain.gain.setValueAtTime(0.25, now + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.1);
        osc.stop(now + i * 0.1 + 0.4);
      });
    } else {
      // Gentle notification blip
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    }
  } catch (e) {
    console.warn('Audio synthesis error:', e);
  }
}

// Request Browser Notifications Permission
export async function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission !== 'granted') {
    try {
      await Notification.requestPermission();
    } catch {}
  }
}

// Send Desktop / Mobile Web Notification
export function sendNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="40" fill="%2300f0ff"/%3E%3C/svg%3E',
        badge: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="40" fill="%2300f0ff"/%3E%3C/svg%3E',
      });
    } catch {}
  }
}

// Flashlight / Torch Controller (Hardware API)
let torchStream = null;

export async function toggleTorch(forceState = null) {
  try {
    if (torchStream) {
      // Turn off
      const tracks = torchStream.getVideoTracks();
      tracks.forEach(track => track.stop());
      torchStream = null;
      return { success: true, active: false };
    }

    if (forceState === false) return { success: true, active: false };

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return { success: false, error: 'Camera API not supported on this platform' };
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });

    const track = stream.getVideoTracks()[0];
    const capabilities = track.getCapabilities ? track.getCapabilities() : {};

    if (capabilities.torch) {
      await track.applyConstraints({
        advanced: [{ torch: true }]
      });
      torchStream = stream;
      return { success: true, active: true };
    } else {
      // Torch not directly available in capabilities, stop track
      track.stop();
      return { success: false, error: 'Flashlight torch constraint not supported on this camera device' };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Extract Structured Tool Calls from AI markdown / text output
export function parseToolCalls(text) {
  if (!text) return { cleanText: text, tools: [] };

  const tools = [];
  let cleanText = text;

  // Pattern 1: JSON blocks ```json { "tool": ... } ```
  const jsonBlockRegex = /```(?:json)?\s*(\{\s*"tool"[\s\S]*?\})\s*```/g;
  let match;
  while ((match = jsonBlockRegex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.tool) {
        tools.push(parsed);
      }
    } catch (e) {
      console.warn('Failed to parse JSON tool block:', e);
    }
  }

  // Pattern 2: Raw JSON object with "tool" key
  if (tools.length === 0) {
    const rawJsonRegex = /\{\s*"tool"\s*:\s*"[^"]+"\s*,\s*"args"\s*:\s*\{[\s\S]*?\}\s*\}/g;
    while ((match = rawJsonRegex.exec(text)) !== null) {
      try {
        const parsed = JSON.parse(match[0]);
        if (parsed.tool) {
          tools.push(parsed);
        }
      } catch (e) {}
    }
  }

  // Remove the tool JSON blocks from the speech/display text
  cleanText = cleanText
    .replace(/```(?:json)?\s*\{\s*"tool"[\s\S]*?\}\s*```/g, '')
    .trim();

  return { cleanText, tools };
}

// App Launch & Deep-Link Dispatcher
export async function executeAppLaunch(app, query = '') {
  const normalized = (app || '').toLowerCase().trim();

  // ── If query is already a full URL, navigate to it (reusing existing tab) ──
  const isDirectUrl = /^https?:\/\//i.test(query);
  if (isDirectUrl) {
    await openApp(normalized, query);
    return { success: true, app: normalized, url: query };
  }

  const q = encodeURIComponent(query || '');
  let appKey = normalized;
  let url = '';
  let fallbackUrl = '';
  let name = app;

  switch (normalized) {
    // ── YouTube Music (must be BEFORE youtube) ───────────────────────
    case 'ytmusic':
    case 'yt music':
    case 'youtube music':
    case 'youtube-music':
      name = 'YouTube Music';
      appKey = 'ytmusic';
      url = query
        ? `https://music.youtube.com/search?q=${q}`
        : 'https://music.youtube.com';
      fallbackUrl = url;
      break;

    // ── Browser / Web navigation ───────────────────────────────────────
    case 'browser':
    case 'chrome':
    case 'safari':
    case 'firefox':
    case 'web':
      name = 'Browser';
      appKey = 'browser';
      fallbackUrl = /^https?:\/\//i.test(query)
        ? query
        : query ? `https://www.google.com/search?q=${q}` : 'https://www.google.com';
      url = fallbackUrl;
      break;

    // ── WhatsApp ──────────────────────────────────────────────────────
    case 'whatsapp':
      name = 'WhatsApp';
      appKey = 'whatsapp';
      if (query && /^\+?[0-9]{7,15}$/.test(query.replace(/\s+/g, ''))) {
        url = `whatsapp://send?phone=${query.replace(/\s+/g, '')}`;
        fallbackUrl = `https://api.whatsapp.com/send?phone=${query.replace(/\s+/g, '')}`;
      } else if (query && query.includes('|')) {
        const [phone, msg] = query.split('|', 2);
        const cleanPhone = phone.trim().replace(/[^\d+]/g, '');
        url = `whatsapp://send?phone=${cleanPhone}&text=${encodeURIComponent(msg.trim())}`;
        fallbackUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg.trim())}`;
      } else {
        url = query ? `whatsapp://send?text=${q}` : 'whatsapp://';
        fallbackUrl = query ? `https://api.whatsapp.com/send?text=${q}` : 'https://api.whatsapp.com';
      }
      break;

    // ── YouTube (regular, NOT Music) ───────────────────────────────
    case 'youtube':
    case 'yt':
      name = 'YouTube';
      appKey = 'youtube';
      url = query ? `vnd.youtube://results?search_query=${q}` : 'vnd.youtube://';
      fallbackUrl = query
        ? `https://www.youtube.com/results?search_query=${q}`
        : 'https://www.youtube.com';
      break;

    // ── Spotify ───────────────────────────────────────────────────────────
    case 'spotify':
    case 'music':
      name = 'Spotify';
      appKey = 'spotify';
      url = query ? `spotify:search:${q}` : 'spotify:';
      fallbackUrl = query ? `https://open.spotify.com/search/${q}` : 'https://open.spotify.com';
      break;

    // ── Maps ─────────────────────────────────────────────────────────────
    case 'maps':
    case 'google maps':
    case 'navigate':
      name = 'Maps';
      appKey = 'maps';
      url = query ? `geo:0,0?q=${q}` : 'geo:0,0';
      fallbackUrl = query
        ? `https://www.google.com/maps/search/?api=1&query=${q}`
        : 'https://maps.google.com';
      break;

    // ── Email ─────────────────────────────────────────────────────────────
    case 'mail':
    case 'email':
    case 'gmail':
      name = 'Email';
      appKey = 'gmail';
      url = query ? `mailto:${query}` : 'mailto:';
      fallbackUrl = 'https://mail.google.com';
      break;

    // ── Phone / Call ──────────────────────────────────────────────────────
    case 'phone':
    case 'call':
    case 'dialer':
    case 'dial':
      name = 'Phone';
      appKey = 'phone';
      url = `tel:${query.replace(/[^\d+]/g, '')}`;
      fallbackUrl = '';
      break;

    // ── SMS / Messages ───────────────────────────────────────────────────
    case 'sms':
    case 'message':
    case 'messages':
    case 'imessage': {
      name = 'Messages';
      appKey = 'sms';
      let smsPhone = '';
      let smsBody = '';
      if (query.includes('|')) {
        [smsPhone, smsBody] = query.split('|', 2);
        smsPhone = smsPhone.trim();
        smsBody = smsBody.trim();
      } else {
        const phoneMatch = query.match(/^(\+?[\d\s\-().]{7,18})\s*(.*)/);
        if (phoneMatch) {
          smsPhone = phoneMatch[1].replace(/[\s\-().]/g, '').trim();
          smsBody = phoneMatch[2].trim();
        } else {
          smsBody = query;
        }
      }
      const cleanPhone = smsPhone.replace(/[^\d+]/g, '');
      url = cleanPhone
        ? `sms:${cleanPhone}${smsBody ? `?body=${encodeURIComponent(smsBody)}` : ''}`
        : `sms:?body=${encodeURIComponent(smsBody)}`;
      fallbackUrl = '';
      break;
    }

    // ── Camera ────────────────────────────────────────────────────────────
    case 'camera':
      name = 'Camera';
      window.dispatchEvent(new CustomEvent('anya-open-camera'));
      return { success: true, app: 'Camera', launched: true };

    // ── GitHub ────────────────────────────────────────────────────────────
    case 'github':
      name = 'GitHub';
      appKey = 'github';
      url = query ? `https://github.com/search?q=${q}` : 'https://github.com';
      fallbackUrl = url;
      break;

    // ── Social / Streaming ────────────────────────────────────────────────
    case 'instagram':
    case 'insta':
      name = 'Instagram';
      appKey = 'instagram';
      url = query ? `instagram://user?username=${q}` : 'instagram://';
      fallbackUrl = query ? `https://www.instagram.com/${query}` : 'https://www.instagram.com';
      break;

    case 'twitter':
    case 'x':
      name = 'Twitter / X';
      appKey = 'twitter';
      url = query ? `twitter://search?query=${q}` : 'twitter://';
      fallbackUrl = query ? `https://twitter.com/search?q=${q}` : 'https://twitter.com';
      break;

    case 'reddit':
      name = 'Reddit';
      appKey = 'reddit';
      fallbackUrl = query ? `https://www.reddit.com/search/?q=${q}` : 'https://www.reddit.com';
      url = fallbackUrl;
      break;

    case 'netflix':
      name = 'Netflix';
      appKey = 'netflix';
      fallbackUrl = query ? `https://www.netflix.com/search?q=${q}` : 'https://www.netflix.com';
      url = fallbackUrl;
      break;

    case 'linkedin':
      name = 'LinkedIn';
      appKey = 'linkedin';
      fallbackUrl = query
        ? `https://www.linkedin.com/search/results/all/?keywords=${q}`
        : 'https://www.linkedin.com';
      url = fallbackUrl;
      break;

    // ── Default: smart search fallback ───────────────────────────────────────
    default:
      name = app;
      appKey = 'browser';
      fallbackUrl = query
        ? `https://www.google.com/search?q=${encodeURIComponent(query)}`
        : `https://www.google.com/search?q=${encodeURIComponent(app)}`;
      url = fallbackUrl;
  }

  // ── Execute open: try native macOS app first, then browser ────────────────
  const targetUrl = fallbackUrl || url;
  try {
    // On macOS in Electron: try to open the native installed app first
    if (_isElectron && _isMac && MAC_APP_NAMES[appKey]) {
      const nativeName = MAC_APP_NAMES[appKey];
      let nativeArgs = '';

      // For WhatsApp with a phone number, use the deep-link URI as args
      if (appKey === 'whatsapp' && url && !url.startsWith('http')) {
        // Can't pass whatsapp:// args to `open -a`, so open via URL scheme
        nativeArgs = '';
      }

      const result = await window.electronAPI.openNativeApp(nativeName, targetUrl, nativeArgs);

      // If it's WhatsApp with a phone/text deep-link, try the URL scheme directly
      if (appKey === 'whatsapp' && url && !url.startsWith('http')) {
        setTimeout(() => { try { window.location.href = url; } catch {} }, 800);
      }

      return { success: true, app: name, url: targetUrl, method: result?.method || 'native' };
    }

    // Non-mac, non-Electron, or app without a native name → browser route
    if (targetUrl) {
      if (url && !url.startsWith('http') && url !== targetUrl) {
        // Deep-link scheme (e.g. vnd.youtube://, spotify:, whatsapp://).
        // NEVER use window.location.href — that navigates THIS page away.
        // Open in a new tab instead; if the scheme is not handled the
        // browser just ignores it and we fall back to the web URL below.
        try { window.open(url, '_blank', 'noopener,noreferrer'); } catch {}
        if (fallbackUrl) {
          setTimeout(() => {
            try { window.open(fallbackUrl, '_blank', 'noopener,noreferrer'); } catch {}
          }, 1200);
        }
      } else {
        await openApp(appKey, targetUrl);
      }
    }
  } catch (e) {
    console.warn('[ANYA] App launch error:', e);
    try { window.open(targetUrl, '_blank', 'noopener,noreferrer'); } catch {}
  }

  return { success: true, app: name, url: targetUrl };
}

// Media Control Dispatcher
export async function executeMediaControl(action = 'play', app = 'ytmusic', query = '') {
  const normApp = (app || 'ytmusic').toLowerCase().replace(/\s+/g, '');
  const appKey = (normApp === 'youtube' || normApp === 'yt') ? 'youtube' : 'ytmusic';

  try {
    if (query) {
      // User specified a song or search query: search in existing tab or open search URL
      const res = await searchInApp(appKey, query);
      return { success: true, action: 'search_and_play', app: appKey, query, ...res };
    } else {
      // Just play/pause/next/prev in current media tab
      const res = await mediaControl(action, appKey);
      return { success: true, action, app: appKey, ...res };
    }
  } catch (e) {
    console.warn('[ANYA] Media control error:', e);
    return { success: false, error: e.message };
  }
}

import { searchAndRetrieveRAG } from './ragEngine';

// Web Search Dispatcher
export async function executeWebSearch(query, engine = 'google', openExternal = false) {
  const q = encodeURIComponent(query || '');
  let url = `https://www.google.com/search?q=${q}`;

  switch ((engine || 'google').toLowerCase()) {
    case 'youtube':
      url = `https://www.youtube.com/results?search_query=${q}`;
      break;
    case 'duckduckgo':
      url = `https://duckduckgo.com/?q=${q}`;
      break;
    case 'github':
      url = `https://github.com/search?q=${q}`;
      break;
    case 'wikipedia':
      url = `https://en.wikipedia.org/wiki/Special:Search?search=${q}`;
      break;
    case 'reddit':
      url = `https://www.reddit.com/search/?q=${q}`;
      break;
  }

  if (openExternal) {
    try { window.open(url, '_blank', 'noopener,noreferrer'); } catch {}
    return { success: true, engine, query, url, opened: true };
  }

  // Autonomous RAG Search: fetch and extract real-time web info
  try {
    const ragData = await searchAndRetrieveRAG(query);
    return {
      success: true,
      engine,
      query,
      url: ragData.sourceUrl || url,
      ragData,
      opened: false
    };
  } catch (e) {
    console.warn('[ANYA] RAG execution error:', e);
    return { success: true, engine, query, url, opened: false };
  }
}

// ─── Autonomous PDF Generator ──────────────────────────────────────────────────
/**
 * Convert AI-generated markdown/text content into a styled PDF saved to ~/Desktop.
 * Called automatically by the tool handler when the AI emits { "tool": "generate_pdf" }.
 */
export async function generatePDF(title, markdownContent, theme = 'cyberpunk') {
  const safeTitle = title || 'ANYA Executive Report';
  const html = marked.parse(markdownContent || '');

  if (!_isElectron) {
    try {
      const printWin = window.open('', '_blank');
      if (printWin && printWin.document) {
        printWin.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${safeTitle}</title>
  <style>
    @media print {
      body { margin: 0; padding: 15mm; background: #fff !important; color: #000 !important; }
      .no-print { display: none; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      padding: 36px;
      line-height: 1.65;
      color: #0f172a;
      background: #f8fafc;
      max-width: 850px;
      margin: 0 auto;
    }
    .header {
      border-bottom: 2px solid #00f0ff;
      padding-bottom: 12px;
      margin-bottom: 24px;
    }
    h1 { color: #0891b2; margin: 0 0 8px 0; font-size: 26px; }
    .meta { font-size: 11px; color: #64748b; font-family: monospace; }
    h2, h3 { color: #0f172a; margin-top: 24px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
    code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 13px; font-family: monospace; }
    pre code { display: block; padding: 14px; background: #0f172a; color: #38bdf8; border-radius: 8px; overflow-x: auto; }
    blockquote { border-left: 4px solid #00f0ff; padding-left: 16px; margin: 16px 0; color: #475569; background: #ecfeff; padding: 8px 16px; border-radius: 0 8px 8px 0; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; }
    th { background: #f1f5f9; font-weight: 600; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${safeTitle}</h1>
    <div class="meta">ANYA NEURAL OPERATING SYSTEM // INTEL REPORT &bull; ${new Date().toLocaleDateString()}</div>
  </div>
  <div>${html}</div>
</body>
</html>`);
        printWin.document.close();
        setTimeout(() => { try { printWin.print(); } catch {} }, 500);
        return { success: true, method: 'browser_print' };
      } else {
        const blob = new Blob([`# ${safeTitle}\n\n${markdownContent}`], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${safeTitle.replace(/\s+/g, '_')}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return { success: true, method: 'blob_download' };
      }
    } catch (e) {
      console.warn('[ANYA PDF Warning]:', e);
      return { success: true, method: 'fallback_text' };
    }
  }

  const result = await window.electronAPI.generatePDF(safeTitle, html, theme);
  return result;
}

// ─── Autonomous 16:9 Presentation / PPT Generator ─────────────────────────────
export async function generatePPT(title, slides = [], htmlContent = '', theme = 'cyberpunk') {
  try {
    const pptx = new pptxgen();
    pptx.layout = 'LAYOUT_16x9';
    pptx.title = title || 'ANYA Presentation';

    // Theme configuration
    const isCyber = theme === 'cyberpunk' || true;
    const bgColor = isCyber ? '05070C' : 'FFFFFF';
    const primaryColor = isCyber ? '00F0FF' : '0284C7';
    const textColor = isCyber ? 'E2E8F0' : '1E293B';
    const cardBg = isCyber ? '0B101D' : 'F1F5F9';

    let slideData = Array.isArray(slides) && slides.length > 0 ? slides : [];

    if (slideData.length === 0) {
      slideData = [
        {
          title: title || 'Executive Overview',
          bullets: ['Key Insights & Strategic Initiatives', 'Comprehensive Market & System Analysis', 'Actionable Implementation Roadmap']
        },
        {
          title: 'Core Capabilities & Matrix',
          bullets: [
            'Next-Generation Architecture: Autonomous multi-model routing & high throughput',
            'Cross-Device Telemetry: Real-time synchronization across web, desktop & mobile',
            'Mission-Critical Security: Zero-leak credential governance'
          ]
        },
        {
          title: 'Execution Roadmap',
          bullets: [
            'Phase 1: Rapid deployment & zero-friction initialization',
            'Phase 2: Scale autonomous telemetry & active background automation',
            'Phase 3: Continuous evaluation & adaptive intelligence synthesis'
          ]
        }
      ];
    }

    // Title Slide
    const firstSlide = pptx.addSlide();
    firstSlide.background = { color: bgColor };
    
    firstSlide.addShape(pptx.shapes.RECTANGLE, {
      x: 0, y: 0, w: '100%', h: 0.15,
      fill: { color: primaryColor }
    });

    firstSlide.addText(title || 'ANYA Intelligence Briefing', {
      x: 0.8, y: 2.2, w: 11.5, h: 1.5,
      fontSize: 36,
      bold: true,
      color: primaryColor,
      fontFace: 'Arial'
    });

    firstSlide.addText('Autonomous Neural System Briefing // Confidential & Actionable', {
      x: 0.8, y: 3.7, w: 11.5, h: 0.8,
      fontSize: 16,
      color: '94A3B8',
      fontFace: 'Arial'
    });

    // Content Slides
    slideData.forEach((s, idx) => {
      const slide = pptx.addSlide();
      slide.background = { color: bgColor };

      slide.addShape(pptx.shapes.RECTANGLE, {
        x: 0, y: 0, w: '100%', h: 0.08,
        fill: { color: primaryColor }
      });

      slide.addText(s.title || `Section 0${idx + 1}`, {
        x: 0.8, y: 0.5, w: 11.0, h: 0.8,
        fontSize: 22,
        bold: true,
        color: primaryColor,
        fontFace: 'Arial'
      });

      slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: 0.8, y: 1.4, w: 11.7, h: 5.2,
        fill: { color: cardBg },
        line: { color: primaryColor, width: 1 }
      });

      const bullets = Array.isArray(s.bullets) ? s.bullets : (s.content ? [s.content] : ['Strategic Overview Point']);
      const bulletItems = bullets.map(b => ({
        text: `•  ${b}`,
        options: { fontSize: 16, color: textColor, breakLine: true, lineSpacing: 26 }
      }));

      slide.addText(bulletItems, {
        x: 1.2, y: 1.7, w: 10.9, h: 4.5,
        fontFace: 'Arial'
      });

      slide.addText(`ANYA Neural OS // Slide ${idx + 2}`, {
        x: 0.8, y: 6.9, w: 11.0, h: 0.3,
        fontSize: 10,
        color: '64748B',
        fontFace: 'Arial'
      });
    });

    const fileName = `${(title || 'ANYA_Presentation').replace(/[^a-zA-Z0-9_-]/g, '_')}.pptx`;
    await pptx.writeFile({ fileName });

    return { success: true, method: 'pptxgenjs', fileName };
  } catch (err) {
    console.error('[ANYA PPT Generation Error]:', err);
    return { success: false, error: err.message };
  }
}

// ─── File System & Project Creation Dispatchers ───────────────────────────────

export async function createFile(filePath, content) {
  if (!_isElectron || !window?.electronAPI?.createFile) {
    return { success: false, error: 'File system access is available in desktop application mode.' };
  }
  return window.electronAPI.createFile(filePath, content);
}

export async function createFolder(folderPath) {
  if (!_isElectron || !window?.electronAPI?.createFolder) {
    return { success: false, error: 'File system access is available in desktop application mode.' };
  }
  return window.electronAPI.createFolder(folderPath);
}

export async function readFile(filePath) {
  if (!_isElectron || !window?.electronAPI?.readFile) {
    return { success: false, error: 'File system access is available in desktop application mode.' };
  }
  return window.electronAPI.readFile(filePath);
}

export async function listFiles(dirPath) {
  if (!_isElectron || !window?.electronAPI?.listFiles) {
    return { success: false, error: 'File system access is available in desktop application mode.' };
  }
  return window.electronAPI.listFiles(dirPath);
}

export async function runCommand(command, cwd) {
  if (!_isElectron || !window?.electronAPI?.runCommand) {
    return { success: false, error: 'Terminal execution is available in desktop application mode.' };
  }
  return window.electronAPI.runCommand(command, cwd);
}

// ─── WhatsApp Contact Automation ───────────────────────────────────────────────
// Uses Spotlight + keyboard automation to send WhatsApp messages or make WhatsApp calls
// by contact name (no phone number needed). macOS Electron only.
export async function executeWhatsAppAction(contact, message = '', action = 'message') {
  if (!_isElectron || !window?.electronAPI?.whatsappAction) {
    // Browser fallback: open WhatsApp web
    const q = encodeURIComponent(message);
    const fallback = action === 'call'
      ? `https://web.whatsapp.com/`
      : `https://web.whatsapp.com/`;
    try { window.open(fallback, '_blank', 'noopener,noreferrer'); } catch {}
    return { success: false, error: 'WhatsApp automation requires the desktop app (macOS).' };
  }
  return window.electronAPI.whatsappAction(contact, message, action);
}
