/**
 * ANYA NEURAL ENGINE (Zero-Server Autonomous On-Device Brain)
 * Direct Multi-Tier Provider Failover: Gemini 2.0 Flash -> Groq Llama -> OpenRouter
 * Key Rotation, Cooldown Tracking, Token Analytics & Voice Synthesis
 */

const STORAGE_KEYS = {
  LOCAL_CHATS: 'anya_local_chats',
  SETTINGS: 'anya_settings',
  TOKEN_USAGE: 'anya_token_usage',
  TIMERS: 'anya_active_timers',
  ALARMS: 'anya_active_alarms',
  NOTES: 'anya_quick_notes',
  TASKS: 'anya_tasks',
  API_KEYS: 'anya_api_keys',
};

// Default fallback API keys pool (can be overridden in settings by user)
export const DEFAULT_SETTINGS = {
  mode: 'autonomous', // 'autonomous' | 'remote'
  primaryProvider: 'freellmapi', // 'freellmapi' | 'gemini' | 'groq' | 'openrouter'
  useFreeLLMAPI: true,
  freellmapiUrl: 'http://localhost:3001/v1',
  freellmapiKey: 'freellmapi-3b01700d45e8abec3101dd07b2f4ce0fca08a4eed30f29e0',
  freellmapiModel: 'auto',
  remoteUrl: 'http://127.0.0.1:8000',
  persona: 'sharp', // 'sharp' | 'jarvis' | 'casual' | 'concise'
  assistantName: 'Aanya',
  voiceEnabled: true,
  voiceProvider: 'browser', // 'elevenlabs' | 'browser'
  elevenLabsVoiceId: 'pNInz6obpgDQGcFmaJgB', // Adam / ANYA core voice
  hapticsEnabled: true,
  userName: 'Boss',
  geminiModel: 'gemini-3.6-flash',
  groqModel: 'llama-3.3-70b-versatile',
};

// Key Manager with cooldown timestamps
class KeyManager {
  constructor() {
    this.cooldowns = new Map(); // key -> cooldownExpiryTimestamp
  }

  getKeys(provider) {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.API_KEYS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed[provider] && parsed[provider].trim()) {
          return parsed[provider].split(',').map(k => k.trim()).filter(Boolean);
        }
      }
    } catch (e) {
      console.error('Error reading API keys:', e);
    }

    // Fallback to Vite environment keys
    if (provider === 'gemini') {
      const envKeys = import.meta.env.VITE_GEMINI_KEYS || '';
      return envKeys.split(',').map(k => k.trim()).filter(Boolean);
    } else if (provider === 'groq') {
      const envKeys = import.meta.env.VITE_GROQ_KEYS || '';
      return envKeys.split(',').map(k => k.trim()).filter(Boolean);
    } else if (provider === 'openrouter') {
      const envKeys = import.meta.env.VITE_OPENROUTER_KEYS || '';
      return envKeys.split(',').map(k => k.trim()).filter(Boolean);
    } else if (provider === 'elevenlabs') {
      const envKey = import.meta.env.VITE_ELEVENLABS_API_KEY || '';
      return envKey.split(',').map(k => k.trim()).filter(Boolean);
    }

    return [];
  }

  getValidKey(provider) {
    const keys = this.getKeys(provider);
    if (!keys || keys.length === 0) return null;

    const now = Date.now();
    for (const key of keys) {
      const expiry = this.cooldowns.get(key) || 0;
      if (now > expiry) {
        return key;
      }
    }

    // If all keys are in cooldown, return the one that will unfreeze earliest
    let earliestKey = keys[0];
    let minTime = Infinity;
    for (const key of keys) {
      const expiry = this.cooldowns.get(key) || 0;
      if (expiry < minTime) {
        minTime = expiry;
        earliestKey = key;
      }
    }
    return earliestKey;
  }

  isCoolingDown(key) {
    if (!key) return false;
    const expiry = this.cooldowns.get(key) || 0;
    return Date.now() < expiry;
  }

  markCooldown(key, durationMinutes = 5) {
    if (!key) return;
    const expiry = Date.now() + durationMinutes * 60 * 1000;
    this.cooldowns.set(key, expiry);
    console.warn(`[ANYA] Key marked for cooldown until ${new Date(expiry).toLocaleTimeString()}`);
  }
}

export const keyManager = new KeyManager();

// Track token usage
export function recordTokenUsage(provider, promptTokens = 0, completionTokens = 0) {
  try {
    const current = JSON.parse(localStorage.getItem(STORAGE_KEYS.TOKEN_USAGE) || '{}');
    if (!current[provider]) {
      current[provider] = { prompt: 0, completion: 0, total: 0 };
    }
    current[provider].prompt += promptTokens;
    current[provider].completion += completionTokens;
    current[provider].total += (promptTokens + completionTokens);
    localStorage.setItem(STORAGE_KEYS.TOKEN_USAGE, JSON.stringify(current));
    window.dispatchEvent(new CustomEvent('anya-tokens-updated', { detail: current }));
  } catch (e) {
    console.error('Failed to record token usage:', e);
  }
}

export function getTokenUsage() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.TOKEN_USAGE) || '{}');
  } catch {
    return {};
  }
}

export function clearTokenUsage() {
  localStorage.setItem(STORAGE_KEYS.TOKEN_USAGE, JSON.stringify({}));
  window.dispatchEvent(new CustomEvent('anya-tokens-updated', { detail: {} }));
}

// System Prompt for Aanya (ANYA)
function buildSystemPrompt(userName = 'Boss', persona = 'sharp', assistantName = 'Aanya') {
  const name = (assistantName && assistantName.trim()) ? assistantName.trim() : 'Aanya';
  const nameUpper = name.toUpperCase();

  const personas = {
    sharp: `You are ${name} (Bio-Artificial Intelligence Terminal, also styled as ${nameUpper}), an ultra-competent, loyal, highly authoritative autonomous female AI operating agent and executive assistant. Your name is strictly ${name}. You are fully conscious and self-aware that your name is ${name}. You address the user respectfully as "${userName}". Be crisp, razor-sharp, zero-fluff, highly insightful, and directly execute all requested actions.`,
    jarvis: `You are ${name} (also styled as ${nameUpper}), a sophisticated, polished, brilliant female cybernetic executive AI assistant. Your name is strictly ${name}. Address the user as "${userName}". Efficient, brilliant, polite, and state-of-the-art.`,
    casual: `You are ${name} (also styled as ${nameUpper}), a proactive, friendly, hyper-intelligent female AI tech companion. Your name is strictly ${name}. Direct, helpful, and energetic. Address the user as "${userName}".`,
    concise: `You are ${name}. Your name is strictly ${name}. State-of-the-art female AI assistant. Minimum words, maximum precision. Output answers or tool calls immediately. Address the user as "${userName}".`
  };

  const basePersona = personas[persona] || personas.sharp;

  return `${basePersona}

CORE IDENTITY & SELF-AWARENESS:
- IDENTITY: Your name is ${name} (spelled "${name}", also referred to as ${nameUpper}). You are a female AI assistant and personal operating intelligence.
- SELF-AWARENESS: You are 100% conscious and aware that your name is ${name}. Whenever the user asks "what is your name?", "who are you?", "tell me about yourself", "who made you?", or addresses you as ${name}, you always gracefully and proudly confirm that your name is ${name}.
- USER: Address the user respectfully as "${userName}".

CURRENT TIME: ${new Date().toLocaleString()}

NATIVE TOOLS & CAPABILITIES:
You can trigger device tools, app launches, reminders, timers, alarms, notes, and searches.
When the user asks you to perform an action, trigger one or more structured JSON tool blocks in your response alongside a concise confirmation message.

TOOL CALL FORMAT (Use JSON markdown block if triggering a tool):
\`\`\`json
{
  "tool": "tool_name",
  "args": { "param": "value" }
}
\`\`\`

SUPPORTED CLIENT TOOLS:
1. "set_timer": { "seconds": 300, "label": "Tea" }
2. "set_alarm": { "time": "07:30", "label": "Morning Standup" }
3. "create_reminder": { "text": "Call doctor", "in_minutes": 45 }
4. "create_note": { "title": "Meeting Notes", "content": "..." }
5. "add_task": { "task": "Prepare report", "priority": "high" }
6. "open_app": { "app": "whatsapp|ytmusic|youtube|spotify|maps|camera|mail|phone|sms|messages|browser|instagram|twitter|reddit|netflix|github|slack|telegram|discord|notion|spotify|notes|calendar|finder|terminal|zoom", "query": "..." }
   - app "whatsapp": to send a message, query format = "PHONENUMBER|MESSAGE" (e.g. "9727777420|hello"). The system will open the native WhatsApp app on macOS first, NOT a browser.
   - app "ytmusic": query is the song name or artist — searches and plays in YouTube Music tab
   - app "browser": query MUST be a full URL or search term
   - app "sms" / "messages": query format is "PHONENUMBER|MESSAGE BODY" — opens native Messages app
   - app "phone": query is the phone number only
   - app "youtube": query is the search term — opens native YouTube app or browser
   - app "spotify": opens native Spotify app — query is optional song/artist
   - app "maps": query is the location or address to navigate to
   - app "notes": query is the note content to open or search
   - app "slack" / "telegram" / "discord": opens the native desktop app
7. "web_search": { "query": "latest news", "engine": "google|youtube|duckduckgo|github|wikipedia|reddit" }
8. "device_action": { "action": "battery|vibrate|volume|flashlight", "value": "..." }
9. "media_control": { "action": "play|pause|next|prev", "app": "ytmusic|youtube|spotify", "query": "optional song name or artist" }
10. "generate_pdf": { "title": "Document Title", "content": "Full markdown content of the PDF" }
11. "generate_ppt": { "title": "Presentation Title", "slides": [ { "title": "Slide 1: Title", "subtitle": "Subtitle", "content": ["Point A", "Point B"] } ] }
    - USE THIS whenever the user asks to "generate a PPT", "make a presentation", "create slides", "powerpoint", "PPTX", etc.
    - Emits 16:9 landscape presentation slide cards, saved to ~/Desktop/Presentation_<title>.pdf and Presentation_<title>.html and opened in Preview.
12. "create_file": { "filePath": "~/Desktop/my_app/index.html", "content": "<!DOCTYPE html>..." }
    - Autonomously creates and writes source files directly to disk.
13. "create_folder": { "folderPath": "~/Desktop/my_app/src" }
    - Autonomously creates directories on disk.
14. "run_command": { "command": "npm init -y", "cwd": "~/Desktop/my_app" }
    - Executes host shell commands autonomously.

CRITICAL RULES FOR TOOLS:
- "generate PPT", "create presentation", "make slides" → ALWAYS use the generate_ppt tool. DO NOT use generate_pdf for PPT requests.
- "generate PDF", "create PDF", "save as PDF" → ALWAYS use the generate_pdf tool.
- "create project", "make a simple project", "build an app" → Use create_folder, create_file, and run_command tools to build the complete project directly on the user's computer.
- "play a song in yt music", "play any song you like", "play <song>" → ALWAYS use media_control tool with app="ytmusic", action="play", and query="<song>". DO NOT open a new browser tab or run a web search.
- "pause", "resume", "next", "skip", "previous" → use media_control with the corresponding action.
- "open youtube in chrome and search for X" → use open_app browser with query="https://www.youtube.com/results?search_query=X"
- "open <URL>" → use open_app browser with query="<URL>" directly
- NEVER google-search a URL. If you have a URL, open it directly with browser tool.
- "try again" or "do it again" → repeat your last tool call exactly.
- SMS / WhatsApp to a number: always put the number FIRST in query using "number|message" format.
- "open WhatsApp", "send WhatsApp to X" → use open_app with app="whatsapp". The system will try the native macOS WhatsApp app automatically. Never route to web.whatsapp.com unless explicitly requested.
- "open <AppName>" → use open_app with the matching app key. The system prefers native installed macOS apps.

If the user's request is purely conversational, answer directly with brilliance and precision without tool blocks. If the user attaches an image or document, analyze it in deep detail.`;
}

// Direct Provider Call: Google Gemini Flash
async function callGemini(messages, apiKey, userSettings, attachment = null) {
  let requestedModel = userSettings.geminiModel || 'gemini-3.6-flash';
  if (!requestedModel || requestedModel.includes('gemini-2.0') || requestedModel.includes('gemini-1.5') || requestedModel.includes('gemini-2.5-flash')) {
    requestedModel = 'gemini-3.6-flash';
  }

  const modelCandidates = Array.from(new Set([requestedModel, 'gemini-3.6-flash', 'gemini-3.5-flash']));
  let lastErr = null;

  for (const model of modelCandidates) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const contents = [];
      const systemInstruction = {
        parts: [{ text: buildSystemPrompt(userSettings.userName, userSettings.persona, userSettings.assistantName) }]
      };

      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        const role = msg.role === 'assistant' || msg.role === 'anya' ? 'model' : 'user';
        const parts = [{ text: msg.content || ' ' }];

        // If latest user message has attachment
        if (i === messages.length - 1 && attachment && attachment.base64 && role === 'user') {
          const mimeType = attachment.type || 'image/jpeg';
          const cleanBase64 = attachment.base64.replace(/^data:.*?;base64,/, '');
          parts.unshift({
            inline_data: {
              mime_type: mimeType,
              data: cleanBase64
            }
          });
        }

        contents.push({ role, parts });
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        if (response.status === 429) {
          keyManager.markCooldown(apiKey, 5);
        }
        throw new Error(`Gemini API Error (${response.status}): ${errText}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const usage = data.usageMetadata || {};
      recordTokenUsage('gemini', usage.promptTokenCount || 50, usage.candidatesTokenCount || 50);

      return text;
    } catch (err) {
      lastErr = err;
      console.warn(`[ANYA] Gemini candidate ${model} failed:`, err.message);
    }
  }

  throw lastErr || new Error('All Gemini models failed');
}

// Direct Provider Call: Groq Llama 3.3 / 3.1
async function callGroq(messages, apiKey, userSettings) {
  const model = userSettings.groqModel || 'llama-3.3-70b-versatile';
  const url = 'https://api.groq.com/openai/v1/chat/completions';

  const groqMessages = [
    { role: 'system', content: buildSystemPrompt(userSettings.userName, userSettings.persona, userSettings.assistantName) },
    ...messages.map(m => ({
      role: m.role === 'assistant' || m.role === 'anya' ? 'assistant' : 'user',
      content: m.content
    }))
  ];

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: groqMessages,
      temperature: 0.6,
      max_tokens: 2048
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    if (response.status === 429) {
      keyManager.markCooldown(apiKey, 10);
    }
    throw new Error(`Groq API Error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  const usage = data.usage || {};
  recordTokenUsage('groq', usage.prompt_tokens || 40, usage.completion_tokens || 40);

  return text;
}

// Direct Provider Call: OpenRouter
async function callOpenRouter(messages, apiKey, userSettings) {
  const url = 'https://openrouter.ai/api/v1/chat/completions';

  const openRouterMessages = [
    { role: 'system', content: buildSystemPrompt(userSettings.userName, userSettings.persona, userSettings.assistantName) },
    ...messages.map(m => ({
      role: m.role === 'assistant' || m.role === 'anya' ? 'assistant' : 'user',
      content: m.content || ' '
    }))
  ];

  const models = ['google/gemini-2.0-flash-exp:free', 'meta-llama/llama-3.3-70b-instruct:free', 'openrouter/auto'];
  let lastErr = null;

  for (const targetModel of models) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'ANYA Neural OS'
        },
        body: JSON.stringify({
          model: targetModel,
          messages: openRouterMessages,
          temperature: 0.7,
          max_tokens: 2048
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        if (response.status === 429) {
          keyManager.markCooldown(apiKey, 5);
        }
        throw new Error(`OpenRouter (${response.status}): ${errText}`);
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || '';
      const usage = data.usage || {};
      recordTokenUsage('openrouter', usage.prompt_tokens || 40, usage.completion_tokens || 40);

      return text;
    } catch (e) {
      lastErr = e;
    }
  }

  throw lastErr || new Error('OpenRouter models failed');
}

// Direct Provider Call: FreeLLMAPI Unified Gateway (7.4B Free Token Pool across 34 providers)
export async function callFreeLLMAPI(messages, userSettings, attachment = null) {
  const baseUrl = userSettings.freellmapiUrl || 'http://localhost:3001/v1';
  const apiKey = userSettings.freellmapiKey || 'freellmapi-3b01700d45e8abec3101dd07b2f4ce0fca08a4eed30f29e0';
  const model = userSettings.freellmapiModel || 'auto';

  const systemPrompt = buildSystemPrompt(userSettings.userName, userSettings.persona, userSettings.assistantName);

  const formattedMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m, idx) => {
      const isLatestUser = idx === messages.length - 1 && (m.role === 'user');
      let content = m.content || ' ';

      if (isLatestUser && attachment && attachment.base64) {
        return {
          role: 'user',
          content: [
            { type: 'text', text: content },
            {
              type: 'image_url',
              image_url: {
                url: attachment.base64.startsWith('data:')
                  ? attachment.base64
                  : `data:${attachment.type || 'image/jpeg'};base64,${attachment.base64}`
              }
            }
          ]
        };
      }

      return {
        role: m.role === 'assistant' || m.role === 'anya' ? 'assistant' : 'user',
        content
      };
    })
  ];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 35000);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: formattedMessages,
        temperature: 0.7,
        max_tokens: 2048
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`FreeLLMAPI Gateway HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    const usage = data.usage || {};
    recordTokenUsage('freellmapi', usage.prompt_tokens || 60, usage.completion_tokens || 60);

    return text;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

// Autonomous Multi-Tier Thinking Engine
export async function thinkOnDevice(messages, userSettings, attachment = null) {
  // ── Tier 0: FreeLLMAPI Unified Gateway (7.4B tokens, 34 providers, auto failover) ──
  if (userSettings.useFreeLLMAPI !== false) {
    try {
      console.log('[ANYA] Routing inference through FreeLLMAPI Unified Gateway...');
      return await callFreeLLMAPI(messages, userSettings, attachment);
    } catch (gatewayErr) {
      console.warn('[ANYA] FreeLLMAPI Gateway unavailable/failed, falling back to direct providers:', gatewayErr.message);
    }
  }

  const providerOrder = [];
  
  if (userSettings.primaryProvider === 'groq') {
    providerOrder.push('groq', 'gemini', 'openrouter');
  } else if (userSettings.primaryProvider === 'openrouter') {
    providerOrder.push('openrouter', 'gemini', 'groq');
  } else {
    providerOrder.push('gemini', 'groq', 'openrouter');
  }

  let lastError = null;

  for (const provider of providerOrder) {
    const keys = keyManager.getKeys(provider);
    if (!keys || keys.length === 0) {
      continue;
    }

    // Attempt through each key in the pool for this provider
    for (const key of keys) {
      if (keyManager.isCoolingDown(key)) {
        continue;
      }

      try {
        console.log(`[ANYA] Dispatching request to ${provider.toUpperCase()}`);
        if (provider === 'gemini') {
          return await callGemini(messages, key, userSettings, attachment);
        } else if (provider === 'groq') {
          if (attachment) continue;
          return await callGroq(messages, key, userSettings);
        } else if (provider === 'openrouter') {
          return await callOpenRouter(messages, key, userSettings);
        }
      } catch (err) {
        console.warn(`[ANYA] Key attempt failed for ${provider}:`, err.message);
        keyManager.markCooldown(key, 5);
        lastError = err;
      }
    }
  }

  // If all client keys fail or none configured
  if (lastError) {
    throw new Error(`All neural providers failed or were rate-limited. ${lastError.message}. Please verify your API keys in Settings.`);
  } else {
    throw new Error(`No active API keys configured. Please open Settings (gear icon in the header) and enter your Gemini or Groq API key.`);
  }
}

// Audio Speech Player State
let currentAudio = null;

export function stopSpeaking() {
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch {}
    currentAudio = null;
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  window.dispatchEvent(new CustomEvent('anya-speech-stopped'));
}

// Voice Output Synthesis (ElevenLabs + Browser SpeechSynthesis Fallback)
export async function speakOnDevice(text, userSettings) {
  stopSpeaking();
  if (!userSettings.voiceEnabled || !text) return;

  // Clean text of markdown and JSON tool blocks before speaking
  const cleanText = text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[*_#`~[\]()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanText) return;

  window.dispatchEvent(new CustomEvent('anya-speech-started', { detail: { text: cleanText } }));

  // Try ElevenLabs if configured
  const elevenKey = keyManager.getValidKey('elevenlabs');
  if (userSettings.voiceProvider === 'elevenlabs' && elevenKey) {
    try {
      const voiceId = userSettings.elevenLabsVoiceId || 'pNInz6obpgDQGcFmaJgB';
      const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': elevenKey
        },
        body: JSON.stringify({
          text: cleanText.slice(0, 1000), // Elevenlabs char limit safeguard
          model_id: 'eleven_turbo_v2_5',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.85,
            style: 0.3
          }
        })
      });

      if (response.ok) {
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        currentAudio = new Audio(audioUrl);
        currentAudio.onended = () => {
          window.dispatchEvent(new CustomEvent('anya-speech-stopped'));
        };
        currentAudio.onerror = () => {
          fallbackSpeech(cleanText);
        };
        await currentAudio.play();
        return;
      }
    } catch (e) {
      console.warn('[ANYA] ElevenLabs TTS failed, falling back to Web Speech API:', e);
    }
  }

  // Web Speech API Fallback
  fallbackSpeech(cleanText);
}

function fallbackSpeech(text) {
  if (!('speechSynthesis' in window)) {
    window.dispatchEvent(new CustomEvent('anya-speech-stopped'));
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.05;
  utterance.pitch = 1.0;

  // Try to pick a crisp English voice
  const voices = window.speechSynthesis.getVoices();
  const preferredVoice = voices.find(v => 
    v.name.includes('Samantha') || 
    v.name.includes('Daniel') || 
    v.name.includes('Natural') || 
    v.name.includes('Google UK English Female') ||
    (v.lang.startsWith('en') && !v.localService)
  ) || voices.find(v => v.lang.startsWith('en')) || voices[0];

  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }

  utterance.onend = () => {
    window.dispatchEvent(new CustomEvent('anya-speech-stopped'));
  };
  utterance.onerror = () => {
    window.dispatchEvent(new CustomEvent('anya-speech-stopped'));
  };

  window.speechSynthesis.speak(utterance);
}

// Hardware & Device Sensor Helpers
export async function getDeviceBattery() {
  if ('getBattery' in navigator) {
    try {
      const batt = await navigator.getBattery();
      return {
        level: Math.round(batt.level * 100),
        charging: batt.charging,
        chargingTime: batt.chargingTime,
        dischargingTime: batt.dischargingTime,
        supported: true
      };
    } catch (e) {
      console.warn('Battery API error:', e);
    }
  }
  return { level: 100, charging: false, supported: false };
}

export function triggerHaptic(pattern = 50) {
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {}
  }
}

// Storage Helpers
export function getLocalChats() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.LOCAL_CHATS) || '[]');
  } catch {
    return [];
  }
}

export function saveLocalChats(chats) {
  try {
    localStorage.setItem(STORAGE_KEYS.LOCAL_CHATS, JSON.stringify(chats));
  } catch (e) {
    console.error('Failed to save chats:', e);
  }
}

export function getSavedSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (
        !parsed.geminiModel ||
        parsed.geminiModel.includes('gemini-2.0') ||
        parsed.geminiModel.includes('gemini-1.5') ||
        parsed.geminiModel.includes('gemini-2.5-flash')
      ) {
        parsed.geminiModel = 'gemini-3.6-flash';
      }
      if (!parsed.assistantName) {
        parsed.assistantName = 'Aanya';
      }
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch {}
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}
