/**
 * ANYA NLP PREPROCESSOR
 * ─────────────────────────────────────────────────────────────────────────────
 * Client-side Natural Language Processor that runs BEFORE the AI model.
 * - Detects user intent and extracts entities locally with zero latency
 * - Injects structured context into the model prompt so the AI always knows
 *   exactly what action to take and with what parameters
 * - Tracks conversation history to resolve contextual references like "try again",
 *   "do that again", "same thing", "open it", etc.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { searchAndRetrieveRAG } from './ragEngine';

// ─── Entity Patterns ─────────────────────────────────────────────────────────

const PHONE_REGEX = /(?:call|ring|message|text|sms|whatsapp|send to)?\s*[\+]?([0-9][\s\-()]{0,3}){7,15}/gi;
const TIME_REGEX = /(\d{1,2}):(\d{2})\s*(am|pm)?/gi;
const DURATION_REGEX = /(\d+(?:\.\d+)?)\s*(second|sec|minute|min|hour|hr|day)s?/gi;
const URL_REGEX = /https?:\/\/[^\s]+/gi;
const YOUTUBE_SEARCH_REGEX = /(?:youtube\.com\/results\?search_query=|youtube\.com\/search\?q=)([^&\s]+)/i;

// ─── Intent Keyword Maps ──────────────────────────────────────────────────────

const APP_ALIASES = {
  // Browser variants
  browser: 'browser', chrome: 'browser', safari: 'browser', firefox: 'browser',
  'google chrome': 'browser', 'the browser': 'browser', 'web browser': 'browser',
  // Comms
  whatsapp: 'whatsapp', whats: 'whatsapp', wa: 'whatsapp',
  sms: 'sms', text: 'sms', message: 'sms', imessage: 'sms', messages: 'sms',
  phone: 'phone', call: 'phone', dialer: 'phone', dial: 'phone',
  gmail: 'mail', email: 'mail', mail: 'mail',
  // Media
  'yt music': 'ytmusic', 'youtube music': 'ytmusic', ytmusic: 'ytmusic', 'yt-music': 'ytmusic',
  youtube: 'youtube', yt: 'youtube',
  spotify: 'spotify', music: 'ytmusic',
  netflix: 'netflix',
  // Maps
  maps: 'maps', 'google maps': 'maps', navigate: 'maps', directions: 'maps',
  // Social
  instagram: 'instagram', insta: 'instagram',
  twitter: 'twitter', x: 'twitter',
  reddit: 'reddit',
  linkedin: 'linkedin',
  // Productivity
  github: 'github',
  camera: 'camera',
};

const OPEN_INTENT_PATTERNS = [
  /open\s+(.+?)(?:\s+in\s+(.+))?(?:\s+and\s+(.+))?$/i,
  /launch\s+(.+)/i,
  /go to\s+(.+)/i,
  /start\s+(.+)/i,
  /navigate to\s+(.+)/i,
];

const SEARCH_INTENT_PATTERNS = [
  /(?:give|show|tell|fetch|get|find)\s+(?:me\s+)?(?:any\s+)?(?:updated|latest|recent|current)\s+(?:info|information|news|updates|details|data)(?:\s+about|\s+on|\s+for)?\s*(.*)/i,
  /what\s+is\s+the\s+(?:latest|current|updated|recent)\s+(.*)/i,
  /search\s+(?:for\s+)?(.+?)(?:\s+on\s+(\w+))?$/i,
  /look up\s+(.+)/i,
  /find\s+(.+?)(?:\s+on\s+(\w+))?$/i,
  /google\s+(.+)/i,
];

const CALL_INTENT_PATTERNS = [
  /call\s+(.+)/i,
  /ring\s+(.+)/i,
  /dial\s+(.+)/i,
  /phone\s+(.+)/i,
];

const SMS_INTENT_PATTERNS = [
  /(?:send|text|message|sms)\s+(?:a\s+)?(?:message|text|sms)?\s*(?:to\s+)?([+\d][\d\s\-()]{5,17})\s+(.+)/i,
  /(?:send|text|message|sms)\s+"(.+?)"\s+(?:to\s+)?([+\d][\d\s\-()]{5,17})/i,
];

const TIMER_INTENT_PATTERNS = [
  /(?:set|start|create)\s+(?:a\s+)?timer\s+(?:for\s+)?(.+)/i,
  /remind\s+me\s+in\s+(.+)/i,
  /timer\s+(?:for\s+)?(.+)/i,
];

const ALARM_INTENT_PATTERNS = [
  /(?:set|create)\s+(?:an?\s+)?alarm\s+(?:for\s+|at\s+)?(.+)/i,
  /wake\s+me\s+(?:up\s+)?(?:at\s+)?(.+)/i,
  /alarm\s+(?:at\s+|for\s+)?(.+)/i,
];

const RETRY_PATTERNS = [
  /^try\s+again$/i,
  /^do\s+(?:that|it)\s+again$/i,
  /^again$/i,
  /^repeat$/i,
  /^redo$/i,
];

// ─── Duration Parser ──────────────────────────────────────────────────────────

export function parseDurationToSeconds(text) {
  let totalSeconds = 0;
  const regex = /(\d+(?:\.\d+)?)\s*(second|sec|minute|min|hour|hr|day)s?/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const value = parseFloat(match[1]);
    const unit = match[2].toLowerCase();
    if (unit.startsWith('sec')) totalSeconds += value;
    else if (unit.startsWith('min')) totalSeconds += value * 60;
    else if (unit.startsWith('hour') || unit === 'hr') totalSeconds += value * 3600;
    else if (unit === 'day') totalSeconds += value * 86400;
  }
  return totalSeconds > 0 ? totalSeconds : null;
}

// ─── Time Parser (for alarms) ─────────────────────────────────────────────────

export function parseTimeString(text) {
  const t = text.trim().toLowerCase();
  // Match HH:MM am/pm or H am/pm
  const match = t.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!match) return null;

  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2] || '0');
  const meridiem = match[3]?.toLowerCase();

  if (meridiem === 'pm' && hours !== 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;

  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  return `${hh}:${mm}`;
}

// ─── Phone Number Extractor ───────────────────────────────────────────────────

export function extractPhoneNumber(text) {
  // Match international or local phone numbers
  const match = text.match(/(\+?\d[\d\s\-().]{6,17}\d)/);
  if (!match) return null;
  return match[1].replace(/[\s\-().]/g, '');
}

// ─── App + Query Extractor ────────────────────────────────────────────────────

function extractAppAndQuery(rawText) {
  // Check for "open X in Y" pattern (e.g. "open youtube in chrome")
  const inPattern = /open\s+(.+?)\s+in\s+(.+?)(?:\s+and\s+(.+))?$/i;
  const inMatch = rawText.match(inPattern);
  if (inMatch) {
    const appOrQuery = inMatch[1].trim().toLowerCase();
    const platform = inMatch[2].trim().toLowerCase();
    const extra = inMatch[3]?.trim();

    // "open youtube in chrome" → open browser with YouTube URL
    const knownApp = APP_ALIASES[appOrQuery];
    const platformAlias = APP_ALIASES[platform] || platform;

    if (knownApp && platformAlias === 'browser') {
      // User wants to open a known app INSIDE the browser
      const directUrls = {
        youtube: 'https://www.youtube.com',
        spotify: 'https://open.spotify.com',
        netflix: 'https://www.netflix.com',
        instagram: 'https://www.instagram.com',
        twitter: 'https://twitter.com',
        reddit: 'https://www.reddit.com',
        linkedin: 'https://www.linkedin.com',
        github: 'https://github.com',
        gmail: 'https://mail.google.com',
        maps: 'https://maps.google.com',
      };

      // If there's an "and search for X" part
      if (extra) {
        const searchMatch = extra.match(/search\s+(?:for\s+)?(.+)/i);
        if (searchMatch) {
          const query = searchMatch[1].trim();
          const searchUrls = {
            youtube: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
            spotify: `https://open.spotify.com/search/${encodeURIComponent(query)}`,
            reddit: `https://www.reddit.com/search/?q=${encodeURIComponent(query)}`,
            github: `https://github.com/search?q=${encodeURIComponent(query)}`,
          };
          return {
            app: 'browser',
            url: searchUrls[knownApp] || `${directUrls[knownApp]}`,
            query,
            platform: knownApp,
          };
        }
      }

      return {
        app: 'browser',
        url: directUrls[knownApp] || `https://www.google.com/search?q=${encodeURIComponent(appOrQuery)}`,
        platform: knownApp,
      };
    }
  }

  return null;
}

// ─── Intent Classifier ────────────────────────────────────────────────────────

function classifyIntent(text, assistantName = 'Aanya') {
  const lower = text.toLowerCase().trim();

  // PPT / Presentation Intent
  if (/(?:generate|create|make|save|export|build|write|download)\s+(?:a|the|my|an|\s)*(?:new|custom|simple|full|\s)*(?:ppt|powerpoint|presentation|slide\s*deck|slides)|ppt\b|powerpoint\b|presentation\b/i.test(lower)) {
    let title = 'Presentation Deck';
    const titleMatch = text.match(/(?:about|on|for|title[d\s:]*)\s+"?([^"\n.]+)"?/i);
    if (titleMatch) title = titleMatch[1].trim();
    return { type: 'ppt', title };
  }

  // PDF Intent
  if (/(?:generate|create|make|save|export|build|write|download)\s+(?:a|the|my|an|\s)*(?:new|custom|simple|full|\s)*pdf|pdf\b/i.test(lower)) {
    let title = 'Document Report';
    const titleMatch = text.match(/(?:about|on|for|title[d\s:]*)\s+"?([^"\n.]+)"?/i);
    if (titleMatch) title = titleMatch[1].trim();
    return { type: 'pdf', title };
  }

  // File System & Project Creation Intent
  if (/(?:create|make|write|build|store|generate)\s+(?:a|the|my|an|\s)*(?:new|custom|simple|full|\s)*(?:file|folder|directory|project|repo|codebase|app|program|game)\b|save\s+whole\s+project|save\s+(?:on|to)\s+desktop/i.test(lower)) {
    return { type: 'file_system' };
  }

  // Assistant identity query intent (ensures AI is 100% aware her name is Aanya)
  const IDENTITY_PATTERNS = [
    /what(?:'s|\s+is|\s+are)?\s+(?:your|ur)\s+name/i,
    /who\s+(?:are|r)\s+(?:you|u)\b/i,
    /who\s+am\s+i\s+talking\s+to\b/i,
    /what\s+should\s+i\s+call\s+(?:you|u)\b/i,
    /what\s+can\s+i\s+call\s+(?:you|u)\b/i,
    /what\s+do\s+i\s+call\s+(?:you|u)\b/i,
    /tell\s+me\s+(?:your\s+name|who\s+you\s+are)\b/i,
    /do\s+you\s+(?:have|know)\s+(?:a\s+name|your\s+name)\b/i,
    /(?:are|r)\s+you\s+(?:aanya|anya)\b/i,
    /is\s+your\s+name\s+(?:aanya|anya)\b/i,
    /^your\s+name\s*\??$/i
  ];
  for (const pattern of IDENTITY_PATTERNS) {
    if (pattern.test(lower)) {
      return { type: 'identity', assistantName };
    }
  }

  // Retry intent
  if (RETRY_PATTERNS.some(p => p.test(lower))) {
    return { type: 'retry' };
  }

  // Direct URL open
  if (URL_REGEX.test(text)) {
    URL_REGEX.lastIndex = 0;
    const url = text.match(URL_REGEX)?.[0];
    return { type: 'open_url', url };
  }
  URL_REGEX.lastIndex = 0;

  // SMS/text intent
  for (const pattern of SMS_INTENT_PATTERNS) {
    const m = text.match(pattern);
    if (m) {
      const phone = extractPhoneNumber(m[1] || m[2]);
      const body = (m[2] || m[1] || '').trim();
      if (phone) return { type: 'sms', phone, body };
    }
  }

  // Call intent
  for (const pattern of CALL_INTENT_PATTERNS) {
    const m = lower.match(pattern);
    if (m) {
      const phone = extractPhoneNumber(m[1]);
      if (phone) return { type: 'call', phone };
    }
  }

  // ── Media Playback Actions (pause, resume, next, prev) ─────────
  const mediaActionMatch = lower.match(/^(pause|stop|resume|unpause|next|skip|previous|prev)\b(?:\s+(?:the\s+)?(?:music|song|track|playback|video))?/i);
  if (mediaActionMatch) {
    const verb = mediaActionMatch[1].toLowerCase();
    const action = (verb === 'resume' || verb === 'unpause') ? 'play' : (verb === 'stop' ? 'pause' : verb);
    return {
      type: 'media_control',
      action,
      app: 'ytmusic',
    };
  }

  // ── Play Music / Song Intent ──────────────────────────────────
  if (/^play\b/i.test(lower)) {
    const mediaAppMatch = lower.match(/(?:in|on)\s+(yt\s*music|youtube\s*music|ytmusic|spotify|youtube|yt)\b/i);
    let targetApp = 'ytmusic'; // Default to YouTube Music
    if (mediaAppMatch) {
      const appRaw = mediaAppMatch[1].toLowerCase().replace(/\s+/g, '');
      if (appRaw === 'spotify') targetApp = 'spotify';
      else if (appRaw === 'youtube' || appRaw === 'yt') targetApp = 'youtube';
      else targetApp = 'ytmusic';
    }

    let songQuery = lower
      .replace(/^play\s+/i, '')
      .replace(/(?:in|on)\s+(yt\s*music|youtube\s*music|ytmusic|spotify|youtube|yt)\b/i, '')
      .trim();

    const isGeneric = /^(?:a|any|some)?\s*(?:song|track|music)?\s*(?:you\s+like|random|good|popular|something)?$/i.test(songQuery) || !songQuery || songQuery === 'any song you like';
    if (isGeneric) {
      songQuery = 'The Weeknd Blinding Lights';
    }

    return {
      type: 'media_control',
      action: 'play',
      app: targetApp,
      query: songQuery,
      isGeneric,
    };
  }

  // Open app / browser with query
  const appQuery = extractAppAndQuery(text);
  if (appQuery) return { type: 'open_app', ...appQuery };

  // Open intent (generic)
  for (const pattern of OPEN_INTENT_PATTERNS) {
    const m = lower.match(pattern);
    if (m) {
      const target = (m[1] || '').trim();
      const alias = APP_ALIASES[target];
      if (alias) return { type: 'open_app', app: alias, query: m[3] || '' };
      // Could be a search query for unknown app
      return { type: 'open_app', app: target, query: m[3] || '' };
    }
  }

  // Timer intent
  for (const pattern of TIMER_INTENT_PATTERNS) {
    const m = lower.match(pattern);
    if (m) {
      const seconds = parseDurationToSeconds(m[1]);
      if (seconds) return { type: 'set_timer', seconds, label: m[1] };
    }
  }

  // Alarm intent
  for (const pattern of ALARM_INTENT_PATTERNS) {
    const m = lower.match(pattern);
    if (m) {
      const time = parseTimeString(m[1]);
      if (time) return { type: 'set_alarm', time };
    }
  }

  // Search intent
  for (const pattern of SEARCH_INTENT_PATTERNS) {
    const m = lower.match(pattern);
    if (m) {
      const query = (m[1] || '').trim();
      const engine = m[2]?.toLowerCase() || 'google';
      return { type: 'web_search', query, engine };
    }
  }

  return { type: 'conversational' };
}

// ─── Context Injection Builder ────────────────────────────────────────────────

function buildNLPContext(intent, originalText) {
  const parts = [];

  switch (intent.type) {
    case 'retry':
      parts.push('[NLP] User wants to retry the LAST action exactly. Repeat your most recent tool call(s) with the same parameters.');
      break;

    case 'open_url':
      parts.push(`[NLP] Direct URL navigation detected. Use open_app tool with app="browser", query="${intent.url}".`);
      break;

    case 'open_app':
      if (intent.url) {
        parts.push(`[NLP] Open browser and navigate to "${intent.url}". Use open_app tool: { "tool": "open_app", "args": { "app": "browser", "query": "${intent.url}" } }`);
      } else {
        parts.push(`[NLP] Open app "${intent.app}"${intent.query ? ` with query "${intent.query}"` : ''}. Use open_app tool.`);
      }
      break;

    case 'sms':
      parts.push(`[NLP] Send SMS to phone number "${intent.phone}"${intent.body ? ` with message: "${intent.body}"` : ''}. Use open_app tool: { "tool": "open_app", "args": { "app": "sms", "query": "${intent.phone}|${intent.body || ''}" } }`);
      break;

    case 'call':
      parts.push(`[NLP] Initiate phone call to number "${intent.phone}". Use open_app tool: { "tool": "open_app", "args": { "app": "phone", "query": "${intent.phone}" } }`);
      break;

    case 'set_timer':
      parts.push(`[NLP] Set timer for ${intent.seconds} seconds. Use set_timer tool: { "tool": "set_timer", "args": { "seconds": ${intent.seconds}, "label": "${intent.label}" } }`);
      break;

    case 'set_alarm':
      parts.push(`[NLP] Set alarm at ${intent.time}. Use set_alarm tool: { "tool": "set_alarm", "args": { "time": "${intent.time}" } }`);
      break;

    case 'media_control':
      parts.push(`[NLP] Host Device Media Command detected.
Action: "${intent.action}", App: "${intent.app}"${intent.query ? `, Track/Search: "${intent.query}"` : ''}.
MANDATORY TOOL INSTRUCTION:
Use media_control tool: { "tool": "media_control", "args": { "action": "${intent.action}", "app": "${intent.app}", "query": "${intent.query || ''}" } }
CRITICAL RULES:
1. Do NOT open a new browser tab or run a web search.
2. Control or search directly in the existing ${intent.app === 'ytmusic' ? 'YouTube Music' : intent.app} tab on the device.`);
      break;

    case 'web_search':
      parts.push(`[NLP] Web search for "${intent.query}" on ${intent.engine}. Use web_search tool: { "tool": "web_search", "args": { "query": "${intent.query}", "engine": "${intent.engine}" } }`);
      break;

    case 'pdf':
      parts.push(`[NLP] User requested PDF generation.
MANDATORY TOOL INSTRUCTION:
You MUST emit the generate_pdf tool block containing full, comprehensive markdown content.
Format:
\`\`\`json
{
  "tool": "generate_pdf",
  "args": {
    "title": "${intent.title || 'Aanya Document'}",
    "content": "# Executive Overview\\n\\nWrite the complete detailed report in rich Markdown..."
  }
}
\`\`\`
DO NOT reply saying you cannot compile or create local PDF files. You possess the generate_pdf tool.`);
      break;

    case 'ppt':
      parts.push(`[NLP] USER REQUESTED REAL PPT (POWERPOINT PRESENTATION) GENERATION.
CRITICAL MANDATORY TOOL INSTRUCTION:
- You MUST emit the generate_ppt tool call!
- DO NOT emit generate_pdf, create_note, or say you generated a PDF!
- You MUST emit:
\`\`\`json
{
  "tool": "generate_ppt",
  "args": {
    "title": "${intent.title || 'Executive Presentation'}",
    "slides": [
      {
        "title": "Slide 1: Title & Key Concept",
        "subtitle": "Overview & Objectives",
        "content": ["Key Point 1", "Key Point 2", "Key Point 3"]
      },
      {
        "title": "Slide 2: Strategic Analysis",
        "subtitle": "Detailed Insights",
        "content": ["Insight A", "Insight B", "Insight C"]
      }
    ]
  }
}
\`\`\`
The system will automatically generate a real native .pptx PowerPoint file on the user's Desktop and open it.`);
      break;

    case 'file_system':
      parts.push(`[NLP] USER REQUESTED AUTONOMOUS PROJECT / FILE CREATION ON DESKTOP.
CRITICAL MANDATORY TOOL INSTRUCTION:
- DO NOT emit create_note or create_reminder!
- You MUST create actual folders and source code files on disk using create_folder and create_file tools.
- Emit:
1. \`\`\`json
{ "tool": "create_folder", "args": { "folderPath": "~/Desktop/ProjectName" } }
\`\`\`
2. \`\`\`json
{ "tool": "create_file", "args": { "filePath": "~/Desktop/ProjectName/main.c", "content": "#include <stdio.h>..." } }
\`\`\`
3. (Optional compile/run command):
\`\`\`json
{ "tool": "run_command", "args": { "command": "gcc main.c -o game && ./game", "cwd": "~/Desktop/ProjectName" } }
\`\`\`
Emit create_folder and create_file tool calls now!`);
      break;

    case 'identity': {
      const name = intent.assistantName || 'Aanya';
      parts.push(`[NLP] User inquiry regarding your identity or name.
INSTRUCTION:
- You are strictly ${name}, an autonomous, highly intelligent female AI operating agent and personal assistant.
- Always identify yourself as ${name} with warmth, confidence, and professionalism.`);
      break;
    }
  }

  return parts.length > 0 ? `\n\n${parts.join('\n')}` : '';
}

// ─── Main NLP Processor ───────────────────────────────────────────────────────

let _lastIntent = null;

/**
 * preprocess(userText, assistantName)
 * @param {string} userText - Raw user input
 * @param {string} assistantName - Name of the AI assistant (default: 'Aanya')
 * @returns {{ enhancedText: string, intent: object }} 
 *   enhancedText: the original text with NLP context injected (sent to model)
 *   intent: structured intent object (for local optimistic execution)
 */
export function preprocess(userText, assistantName = 'Aanya') {
  const text = (userText || '').trim();

  // Detect intent
  const intent = classifyIntent(text, assistantName);

  // Handle retry by reusing last known intent
  if (intent.type === 'retry' && _lastIntent) {
    const retryContext = buildNLPContext(_lastIntent, text);
    return {
      enhancedText: `${text}${retryContext}`,
      intent: { type: 'retry', original: _lastIntent },
      isRetry: true,
    };
  }

  // Store intent for retry
  if (intent.type !== 'conversational' && intent.type !== 'retry') {
    _lastIntent = intent;
  }

  const context = buildNLPContext(intent, text);
  return {
    enhancedText: `${text}${context}`,
    intent,
    isRetry: false,
  };
}

/**
 * preprocessAsync(userText, assistantName)
 * Async preprocessor that fetches live RAG data for web search/updated info queries
 */
export async function preprocessAsync(userText, assistantName = 'Aanya') {
  const result = preprocess(userText, assistantName);

  if (result.intent.type === 'web_search' && result.intent.query) {
    try {
      const ragData = await searchAndRetrieveRAG(result.intent.query);
      result.intent.ragData = ragData;
      if (ragData.ragContext) {
        result.enhancedText += ragData.ragContext;
      }
    } catch (e) {
      console.warn('[NLP] Async RAG retrieval warning:', e);
    }
  }

  return result;
}

/**
 * resolveAppDisplay(app, query)
 * Returns human-readable display name for chat bubbles
 */
export function resolveAppDisplay(app, query) {
  const displayNames = {
    browser: `Browser → ${query || 'New Tab'}`,
    ytmusic: `YouTube Music ${query ? `→ ${query}` : ''}`,
    youtube: `YouTube ${query ? `→ ${query}` : ''}`,
    whatsapp: 'WhatsApp',
    sms: 'Messages',
    phone: 'Phone',
    mail: 'Mail',
    spotify: 'Spotify',
    maps: 'Maps',
    camera: 'Camera',
    github: 'GitHub',
    instagram: 'Instagram',
    twitter: 'Twitter / X',
    reddit: 'Reddit',
    netflix: 'Netflix',
  };
  return displayNames[app] || app;
}
