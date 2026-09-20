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

// ─── Window Creation ──────────────────────────────────────────────────────────
function createWindow() {
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
  const distPath = path.join(__dirname, '../dist/index.html');
  const isDev = !app.isPackaged && process.env.NODE_ENV === 'development';

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173').catch(() => {
      if (fs.existsSync(distPath)) mainWindow.loadFile(distPath);
    });
  } else {
    mainWindow.loadFile(distPath).catch(err => {
      console.warn('[ANYA] loadFile error, trying loadURL fallback:', err);
      mainWindow.loadURL('http://localhost:5173').catch(() => {});
    });
  }

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.warn('[ANYA] WebContents load failed:', errorDescription);
    if (fs.existsSync(distPath)) {
      mainWindow.loadFile(distPath);
    }
  });

  mainWindow.show();
  mainWindow.focus();

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
ipcMain.handle('anya:generate-pdf', async (event, { title, htmlContent, savePath }) => {
  try {
    const os = require('os');
    const safeTitle = (title || 'Aanya_Document').replace(/[^a-zA-Z0-9_\- ]/g, '_').replace(/\s+/g, '_');
    const outputPath = savePath || path.join(os.homedir(), 'Desktop', `${safeTitle}.pdf`);

    // Build a standalone HTML page to render
    const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', Arial, sans-serif; font-size: 12pt; color: #1a1a2e; line-height: 1.7; padding: 48px 60px; background: #fff; }
  h1 { font-size: 24pt; font-weight: 700; color: #0f172a; margin-bottom: 8px; border-bottom: 3px solid #0ea5e9; padding-bottom: 12px; }
  h2 { font-size: 16pt; font-weight: 600; color: #0369a1; margin-top: 28px; margin-bottom: 8px; }
  h3 { font-size: 13pt; font-weight: 600; color: #1e3a5f; margin-top: 18px; margin-bottom: 6px; }
  p  { margin-bottom: 10px; }
  ul, ol { margin: 8px 0 10px 24px; }
  li { margin-bottom: 4px; }
  code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 10pt; }
  pre  { background: #f1f5f9; padding: 12px; border-radius: 6px; overflow-x: auto; margin: 12px 0; font-size: 9.5pt; }
  blockquote { border-left: 4px solid #0ea5e9; padding-left: 16px; color: #475569; font-style: italic; margin: 14px 0; }
  .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 9pt; color: #94a3b8; text-align: center; }
</style>
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
ipcMain.handle('anya:generate-ppt', async (event, { title, slides = [], htmlContent, savePath }) => {
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

    slideList.forEach((s, idx) => {
      const slide = pptx.addSlide();
      // Dark cybernetic theme
      slide.background = { color: '090D16' };

      // Slide Header Badge
      slide.addText(`SLIDE ${idx + 1} OF ${slideList.length} • AANYA PRESENTATION`, {
        x: 0.8, y: 0.5, w: '85%', h: 0.4,
        fontSize: 10, color: '06B6D4', fontFace: 'Courier', bold: true
      });

      // Slide Title
      slide.addText(s.title || `Topic ${idx + 1}`, {
        x: 0.8, y: 0.9, w: '88%', h: 1.0,
        fontSize: 28, color: 'FFFFFF', bold: true, fontFace: 'Arial'
      });

      // Slide Subtitle
      if (s.subtitle) {
        slide.addText(s.subtitle, {
          x: 0.8, y: 1.8, w: '88%', h: 0.5,
          fontSize: 16, color: '38BDF8', italic: true, fontFace: 'Arial'
        });
      }

      // Slide Body Content
      const startY = s.subtitle ? 2.4 : 2.0;
      if (Array.isArray(s.content)) {
        const bulletItems = s.content.map(text => ({
          text: `  •  ${text}`,
          options: { fontSize: 16, color: 'E2E8F0', fontFace: 'Arial', breakLine: true }
        }));
        slide.addText(bulletItems, {
          x: 0.8, y: startY, w: '88%', h: 4.2,
          lineSpacing: 28
        });
      } else if (s.content) {
        slide.addText(String(s.content), {
          x: 0.8, y: startY, w: '88%', h: 4.2,
          fontSize: 15, color: 'E2E8F0', fontFace: 'Arial'
        });
      }

      // Footer
      slide.addText(`${title || 'Executive Presentation'}  |  Generated by Aanya OS`, {
        x: 0.8, y: 6.8, w: '88%', h: 0.4,
        fontSize: 9, color: '64748B', fontFace: 'Courier'
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
