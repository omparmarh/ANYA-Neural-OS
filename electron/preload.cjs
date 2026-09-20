/**
 * ANYA Electron Preload
 * Exposes safe IPC channels to the renderer process via contextBridge.
 * The renderer can call window.electronAPI.* to control the host OS.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /** Execute an AppleScript string on macOS. Returns stdout. */
  runAppleScript: (script) => ipcRenderer.invoke('anya:applescript', script),

  /** Find a Chrome/Safari tab matching a URL pattern and control it */
  controlBrowserTab: (action, urlPattern, payload) =>
    ipcRenderer.invoke('anya:browser-tab', { action, urlPattern, payload }),

  /** Open a URL in Chrome, reusing an existing tab if available */
  openInChrome: (url, reusePattern) =>
    ipcRenderer.invoke('anya:open-chrome', { url, reusePattern }),

  /** Get list of open Chrome tabs */
  getChromeTabs: () => ipcRenderer.invoke('anya:get-chrome-tabs'),

  /** Media control: play/pause/next/prev in Chrome media tab */
  mediaControl: (action, tabUrlPattern) =>
    ipcRenderer.invoke('anya:media-control', { action, tabUrlPattern }),

  /** FreeLLMAPI status */
  getFreeLLMAPIStatus: () => ipcRenderer.invoke('anya:freellmapi-status'),

  /** FreeLLMAPI sync keys / start */
  startFreeLLMAPI: (keys) => ipcRenderer.invoke('anya:freellmapi-start', keys),

  /** Open FreeLLMAPI Web Dashboard */
  openFreeLLMAPIDashboard: () => ipcRenderer.invoke('anya:freellmapi-open-dashboard'),

  /** Check if Electron & Platform */
  isElectron: true,
  platform: process.platform,

  /** Window controls */
  minimizeWindow: () => ipcRenderer.invoke('anya:window-minimize'),
  maximizeWindow: () => ipcRenderer.invoke('anya:window-maximize'),
  closeWindow: () => ipcRenderer.invoke('anya:window-close'),

  /** Launch a native macOS app by name, with URL fallback */
  openNativeApp: (appName, url, args) => ipcRenderer.invoke('anya:open-native-app', { appName, url, args }),

  /** Autonomously generate a PDF and save it to ~/Desktop */
  generatePDF: (title, htmlContent, savePath) => ipcRenderer.invoke('anya:generate-pdf', { title, htmlContent, savePath }),

  /** Autonomously generate 16:9 Presentation slides / PPT and save to ~/Desktop */
  generatePPT: (title, slides, htmlContent, savePath) => ipcRenderer.invoke('anya:generate-ppt', { title, slides, htmlContent, savePath }),

  /** Create a file at path with content */
  createFile: (filePath, content) => ipcRenderer.invoke('anya:create-file', { filePath, content }),

  /** Create a directory at path */
  createFolder: (folderPath) => ipcRenderer.invoke('anya:create-folder', { folderPath }),

  /** Read file content from path */
  readFile: (filePath) => ipcRenderer.invoke('anya:read-file', { filePath }),

  /** List files in directory */
  listFiles: (dirPath) => ipcRenderer.invoke('anya:list-files', { dirPath }),

  /** Execute host shell command */
  runCommand: (command, cwd) => ipcRenderer.invoke('anya:run-command', { command, cwd }),
});
