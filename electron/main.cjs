const { app, BrowserWindow, shell, session, globalShortcut, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec, execSync, spawn } = require('child_process');

// Prevent dialog popups for unhandled main process background errors
process.on('uncaughtException', (err) => {
  console.warn('[Main Process Exception Caught]:', err.message || err);
});
process.on('unhandledRejection', (reason) => {
  console.warn('[Main Process Rejection Caught]:', reason);
});

let mainWindow = null;
let freellmapiProcess = null;
const FREELLMAPI_UNIFIED_KEY = 'freellmapi-3b01700d45e8abec3101dd07b2f4ce0fca08a4eed30f29e0';

// Find system Node.js executable path for GUI Mac app launchers
function findNodeBinary() {
  const candidates = [
    '/opt/homebrew/bin/node',
    '/usr/local/bin/node',
    '~/.nvm/versions/node/current/bin/node',
    '/usr/bin/node',
  ];
  for (const candidate of candidates) {
    const p = candidate.replace(/^~/, require('os').homedir());
    if (fs.existsSync(p)) return p;
  }
  try {
    const found = execSync('which node', { encoding: 'utf8' }).trim();
    if (found && fs.existsSync(found)) return found;
  } catch {}
  return 'node';
}

// ─── FreeLLMAPI Daemon Supervisor ─────────────────────────────────────────────
function getFreeLLMAPIDir() {
  const inApp = path.join(__dirname, '../freellmapi');
  if (fs.existsSync(inApp)) return inApp;
  const inResources = path.join(process.resourcesPath || '', 'freellmapi');
  if (fs.existsSync(inResources)) return inResources;
  return inApp;
}

function startFreeLLMAPI(keys = []) {
  if (freellmapiProcess) return;

  const freellmapiDir = getFreeLLMAPIDir();
  const serverPath = path.join(freellmapiDir, 'server/dist/index.js');
  if (!fs.existsSync(serverPath)) {
    console.warn('[FreeLLMAPI] Server script not found at', serverPath);
    return;
  }

  // Check if port 3001 is already answering
  fetch('http://localhost:3001/v1/models', {
    headers: { 'Authorization': `Bearer ${FREELLMAPI_UNIFIED_KEY}` }
  })
  .then(() => {
    console.log('[FreeLLMAPI] Port 3001 already running.');
  })
  .catch(() => {
    console.log('[FreeLLMAPI] Launching multi-provider router daemon on port 3001...');
    const env = {
      ...process.env,
      PATH: `${process.env.PATH || ''}:/usr/local/bin:/opt/homebrew/bin:${path.join(require('os').homedir(), '.nvm/versions/node/current/bin')}`,
      PORT: '3001',
      NODE_ENV: 'production',
    };

    if (Array.isArray(keys) && keys.length > 0) {
      env.FREEAPI_CONFIG_JSON = JSON.stringify({ keys });
    }

    try {
      const nodeBin = findNodeBinary();
      freellmapiProcess = spawn(nodeBin, [serverPath], {
        cwd: freellmapiDir,
        env,
        stdio: 'pipe'
      });

      freellmapiProcess.on('error', (err) => {
        console.warn('[FreeLLMAPI] Spawn error caught:', err.message);
        freellmapiProcess = null;
      });

      freellmapiProcess.stdout?.on('data', (d) => {
        const line = d.toString().trim();
        if (line) console.log(`[FreeLLMAPI] ${line}`);
      });

      freellmapiProcess.stderr?.on('data', (d) => {
        const line = d.toString().trim();
        if (line && !line.includes('missing from .env')) console.warn(`[FreeLLMAPI] ${line}`);
      });

      freellmapiProcess.on('exit', (code) => {
        console.log(`[FreeLLMAPI] Process exited with code ${code}`);
        freellmapiProcess = null;
      });
    } catch (e) {
      console.warn('[FreeLLMAPI] Spawn failed:', e);
    }
  });
}

function stopFreeLLMAPI() {
  if (freellmapiProcess) {
    try {
      freellmapiProcess.kill();
    } catch {}
    freellmapiProcess = null;
  }
}

// ─── AppleScript executor ─────────────────────────────────────────────────────
function runAppleScript(script) {
  return new Promise((resolve, reject) => {
    // Escape single quotes inside the script for shell safety
    const safe = script.replace(/'/g, "'\\''");
    exec(`osascript -e '${safe}'`, { timeout: 8000 }, (err, stdout, stderr) => {
      if (err) {
        console.warn('[AppleScript]', stderr || err.message);
        resolve(null); // resolve null instead of rejecting so UI doesn't crash
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

// ─── Chrome Tab Controller via AppleScript ────────────────────────────────────
async function chromeTabAction(action, urlPattern, payload = '') {
  // Support YouTube Music fallback to regular YouTube if ytmusic isn't open yet
  const fallbackCondition = urlPattern.includes('music.youtube.com')
    ? 'or URL of t contains "youtube.com"'
    : '';

  switch (action) {
    case 'play':
    case 'pause':
      return runAppleScript(`
        tell application "Google Chrome"
          set found to false
          repeat with w in windows
            set tabIdx to 1
            repeat with t in tabs of w
              if URL of t contains "${urlPattern}" ${fallbackCondition} then
                set active tab index of w to tabIdx
                activate
                set found to true
                exit repeat
              end if
              set tabIdx to tabIdx + 1
            end repeat
            if found then exit repeat
          end repeat
          if found then
            tell application "System Events"
              keystroke space
            end tell
            return "ok"
          else
            return "not_found"
          end if
        end tell
      `);

    case 'next':
      return runAppleScript(`
        tell application "Google Chrome"
          set found to false
          repeat with w in windows
            set tabIdx to 1
            repeat with t in tabs of w
              if URL of t contains "${urlPattern}" ${fallbackCondition} then
                set active tab index of w to tabIdx
                activate
                set found to true
                exit repeat
              end if
              set tabIdx to tabIdx + 1
            end repeat
            if found then exit repeat
          end repeat
          if found then
            tell application "System Events"
              keystroke "N" using shift down
            end tell
            return "ok"
          else
            return "not_found"
          end if
        end tell
      `);

    case 'prev':
      return runAppleScript(`
        tell application "Google Chrome"
          set found to false
          repeat with w in windows
            set tabIdx to 1
            repeat with t in tabs of w
              if URL of t contains "${urlPattern}" ${fallbackCondition} then
                set active tab index of w to tabIdx
                activate
                set found to true
                exit repeat
              end if
              set tabIdx to tabIdx + 1
            end repeat
            if found then exit repeat
          end repeat
          if found then
            tell application "System Events"
              keystroke "P" using shift down
            end tell
            return "ok"
          else
            return "not_found"
          end if
        end tell
      `);

    case 'search':
    case 'open_reuse':
    case 'navigate': {
      const targetUrl = payload;
      return runAppleScript(`
        tell application "Google Chrome"
          set found to false
          repeat with w in windows
            set tabIdx to 1
            repeat with t in tabs of w
              if URL of t contains "${urlPattern}" ${fallbackCondition} then
                set active tab index of w to tabIdx
                set URL of t to "${targetUrl}"
                activate
                set found to true
                exit repeat
              end if
              set tabIdx to tabIdx + 1
            end repeat
            if found then exit repeat
          end repeat
          if not found then
            open location "${targetUrl}"
            activate
            return "opened_new"
          end if
          return "ok"
        end tell
      `);
    }

    default:
      return null;
  }
}

// ─── Get all open Chrome tabs ─────────────────────────────────────────────────
async function getChromeTabs() {
  const result = await runAppleScript(`
    tell application "Google Chrome"
      if not (exists window 1) then return ""
      set outList to {}
      repeat with w in windows
        repeat with t in tabs of w
          set end of outList to (title of t & "|||" & URL of t)
        end repeat
      end repeat
      set AppleScript's text item delimiters to "###"
      return outList as text
    end tell
  `);
  if (!result) return [];
  return result.split('###').filter(Boolean).map(entry => {
    const [title, url] = entry.split('|||');
    return { title: (title || '').trim(), url: (url || '').trim() };
  }).filter(t => t.url);
}

// ─── Dev Server Probe ────────────────────────────────────────────────────────
/**
 * Probe a URL with a short timeout before loading it.
 * Loading an unreachable URL in Electron triggers a hard renderer SIGSEGV
 * on macOS (shared_memory_switch rendezvous failure), so we never loadURL
 * a server we haven't confirmed is answering.
 */
function probeUrl(url, timeoutMs = 600) {
  return new Promise((resolve) => {
    const controller = new AbortController();
    const timer = setTimeout(() => { controller.abort(); resolve(false); }, timeoutMs);
    fetch(url, { signal: controller.signal, headers: { 'Cache-Control': 'no-store' } })
      .then((res) => { clearTimeout(timer); resolve(res.ok); })
      .catch(() => { clearTimeout(timer); resolve(false); });
  });
}

// ─── Window Creation ──────────────────────────────────────────────────────────
async function createWindow() {
  const isMac = process.platform === 'darwin';

  mainWindow = new BrowserWindow({
    width: 1340,
    height: 900,
    minWidth: 840,
    minHeight: 620,
    show: true, // Always show immediately so window is never hidden
    backgroundColor: '#070a12', // Solid sleek cybernetic background
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    trafficLightPosition: isMac ? { x: 18, y: 18 } : undefined,
    frame: !isMac,
    icon: path.join(__dirname, '../public/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      allowRunningInsecureContent: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  // Auto-grant permissions
  if (session.defaultSession) {
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      const allowed = ['media', 'camera', 'microphone', 'notifications', 'display-capture'];
      callback(allowed.includes(permission));
    });
  }

  // Load production bundle or dev server
  const distPath = path.resolve(__dirname, '../dist/index.html');

  if (app.isPackaged) {
    mainWindow.loadFile(distPath);
  } else {
    // Probe dev servers BEFORE attempting to load. Loading an unreachable
    // URL crashes the Electron renderer on macOS, so never loadURL a dead server.
    const devUrl = await probeUrl('http://localhost:5173')
      ? 'http://localhost:5173'
      : await probeUrl('http://localhost:5174')
        ? 'http://localhost:5174'
        : null;

    if (devUrl) {
      console.log('[ANYA] Loading Vite dev server:', devUrl);
      mainWindow.loadURL(devUrl);
    } else {
      console.warn('[ANYA] Dev servers not reachable, loading bundled dist...');
      if (fs.existsSync(distPath)) {
        mainWindow.loadFile(distPath);
      }
    }
  }

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.warn('[ANYA] WebContents load failed:', errorDescription);
    if (fs.existsSync(distPath)) {
      mainWindow.loadFile(distPath);
    }
  });

  mainWindow.show();
  mainWindow.focus();
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  // All external link opens → use shell.openExternal
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

// Raw AppleScript execution
ipcMain.handle('anya:applescript', async (event, script) => {
  return runAppleScript(script);
});

// Browser tab action
ipcMain.handle('anya:browser-tab', async (event, { action, urlPattern, payload }) => {
  return chromeTabAction(action, urlPattern, payload);
});

// Open URL in Chrome, reuse existing tab
ipcMain.handle('anya:open-chrome', async (event, { url, reusePattern }) => {
  const pattern = reusePattern || new URL(url).hostname;
  return chromeTabAction('open_reuse', pattern, url);
});

// Get Chrome tabs
ipcMain.handle('anya:get-chrome-tabs', async () => {
  return getChromeTabs();
});

// Media control in existing tab
ipcMain.handle('anya:media-control', async (event, { action, tabUrlPattern }) => {
  return chromeTabAction(action, tabUrlPattern || 'youtube');
});

// ─── Resolve a "play" URL to an actual watch URL ──────────────────────────────
/**
 * "Play <song>" must actually start a track, not dump a search-results page.
 * YouTube Music search pages never auto-play, so we load the search URL in a
 * hidden window, extract the first video id, and return the watch URL.
 * Falls back to the original URL if no video id can be found.
 */
ipcMain.handle('anya:resolve-play-url', async (event, { searchUrl }) => {
  if (!searchUrl) return { success: false, error: 'No search URL provided' };

  let hiddenWin = null;
  try {
    hiddenWin = new BrowserWindow({ show: false, webPreferences: { javascript: true } });
    await hiddenWin.loadURL(searchUrl);
    // Give the page time to render its search results
    await new Promise((r) => setTimeout(r, 4500));

    const id = await hiddenWin.webContents.executeJavaScript(`
      (function(){
        let ids = [];
        document.querySelectorAll('a[href*="watch?v="]').forEach(a => {
          const m = a.href.match(/[?&]v=([A-Za-z0-9_-]{11})/);
          if (m && ids.indexOf(m[1]) === -1) ids.push(m[1]);
        });
        document.querySelectorAll('[data-video-id]').forEach(a => {
          const id = a.getAttribute('data-video-id');
          if (id && id.length === 11 && ids.indexOf(id) === -1) ids.push(id);
        });
        return ids[0] || null;
      })()
    `);

    if (id) {
      const playUrl = `https://music.youtube.com/watch?v=${id}`;
      return { success: true, playUrl, videoId: id, source: searchUrl };
    }
    return { success: false, error: 'No video id found', source: searchUrl, url: searchUrl };
  } catch (err) {
    console.warn('[ANYA] resolve-play-url error:', err.message);
    return { success: false, error: err.message, source: searchUrl, url: searchUrl };
  } finally {
    if (hiddenWin) {
      try { hiddenWin.destroy(); } catch {}
    }
  }
});

// FreeLLMAPI Gateway Status
ipcMain.handle('anya:freellmapi-status', async () => {
  try {
    const res = await fetch('http://localhost:3001/v1/models', {
      headers: { 'Authorization': `Bearer ${FREELLMAPI_UNIFIED_KEY}` },
      signal: AbortSignal.timeout(2000)
    });
    if (res.ok) {
      const data = await res.json();
      return {
        online: true,
        port: 3001,
        url: 'http://localhost:3001/v1',
        unifiedKey: FREELLMAPI_UNIFIED_KEY,
        modelCount: data.data?.length || 237,
      };
    }
  } catch {}
  return {
    online: false,
    port: 3001,
    url: 'http://localhost:3001/v1',
    unifiedKey: FREELLMAPI_UNIFIED_KEY,
    modelCount: 0,
  };
});

// FreeLLMAPI Start / Sync Keys
ipcMain.handle('anya:freellmapi-start', async (event, keys) => {
  startFreeLLMAPI(keys);
  return { success: true };
});

// Open FreeLLMAPI Web Dashboard
ipcMain.handle('anya:freellmapi-open-dashboard', async () => {
  shell.openExternal('http://localhost:3001');
  return { success: true };
});

// ─── Window Control IPC ───────────────────────────────────────────────────────
ipcMain.handle('anya:window-minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('anya:window-maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

ipcMain.handle('anya:window-close', () => {
  mainWindow?.close();
});

// ─── Native macOS App Launcher ────────────────────────────────────────────────
// Tries `open -a "AppName"` first (native install), falls back to shell.openExternal(url)
ipcMain.handle('anya:open-native-app', async (event, { appName, url, args = '' }) => {
  const isMac = process.platform === 'darwin';
  if (isMac && appName) {
    return new Promise((resolve) => {
      const cmd = args
        ? `open -a "${appName}" ${args}`
        : `open -a "${appName}"`;
      exec(cmd, { timeout: 5000 }, (err) => {
        if (!err) {
          resolve({ success: true, method: 'native', app: appName });
        } else {
          // Native app not found — fall back to browser URL
          if (url) {
            shell.openExternal(url);
            resolve({ success: true, method: 'browser', url });
          } else {
            resolve({ success: false, error: `App "${appName}" not installed and no fallback URL` });
          }
        }
      });
    });
  }
  // Non-mac or no appName: just open URL
  if (url) {
    shell.openExternal(url);
    return { success: true, method: 'browser', url };
  }
  return { success: false, error: 'No app or URL provided' };
});

// ─── Autonomous PDF Generator ──────────────────────────────────────────────────
// Renders content into a real PDF using Electron's printToPDF, saves to Desktop
ipcMain.handle('anya:generate-pdf', async (event, { title, htmlContent, savePath, theme = 'cyberpunk' }) => {
  try {
    const os = require('os');
    const safeTitle = (title || 'Aanya_Document').replace(/[^a-zA-Z0-9_\- ]/g, '_').replace(/\s+/g, '_');
    const outputPath = savePath || path.join(os.homedir(), 'Desktop', `${safeTitle}.pdf`);

    // Dynamic Style selection based on theme
    let styleBlock = '';

    if (theme === 'minimalist') {
      styleBlock = `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', Arial, sans-serif; font-size: 11pt; color: #27272a; line-height: 1.6; padding: 60px; background: #ffffff; }
        h1 { font-size: 20pt; font-weight: 300; color: #09090b; margin-bottom: 24px; border-bottom: 1px solid #e4e4e7; padding-bottom: 12px; letter-spacing: -0.02em; }
        h2 { font-size: 14pt; font-weight: 600; color: #18181b; margin-top: 24px; margin-bottom: 8px; }
        h3 { font-size: 11pt; font-weight: 600; color: #3f3f46; margin-top: 16px; margin-bottom: 4px; }
        p  { margin-bottom: 12px; }
        ul, ol { margin: 8px 0 12px 20px; }
        li { margin-bottom: 6px; }
        code { background: #f4f4f5; padding: 2px 5px; border-radius: 3px; font-family: monospace; font-size: 9.5pt; color: #09090b; }
        pre  { background: #f4f4f5; padding: 14px; border-radius: 4px; overflow-x: auto; margin: 16px 0; font-size: 9pt; border: 1px solid #e4e4e7; }
        blockquote { border-left: 2px solid #a1a1aa; padding-left: 14px; color: #71717a; font-style: italic; margin: 16px 0; }
        .footer { margin-top: 60px; padding-top: 16px; border-top: 1px solid #f4f4f5; font-size: 8.5pt; color: #a1a1aa; text-align: center; }
      `;
    } else if (theme === 'corporate') {
      styleBlock = `
        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Roboto', Arial, sans-serif; font-size: 11.5pt; color: #1e293b; line-height: 1.65; padding: 50px; background: #ffffff; }
        h1 { font-size: 22pt; font-weight: 700; color: #1e3a8a; margin-bottom: 12px; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; }
        h2 { font-size: 15pt; font-weight: 500; color: #2563eb; margin-top: 24px; margin-bottom: 8px; }
        h3 { font-size: 12pt; font-weight: 500; color: #1d4ed8; margin-top: 16px; margin-bottom: 6px; }
        p  { margin-bottom: 12px; }
        ul, ol { margin: 8px 0 12px 22px; }
        li { margin-bottom: 5px; }
        code { background: #f8fafc; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 9.5pt; border: 1px solid #e2e8f0; }
        pre  { background: #f8fafc; padding: 12px; border-radius: 6px; overflow-x: auto; margin: 16px 0; font-size: 9pt; border: 1px solid #e2e8f0; }
        blockquote { border-left: 4px solid #2563eb; padding-left: 16px; color: #475569; font-style: italic; margin: 16px 0; }
        .footer { margin-top: 50px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 9pt; color: #94a3b8; text-align: center; }
      `;
    } else if (theme === 'academic') {
      styleBlock = `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; color: #000000; line-height: 2.0; padding: 72px; background: #ffffff; text-align: justify; }
        h1 { font-size: 18pt; font-weight: bold; color: #000000; margin-bottom: 20px; text-align: center; }
        h2 { font-size: 14pt; font-weight: bold; color: #000000; margin-top: 24px; margin-bottom: 12px; }
        h3 { font-size: 12pt; font-weight: bold; color: #000000; margin-top: 18px; margin-bottom: 8px; }
        p  { margin-bottom: 18px; text-indent: 36px; }
        ul, ol { margin: 12px 0 18px 36px; }
        li { margin-bottom: 8px; }
        code { font-family: 'Courier New', Courier, monospace; font-size: 10.5pt; }
        pre  { padding: 18px; overflow-x: auto; margin: 18px 0; font-size: 10pt; border: 1px solid #000000; }
        blockquote { border-left: 1px solid #000000; padding-left: 18px; color: #000000; font-style: italic; margin: 18px 0; }
        .footer { margin-top: 72px; font-size: 10pt; color: #000000; text-align: center; }
      `;
    } else {
      // Default: dark cyberpunk (custom designed for ANYA aesthetic)
      styleBlock = `
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'JetBrains Mono', monospace; font-size: 11pt; color: #00f0ff; line-height: 1.6; padding: 50px; background: #05070c; }
        h1 { font-size: 22pt; font-weight: 700; color: #ffffff; margin-bottom: 16px; border-bottom: 2px solid #00f0ff; padding-bottom: 12px; text-shadow: 0 0 10px rgba(0,240,255,0.4); }
        h2 { font-size: 15pt; font-weight: 700; color: #38bdf8; margin-top: 26px; margin-bottom: 8px; text-shadow: 0 0 5px rgba(56,189,248,0.3); }
        h3 { font-size: 12pt; font-weight: 700; color: #22d3ee; margin-top: 18px; margin-bottom: 6px; }
        p  { margin-bottom: 12px; color: #cbd5e1; }
        ul, ol { margin: 8px 0 12px 24px; color: #cbd5e1; }
        li { margin-bottom: 4px; }
        code { background: #090d16; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 9.5pt; color: #38bdf8; border: 1px solid rgba(0,240,255,0.2); }
        pre  { background: #090d16; padding: 12px; border-radius: 6px; overflow-x: auto; margin: 16px 0; font-size: 9pt; border: 1px solid rgba(0,240,255,0.2); }
        blockquote { border-left: 4px solid #00f0ff; padding-left: 16px; color: #94a3b8; font-style: italic; margin: 16px 0; background: rgba(0,240,255,0.02); padding-top: 6px; padding-bottom: 6px; }
        .footer { margin-top: 50px; padding-top: 12px; border-top: 1px solid rgba(0,240,255,0.1); font-size: 8.5pt; color: #64748b; text-align: center; }
      `;
    }

    // Build a standalone HTML page to render
    const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>${styleBlock}</style>
</head>
<body>
${htmlContent}
<div class="footer">Generated by Aanya OS • ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
</body>
</html>`;

    // Create a hidden off-screen BrowserWindow to render the HTML
    const pdfWin = new BrowserWindow({
      show: false,
      webPreferences: { javascript: true, contextIsolation: true }
    });

    await pdfWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`);

    const pdfBuffer = await pdfWin.webContents.printToPDF({
      marginsType: 0,
      pageSize: 'A4',
      printBackground: true,
      landscape: false,
    });

    pdfWin.destroy();

    fs.writeFileSync(outputPath, pdfBuffer);

    // Open the PDF in Preview
    exec(`open "${outputPath}"`);

    return { success: true, path: outputPath, title: safeTitle };
  } catch (err) {
    console.error('[PDF] Generation failed:', err);
    return { success: false, error: err.message };
  }
});

// ─── Autonomous 16:9 Presentation / PPT (.pptx) Generator ─────────────────────
ipcMain.handle('anya:generate-ppt', async (event, { title, slides = [], htmlContent, savePath, theme = 'cyberpunk' }) => {
  try {
    const os = require('os');
    const PptxGenJS = require('pptxgenjs');
    const safeTitle = (title || 'Aanya_Presentation').replace(/[^a-zA-Z0-9_\- ]/g, '_').replace(/\s+/g, '_');
    const pptxPath = savePath || path.join(os.homedir(), 'Desktop', `Presentation_${safeTitle}.pptx`);

    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_16x9';
    pptx.title = title || 'Presentation Deck';

    const slideList = (Array.isArray(slides) && slides.length > 0) ? slides : [
      { title: title || 'Executive Presentation', subtitle: 'Generated by Aanya OS', content: ['Overview & Highlights'] }
    ];

    // Define Theme Palette
    let themeConfig = {
      bg: '090D16',
      badgeColor: '06B6D4',
      badgeFont: 'Courier',
      titleColor: 'FFFFFF',
      titleFont: 'Arial',
      subtitleColor: '38BDF8',
      subtitleFont: 'Arial',
      bodyColor: 'E2E8F0',
      bodyFont: 'Arial',
      footerColor: '64748B'
    };

    if (theme === 'minimalist') {
      themeConfig = {
        bg: 'FFFFFF',
        badgeColor: '71717A',
        badgeFont: 'Helvetica',
        titleColor: '18181B',
        titleFont: 'Helvetica',
        subtitleColor: '52525B',
        subtitleFont: 'Helvetica',
        bodyColor: '27272A',
        bodyFont: 'Helvetica',
        footerColor: 'A1A1AA'
      };
    } else if (theme === 'corporate') {
      themeConfig = {
        bg: 'F8FAFC',
        badgeColor: '2563EB',
        badgeFont: 'Calibri',
        titleColor: '1E3A8A',
        titleFont: 'Calibri',
        subtitleColor: '3B82F6',
        subtitleFont: 'Calibri',
        bodyColor: '334155',
        bodyFont: 'Calibri',
        footerColor: '94A3B8'
      };
    } else if (theme === 'academic') {
      themeConfig = {
        bg: 'FFFFFA',
        badgeColor: '451A03',
        badgeFont: 'Georgia',
        titleColor: '000000',
        titleFont: 'Georgia',
        subtitleColor: '78350F',
        subtitleFont: 'Georgia',
        bodyColor: '1C1917',
        bodyFont: 'Georgia',
        footerColor: '78716C'
      };
    }

    slideList.forEach((s, idx) => {
      const slide = pptx.addSlide();
      slide.background = { color: themeConfig.bg };

      // Top Accent Line
      slide.addShape(pptx.shapes.RECTANGLE, {
        x: 0, y: 0, w: '100%', h: 0.1,
        fill: { color: themeConfig.badgeColor }
      });

      // Slide Header Badge
      slide.addText(`SLIDE ${idx + 1} OF ${slideList.length} • ANYA NEURAL BRIEFING`, {
        x: 0.8, y: 0.35, w: '88%', h: 0.35,
        fontSize: 10, color: themeConfig.badgeColor, fontFace: themeConfig.badgeFont, bold: true
      });

      // Slide Title
      slide.addText(s.title || `Topic ${idx + 1}`, {
        x: 0.8, y: 0.75, w: '88%', h: 0.9,
        fontSize: 26, color: themeConfig.titleColor, bold: true, fontFace: themeConfig.titleFont
      });

      // Subtitle if available
      if (s.subtitle) {
        slide.addText(s.subtitle, {
          x: 0.8, y: 1.65, w: '88%', h: 0.45,
          fontSize: 14, color: themeConfig.subtitleColor, italic: true, fontFace: themeConfig.subtitleFont
        });
      }

      // Card Background Box
      const cardY = s.subtitle ? 2.15 : 1.75;
      const cardH = s.subtitle ? 4.45 : 4.85;
      slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: 0.8, y: cardY, w: 11.7, h: cardH,
        fill: { color: theme === 'minimalist' ? 'F8FAFC' : '0D1322' },
        line: { color: themeConfig.badgeColor, width: 1 }
      });

      // Normalize bullet points from s.bullets, s.content, or string text
      let bullets = [];
      if (Array.isArray(s.bullets) && s.bullets.length > 0) {
        bullets = s.bullets;
      } else if (Array.isArray(s.content) && s.content.length > 0) {
        bullets = s.content;
      } else if (typeof s.content === 'string' && s.content.trim()) {
        bullets = s.content.split(/\n|(?<=\.)\s+(?=[A-Z•\-])/).map(b => b.trim()).filter(Boolean);
      } else {
        bullets = ['Key operational and strategic insight'];
      }

      const bulletItems = bullets.map(text => ({
        text: `\u2022  ${String(text).replace(/^[\u2022\-*]\s*/, '').trim()}`,
        options: { fontSize: 15, color: themeConfig.bodyColor, fontFace: themeConfig.bodyFont, breakLine: true }
      }));

      slide.addText(bulletItems, {
        x: 1.1, y: cardY + 0.3, w: 11.1, h: cardH - 0.6,
        lineSpacingMultiple: 1.55
      });

      // Footer
      slide.addText(`${title || 'ANYA Neural Deck'}  |  Generated by ANYA Neural OS`, {
        x: 0.8, y: 6.9, w: '88%', h: 0.3,
        fontSize: 9, color: themeConfig.footerColor, fontFace: themeConfig.badgeFont
      });
    });

    await pptx.writeFile({ fileName: pptxPath });

    // Open .pptx presentation file natively in PowerPoint / Keynote
    exec(`open "${pptxPath}"`);

    return { success: true, pptxPath, path: pptxPath, title: safeTitle };
  } catch (err) {
    console.error('[PPT] Real .pptx generation failed:', err);
    return { success: false, error: err.message };
  }
});

// ─── WhatsApp Automation via Spotlight + Keyboard ────────────────────────────
// Opens WhatsApp via Spotlight, navigates to a contact, sends a message or makes a call
ipcMain.handle('anya:whatsapp-action', async (event, { contact, message, action }) => {
  if (process.platform !== 'darwin') {
    return { success: false, error: 'WhatsApp automation only supported on macOS' };
  }

  try {
    const actionType = (action || 'message').toLowerCase(); // 'message' | 'call'

    if (actionType === 'call') {
      const script = `
        try
          tell application "WhatsApp" to activate
          delay 0.8
        on error
          tell application "System Events"
            keystroke space using command down
            delay 0.8
            keystroke "whatsapp"
            delay 1.0
            key code 36
            delay 1.5
          end tell
        end try

        tell application "System Events"
          -- Focus search/chat inside WhatsApp
          keystroke "f" using command down
          delay 0.4
          keystroke "${contact.replace(/"/g, '\\"')}"
          delay 1.2
          key code 36
          delay 1.2

          -- Navigate to call icon
          repeat 11 times
            keystroke tab using control down
            delay 0.15
          end repeat
          delay 0.3
          keystroke space
          delay 0.3
        end tell

        return "call_initiated"
      `;
      const result = await runAppleScript(script);
      return { success: true, action: 'call', contact, result };

    } else {
      const safeMsg = (message || '').replace(/"/g, '\\"').replace(/\n/g, '\\n');
      const script = `
        try
          tell application "WhatsApp" to activate
          delay 0.8
        on error
          tell application "System Events"
            keystroke space using command down
            delay 0.8
            keystroke "whatsapp"
            delay 1.0
            key code 36
            delay 1.5
          end tell
        end try

        tell application "System Events"
          -- Search for contact in WhatsApp
          keystroke "f" using command down
          delay 0.4
          keystroke "${contact.replace(/"/g, '\\"')}"
          delay 1.2
          key code 36
          delay 1.0

          -- Type and send message
          if "${safeMsg}" is not "" then
            keystroke "${safeMsg}"
            delay 0.4
            key code 36
            delay 0.2
          end if
        end tell

        return "message_sent"
      `;
      const result = await runAppleScript(script);
      return { success: true, action: 'message', contact, message, result };
    }
  } catch (err) {
    console.error('[WhatsApp Automation] Error:', err);
    return { success: false, error: err.message };
  }
});

// ─── File System & Project Operations ─────────────────────────────────────────

ipcMain.handle('anya:create-file', async (event, { filePath, content }) => {
  try {
    const os = require('os');
    let targetPath = filePath.replace(/^~/, os.homedir());
    if (!path.isAbsolute(targetPath)) {
      targetPath = path.join(os.homedir(), 'Desktop', targetPath);
    }
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(targetPath, content, 'utf8');
    return { success: true, path: targetPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('anya:create-folder', async (event, { folderPath }) => {
  try {
    const os = require('os');
    let targetPath = folderPath.replace(/^~/, os.homedir());
    if (!path.isAbsolute(targetPath)) {
      targetPath = path.join(os.homedir(), 'Desktop', targetPath);
    }
    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath, { recursive: true });
    }
    return { success: true, path: targetPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('anya:read-file', async (event, { filePath }) => {
  try {
    const os = require('os');
    let targetPath = filePath.replace(/^~/, os.homedir());
    const content = fs.readFileSync(targetPath, 'utf8');
    return { success: true, content, path: targetPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('anya:list-files', async (event, { dirPath }) => {
  try {
    const os = require('os');
    let targetPath = (dirPath || '~/Desktop').replace(/^~/, os.homedir());
    const files = fs.readdirSync(targetPath);
    return { success: true, files, path: targetPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('anya:run-command', async (event, { command, cwd }) => {
  try {
    const os = require('os');
    const workingDir = cwd ? cwd.replace(/^~/, os.homedir()) : path.join(os.homedir(), 'Desktop');
    return new Promise((resolve) => {
      exec(command, { cwd: workingDir, timeout: 30000 }, (err, stdout, stderr) => {
        if (err) {
          resolve({ success: false, error: stderr || err.message, stdout });
        } else {
          resolve({ success: true, stdout: stdout.trim(), stderr: stderr.trim() });
        }
      });
    });
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ─── App Lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  // Launch FreeLLMAPI 7.4B token background router
  try {
    startFreeLLMAPI();
  } catch (err) {
    console.warn('[FreeLLMAPI] Auto-start error:', err);
  }

  createWindow();

  try {
    globalShortcut.register('CommandOrControl+Shift+Space', () => {
      if (!mainWindow) { createWindow(); return; }
      if (mainWindow.isVisible()) {
        if (mainWindow.isFocused()) { mainWindow.hide(); }
        else { mainWindow.focus(); }
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  } catch (err) {
    console.warn('Failed to register global shortcut:', err);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

app.on('will-quit', () => {
  stopFreeLLMAPI();
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
