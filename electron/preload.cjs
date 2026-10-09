/**
 * AVNI Electron Preload
 * Exposes safe IPC channels to the renderer process via contextBridge.
 * The renderer can call window.electronAPI.* to control the host OS.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /** Execute an AppleScript string on macOS. Returns stdout. */
  runAppleScript: (script) => ipcRenderer.invoke('avni:applescript', script),

  /** Find a Chrome/Safari tab matching a URL pattern and control it */
  controlBrowserTab: (action, urlPattern, payload) =>
    ipcRenderer.invoke('avni:browser-tab', { action, urlPattern, payload }),

  /** Open a URL in Chrome, reusing an existing tab if available */
  openInChrome: (url, reusePattern) =>
    ipcRenderer.invoke('avni:open-chrome', { url, reusePattern }),

  /** Get list of open Chrome tabs */
  getChromeTabs: () => ipcRenderer.invoke('avni:get-chrome-tabs'),

  /** Media control: play/pause/next/prev in Chrome media tab */
  mediaControl: (action, tabUrlPattern) =>
    ipcRenderer.invoke('avni:media-control', { action, tabUrlPattern }),

  /**
   * Resolve a "play <song>" search URL into an actual watch URL that will
   * start playing immediately (YouTube Music search pages never auto-play).
   */
  resolvePlayUrl: (searchUrl) =>
    ipcRenderer.invoke('avni:resolve-play-url', { searchUrl }),

  /** FreeLLMAPI status */
  getFreeLLMAPIStatus: () => ipcRenderer.invoke('avni:freellmapi-status'),

  /** FreeLLMAPI sync keys / start */
  startFreeLLMAPI: (keys) => ipcRenderer.invoke('avni:freellmapi-start', keys),

  /** Open FreeLLMAPI Web Dashboard */
  openFreeLLMAPIDashboard: () => ipcRenderer.invoke('avni:freellmapi-open-dashboard'),

  /** Check if Electron & Platform */
  isElectron: true,
  platform: process.platform,

  /** Window controls */
  minimizeWindow: () => ipcRenderer.invoke('avni:window-minimize'),
  maximizeWindow: () => ipcRenderer.invoke('avni:window-maximize'),
  closeWindow: () => ipcRenderer.invoke('avni:window-close'),

  /** Launch a native macOS app by name, with URL fallback */
  openNativeApp: (appName, url, args) => ipcRenderer.invoke('avni:open-native-app', { appName, url, args }),

  /** Autonomously generate a PDF and save it to ~/Desktop */
  generatePDF: (title, htmlContent, theme = 'cyberpunk', savePath) => ipcRenderer.invoke('avni:generate-pdf', { title, htmlContent, theme, savePath }),

  /** Autonomously generate 16:9 Presentation slides / PPT and save to ~/Desktop */
  generatePPT: (title, slides, htmlContent, theme = 'cyberpunk', savePath) => ipcRenderer.invoke('avni:generate-ppt', { title, slides, htmlContent, theme, savePath }),

  /** Create a file at path with content */
  createFile: (filePath, content) => ipcRenderer.invoke('avni:create-file', { filePath, content }),

  /** Create a directory at path */
  createFolder: (folderPath) => ipcRenderer.invoke('avni:create-folder', { folderPath }),

  /** Read file content from path */
  readFile: (filePath) => ipcRenderer.invoke('avni:read-file', { filePath }),

  /** List files in directory */
  listFiles: (dirPath) => ipcRenderer.invoke('avni:list-files', { dirPath }),

  /** Execute host shell command */
  runCommand: (command, cwd) => ipcRenderer.invoke('avni:run-command', { command, cwd }),

  /** WhatsApp automation via Spotlight + keyboard (macOS) */
  whatsappAction: (contact, message, action) =>
    ipcRenderer.invoke('avni:whatsapp-action', { contact, message, action }),
});
