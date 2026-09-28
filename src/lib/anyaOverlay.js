/**
 * ANYA LIVE OVERLAY — Shared Command Runner
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for "execute this voice/text command".
 *
 * The full app (App.jsx handleSendMessage) does a LOT of bookkeeping (chat
 * threads, DB saves, display messages, model inference). The live overlay
 * needs the SAME execution path but WITHOUT that bookkeeping — it just wants
 * the command to happen and a short status string back.
 *
 * So we extract the pure execution core here. Both the main app and the
 * overlay call the same function, guaranteeing 100% behavioral parity:
 *   "open whatsapp" works identically whether typed in the chat or spoken
 *   in the overlay.
 *
 * Design:
 *   runCommand(text) → { intent, silentTools, statusText, needsModel }
 *     - Classifies intent via nlpProcessor.preprocess()
 *     - Builds the same silentTools array App.jsx builds
 *     - Executes them via toolDispatcher functions directly
 *     - Returns a short status string for the overlay bubble
 *   If the intent is conversational (no silent path), returns needsModel=true
 *   so the caller can optionally send it to the AI.
 */

import { preprocess } from './nlpProcessor';
import {
  executeAppLaunch,
  executeMediaControl,
  executeWebSearch,
  executeWhatsAppAction,
} from './toolDispatcher';

// ─── Build the silent tool list + status text from an intent ──────────────────
// This mirrors App.jsx's silent-action fast path exactly.
function buildSilentTools(intent) {
  let silentTools = [];
  let statusText = '';

  if (intent.type === 'web_search') {
    silentTools = [{ tool: 'web_search', args: { query: intent.query, engine: intent.engine || 'google' } }];
    statusText = `🔍 Searching for **${intent.query}**...`;
  } else if (intent.type === 'open_app' || intent.type === 'open_url') {
    const app = intent.app || 'browser';
    const url = intent.url || intent.query || '';
    silentTools = [{ tool: 'open_app', args: { app, query: url } }];
    statusText = `🚀 Opening **${app}**${url ? ` → ${url.length > 50 ? url.slice(0, 50) + '…' : url}` : ''}...`;
  } else if (intent.type === 'whatsapp_contact') {
    silentTools = [{ tool: 'whatsapp_action', args: { contact: intent.contact, message: intent.message || '', action: intent.action } }];
    statusText = intent.action === 'call'
      ? `📞 Calling **${intent.contact}** on WhatsApp...`
      : `💬 Sending WhatsApp message to **${intent.contact}**...`;
  } else if (intent.type === 'call') {
    silentTools = [{ tool: 'open_app', args: { app: 'phone', query: intent.phone } }];
    statusText = `📞 Dialling **${intent.phone}**...`;
  } else if (intent.type === 'sms') {
    silentTools = [{ tool: 'open_app', args: { app: 'sms', query: `${intent.phone}|${intent.body}` } }];
    statusText = `✉️ Sending SMS to **${intent.phone}**...`;
  } else if (intent.type === 'media_control') {
    silentTools = [{ tool: 'media_control', args: { action: intent.action, app: intent.app, query: intent.query || '' } }];
    statusText = `🎵 ${intent.action === 'play' ? 'Playing' : intent.action} on **${intent.app}**${intent.query ? `: ${intent.query}` : ''}...`;
  }

  return { silentTools, statusText };
}

// ─── Execute a single tool (the subset the overlay uses) ──────────────────────
async function executeTool(item) {
  const { tool, args = {} } = item;

  // ── Native Android bridge fast path ───────────────────────────────────────
  // When running inside the Android WebView, `window.AnyaBridge` is injected.
  // Routing through native is ~3-5x faster than the web fallback because it
  // uses Android Intents and AccessibilityService directly.
  const bridge = typeof window !== 'undefined' && window.AnyaBridge;

  switch (tool) {
    case 'open_app': {
      const { app, query } = args;
      // Android native: map common app names → package names
      if (bridge) {
        const ANDROID_PACKAGES = {
          whatsapp: 'com.whatsapp',
          instagram: 'com.instagram.android',
          spotify: 'com.spotify.music',
          youtube: 'com.google.android.youtube',
          'youtube-music': 'com.google.android.apps.youtube.music',
          ytmusic: 'com.google.android.apps.youtube.music',
          gmail: 'com.google.android.gm',
          maps: 'com.google.android.apps.maps',
          camera: 'com.android.camera2',
          settings: 'com.android.settings',
          chrome: 'com.android.chrome',
          telegram: 'org.telegram.messenger',
          twitter: 'com.twitter.android',
          snapchat: 'com.snapchat.android',
          netflix: 'com.netflix.mediaclient',
          phone: 'com.android.dialer',
          sms: 'com.android.mms',
          messages: 'com.google.android.apps.messaging',
          clock: 'com.google.android.deskclock',
          calculator: 'com.google.android.calculator',
          contacts: 'com.android.contacts',
          calendar: 'com.google.android.calendar',
        };
        const pkg = ANDROID_PACKAGES[app?.toLowerCase()] || app;
        if (pkg?.includes('.')) {
          // Looks like a package name — launch natively
          try {
            bridge.launchApp(pkg);
            return { success: true, method: 'native_intent' };
          } catch (e) { /* fall through to web */ }
        }
      }
      return await executeAppLaunch(app, query || '');
    }

    case 'whatsapp_action': {
      const { contact, message, action } = args;
      if (bridge) {
        try {
          if (action === 'call') {
            bridge.openWhatsApp(contact, '');
          } else {
            bridge.openWhatsApp(contact, message || '');
          }
          return { success: true, method: 'native_whatsapp' };
        } catch (e) { /* fall through */ }
      }
      return await executeWhatsAppAction(contact, message || '', action || 'message');
    }

    case 'media_control':
      return await executeMediaControl(args.action || 'play', args.app || 'ytmusic', args.query || args.song || '');

    case 'web_search':
      return await executeWebSearch(args.query, args.engine || 'google', false);

    default:
      return { success: false, error: `Unknown tool: ${tool}` };
  }
}

/**
 * runCommand(text, assistantName)
 * Execute a voice/text command the same way the main app would.
 * Returns { intent, statusText, results, needsModel }
 */
export async function runCommand(text, assistantName = 'Aanya') {
  const { intent } = preprocess(text, assistantName);

  const { silentTools, statusText } = buildSilentTools(intent);

  if (silentTools.length === 0) {
    // Conversational — no silent path. Caller can route to the AI model.
    return { intent, statusText: '', results: [], needsModel: true };
  }

  // Execute every tool in order. Keep going on individual failures so a
  // multi-step command still does as much as it can.
  const results = [];
  for (const item of silentTools) {
    try {
      const res = await executeTool(item);
      results.push({ tool: item.tool, args: item.args, res });
    } catch (e) {
      results.push({ tool: item.tool, args: item.args, res: { success: false, error: e.message } });
    }
  }

  return { intent, statusText, results, needsModel: false };
}