/**
 * ANYA TELEPHONY BRIDGE & REAL-TIME WEBSOCKET CLIENT
 * Connects ANYA Client UI to live call screening sessions & controls.
 */

let _telephonySocket = null;
let _activeCalls = new Map();

/**
 * Initialize WebSocket connection to Telephony Daemon
 * @param {string} serverUrl - Telephony WebSocket URL (default: ws://localhost:3001)
 */
export function initTelephonyBridge(serverUrl = 'ws://localhost:3001') {
  if (_telephonySocket) return;

  try {
    const wsUrl = serverUrl.replace(/^http/, 'ws') + '/ws/telephony';
    _telephonySocket = new WebSocket(wsUrl);

    _telephonySocket.onopen = () => {
      console.log('[ANYA Telephony] Connected to live call screener daemon.');
    };

    _telephonySocket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        handleTelephonyEvent(payload);
      } catch (e) {
        console.warn('[ANYA Telephony] Message parse error:', e);
      }
    };

    _telephonySocket.onclose = () => {
      console.log('[ANYA Telephony] Socket closed. Reconnecting in 5s...');
      _telephonySocket = null;
      setTimeout(() => initTelephonyBridge(serverUrl), 5000);
    };

    _telephonySocket.onerror = () => {
      _telephonySocket = null;
    };
  } catch (e) {
    console.warn('[ANYA Telephony] Setup error:', e);
  }
}

/**
 * Handle incoming telephony WebSocket events
 */
function handleTelephonyEvent(payload) {
  const { type, data } = payload;

  switch (type) {
    case 'anya-call-started':
      _activeCalls.set(data.callSid, data);
      notifyUI();
      break;

    case 'anya-call-transcript': {
      const call = _activeCalls.get(data.callSid);
      if (call) {
        call.transcript = data.fullTranscript || call.transcript;
        call.summary = data.summary || call.summary;
        _activeCalls.set(data.callSid, call);
        notifyUI();
      }
      break;
    }

    case 'anya-call-state-changed': {
      const call = _activeCalls.get(data.callSid);
      if (call) {
        call.state = data.state;
        _activeCalls.set(data.callSid, call);
        notifyUI();
      }
      break;
    }

    case 'anya-call-ended':
      _activeCalls.delete(data.callSid);
      notifyUI();
      break;
  }
}

function notifyUI() {
  const calls = Array.from(_activeCalls.values());
  window.dispatchEvent(new CustomEvent('anya-telephony-update', { detail: { calls } }));
}

/**
 * Get active incoming calls being screened
 */
export function getActiveCalls() {
  return Array.from(_activeCalls.values());
}

/**
 * 1-Tap Call Takeover: Connect user directly to the caller
 */
export async function takeoverCall(callSid, remoteUrl = 'http://localhost:3001') {
  try {
    const res = await fetch(`${remoteUrl}/api/voice/takeover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callSid })
    });
    return await res.json();
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Politely hang up / end the call
 */
export async function hangupCall(callSid, signOffMessage = '', remoteUrl = 'http://localhost:3001') {
  try {
    const res = await fetch(`${remoteUrl}/api/voice/hangup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callSid, signOffMessage })
    });
    return await res.json();
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Send custom text instruction for Aanya to speak to the caller on the fly
 */
export async function sendCallInstruction(callSid, instruction, remoteUrl = 'http://localhost:3001') {
  try {
    const res = await fetch(`${remoteUrl}/api/voice/instruct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callSid, instruction })
    });
    return await res.json();
  } catch (e) {
    return { success: false, error: e.message };
  }
}
