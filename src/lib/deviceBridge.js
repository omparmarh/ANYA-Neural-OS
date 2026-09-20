/**
 * ANYA DEVICE BRIDGE
 * ─────────────────────────────────────────────────────────────────────────────
 * Abstracts interaction with the host device:
 *   - In Electron: uses IPC → AppleScript to control Chrome tabs, media, apps
 *   - In Browser:  uses named window targets + Media Session API fallbacks
 *
 * Key capabilities:
 *   • openApp(app, url)      — Open or REUSE an existing tab for an app
 *   • mediaControl(action)   — Play/pause/next/prev in existing media tab
 *   • searchInApp(app, query) — Search within an already-open app tab
 *   • getOpenTabs()          — Returns list of open Chrome tabs (Electron only)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const isElectron = typeof window !== 'undefined' && window?.electronAPI?.isElectron === true;

// ─── URL patterns for known apps (for tab detection) ─────────────────────────
const APP_TAB_PATTERNS = {
  'youtube':      'youtube.com',
  'ytmusic':      'music.youtube.com',
  'youtube-music':'music.youtube.com',
  'spotify':      'spotify.com',
  'netflix':      'netflix.com',
  'instagram':    'instagram.com',
  'twitter':      'twitter.com',
  'reddit':       'reddit.com',
  'github':       'github.com',
  'gmail':        'mail.google.com',
  'maps':         'maps.google.com',
};

/**
 * Get quick device context summary for prompt injection
 */
export async function getDeviceContext() {
  if (isElectron) {
    try {
      const tabs = await getOpenTabs();
      const hasYtMusic = tabs.some(t => t.url?.includes('music.youtube.com'));
      const hasYouTube = tabs.some(t => t.url?.includes('youtube.com'));
      const hasSpotify = tabs.some(t => t.url?.includes('spotify.com'));
      return { tabs, hasYtMusic, hasYouTube, hasSpotify };
    } catch {
      return { tabs: [], hasYtMusic: false, hasYouTube: false, hasSpotify: false };
    }
  }
  return { tabs: [], hasYtMusic: false, hasYouTube: false, hasSpotify: false };
}

// ─── Named window slots for browser-based tab reuse ──────────────────────────
const WINDOW_SLOTS = {};

/**
 * Open a URL, reusing an existing named window slot if available.
 * In Electron: uses AppleScript to find and reuse a Chrome tab.
 * In Browser:  uses named window targets.
 */
export async function openApp(appKey, url) {
  const tabPattern = APP_TAB_PATTERNS[appKey] || new URL(url).hostname;

  if (isElectron) {
    // Electron: find existing Chrome tab with this pattern and navigate it
    const result = await window.electronAPI.openInChrome(url, tabPattern);
    return { success: true, reused: result !== 'opened_new', url };
  } else {
    // Browser: use named window target so same tab gets reused
    const slot = appKey || 'anya-app';
    const existing = WINDOW_SLOTS[slot];
    if (existing && !existing.closed) {
      existing.location.href = url;
      existing.focus();
    } else {
      WINDOW_SLOTS[slot] = window.open(url, `anya-${slot}`, 'noopener');
    }
    return { success: true, reused: !!existing && !existing?.closed, url };
  }
}

/**
 * Control media playback in an existing open app tab.
 * action: 'play' | 'pause' | 'next' | 'prev'
 * appKey: which app's tab to target (e.g. 'ytmusic', 'youtube', 'spotify')
 */
export async function mediaControl(action, appKey = 'ytmusic') {
  const tabPattern = APP_TAB_PATTERNS[appKey] || appKey;

  if (isElectron) {
    return window.electronAPI.controlBrowserTab(action, tabPattern);
  }

  // Browser fallback: use Media Session API if available
  if ('mediaSession' in navigator) {
    try {
      switch (action) {
        case 'play':
          // Try to find and play a video in the current page
          document.querySelectorAll('video, audio').forEach(el => el.play?.());
          break;
        case 'pause':
          document.querySelectorAll('video, audio').forEach(el => el.pause?.());
          break;
        case 'next':
          navigator.mediaSession.callAction?.('nexttrack');
          break;
        case 'prev':
          navigator.mediaSession.callAction?.('previoustrack');
          break;
      }
      return { success: true };
    } catch (e) {}
  }
  return { success: false, reason: 'Media Session API not available' };
}

/**
 * Search within an already-open app tab, or open the search URL.
 * e.g. searchInApp('ytmusic', 'Blinding Lights') navigates the
 * YouTube Music tab to the search results page instead of opening a new tab.
 */
export async function searchInApp(appKey, query) {
  const tabPattern = APP_TAB_PATTERNS[appKey] || appKey;
  const searchUrls = {
    'ytmusic':       `https://music.youtube.com/search?q=${encodeURIComponent(query)}`,
    'youtube-music': `https://music.youtube.com/search?q=${encodeURIComponent(query)}`,
    'youtube':       `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
    'spotify':       `https://open.spotify.com/search/${encodeURIComponent(query)}`,
    'reddit':        `https://www.reddit.com/search/?q=${encodeURIComponent(query)}`,
    'github':        `https://github.com/search?q=${encodeURIComponent(query)}`,
    'netflix':       `https://www.netflix.com/search?q=${encodeURIComponent(query)}`,
  };
  const url = searchUrls[appKey] || `https://www.google.com/search?q=${encodeURIComponent(query)}`;

  if (isElectron) {
    // Navigate the existing tab to the search URL
    const result = await window.electronAPI.controlBrowserTab('search', tabPattern, url);
    return { success: true, reused: result === 'ok', url };
  } else {
    return openApp(appKey, url);
  }
}

/**
 * Get list of currently open Chrome tabs (Electron only).
 * Returns [] in browser mode.
 */
export async function getOpenTabs() {
  if (isElectron) {
    return window.electronAPI.getChromeTabs() || [];
  }
  return [];
}

/**
 * Check if a specific app is already open in a Chrome tab.
 */
export async function isAppOpen(appKey) {
  const tabs = await getOpenTabs();
  const pattern = APP_TAB_PATTERNS[appKey] || appKey;
  return tabs.some(t => t.url?.includes(pattern));
}

/**
 * Smart open: check if app is already open, then control it rather than
 * open a new tab. Ideal for "play a song in the already-open YouTube Music".
 */
export async function smartOpen(appKey, url, action = null) {
  const isOpen = await isAppOpen(appKey);
  if (isOpen && action) {
    // App is already open — just control it
    return mediaControl(action, appKey);
  }
  // App not open — navigate to it
  return openApp(appKey, url);
}

export { isElectron };
