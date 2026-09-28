/**
 * ANYA SPEECH CAPTURE — reusable Web Speech recognition
 * ─────────────────────────────────────────────────────────────────────────────
 * The mic logic in App.jsx (handleToggleSpeech) is duplicated knowledge. This
 * module factors it into a single, testable, reusable unit so BOTH the main
 * app chat AND the live overlay can listen with identical behaviour.
 *
 * Usage:
 *   import { startSpeech, stopSpeech, isSpeechSupported } from './speechCapture'
 *   startSpeech({
 *     assistantName: 'Aanya',
 *     onInterim: (text) => setState(text),
 *     onFinal:  (text) => runCommand(text),
 *     onError:  (msg) => console.warn(msg),
 *   })
 *
 * The recognizer is created lazily and stopped/cleaned up on `stopSpeech()`.
 * Only ONE recognizer can be active at a time (module-level singleton) so the
 * main app and overlay can never both grab the mic.
 */

const SpeechRecognition = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

let _recognition = null;
let _onInterim = null;
let _onFinal = null;
let _onError = null;
let _assistantName = 'Aanya';

export function isSpeechSupported() {
  return !!SpeechRecognition;
}

/**
 * Build the wake-word strip regex for the configured assistant name.
 * Strips leading "hey Aanya", "Aanya", "anya", "wake up", etc.
 */
function buildWakeWordRegex(name) {
  const escaped = (name || 'Aanya').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `^(?:hey\\s+${escaped}|${escaped}|hey\\s+aanya|aanya|hey\\s+anya|anya|wake\\s+up)\\s*,?\\s*`,
    'i'
  );
}

export function startSpeech({ assistantName = 'Aanya', onInterim, onFinal, onError } = {}) {
  if (!SpeechRecognition) {
    onError && onError('Web Speech Recognition API is not supported in this browser.');
    return false;
  }

  // Stop any existing recognizer first (singleton guarantee)
  stopSpeech();

  _onInterim = onInterim || (() => {});
  _onFinal = onFinal || (() => {});
  _onError = onError || (() => {});
  _assistantName = assistantName;

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onstart = () => {
    try { if (navigator.vibrate) navigator.vibrate(40); } catch {}
  };

  recognition.onresult = (event) => {
    let interim = '';
    let final = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        final += event.results[i][0].transcript;
      } else {
        interim += event.results[i][0].transcript;
      }
    }

    if (interim) _onInterim(interim);
    if (final.trim()) {
      let cleanFinal = final.trim();
      const wakeWordRegex = buildWakeWordRegex(_assistantName);
      if (wakeWordRegex.test(cleanFinal)) {
        cleanFinal = cleanFinal.replace(wakeWordRegex, '');
      }
      if (cleanFinal) {
        _onFinal(cleanFinal);
      }
    }
  };

  recognition.onerror = (e) => {
    console.warn('Speech recognition error:', e.error);
    _onError && _onError(e.error);
    stopSpeech();
  };

  recognition.onend = () => {
    _recognition = null;
  };

  _recognition = recognition;
  try { recognition.start(); } catch (e) {
    console.warn('Speech start failed:', e);
    _onError && _onError('start_failed');
  }
  return true;
}

export function stopSpeech() {
  if (_recognition) {
    try { _recognition.stop(); } catch (e) {}
    try { _recognition.onend = null; } catch (e) {}
    _recognition = null;
  }
  _onInterim = null;
  _onFinal = null;
  _onError = null;
}

export function isListening() {
  return !!_recognition;
}