"use strict";
const electron = require("electron");
const api = {
  getSettings: () => electron.ipcRenderer.invoke("settings:get"),
  updateSettings: (settings) => electron.ipcRenderer.invoke("settings:update", settings),
  getProxyStatus: () => electron.ipcRenderer.invoke("proxy:status"),
  startProxy: () => electron.ipcRenderer.invoke("proxy:start"),
  stopProxy: () => electron.ipcRenderer.invoke("proxy:stop"),
  setCapturePaused: (paused) => electron.ipcRenderer.invoke("captures:pause", paused),
  enableSystemProxy: () => electron.ipcRenderer.invoke("system-proxy:enable"),
  disableSystemProxy: () => electron.ipcRenderer.invoke("system-proxy:disable"),
  clearCaptures: () => electron.ipcRenderer.invoke("captures:clear"),
  getCaptures: () => electron.ipcRenderer.invoke("captures:list"),
  exportHar: (captures) => electron.ipcRenderer.invoke("captures:export-har", captures),
  importHar: () => electron.ipcRenderer.invoke("captures:import-har"),
  saveApi: (exchangeId, name, tags, collectionName) => electron.ipcRenderer.invoke("saved:save", { exchangeId, name, tags, collectionName }),
  listCollections: () => electron.ipcRenderer.invoke("collections:list"),
  updateCollectionSettings: (collectionId, settings) => electron.ipcRenderer.invoke("collections:update-settings", { collectionId, settings }),
  listSavedApis: () => electron.ipcRenderer.invoke("saved:list"),
  exportSavedApis: () => electron.ipcRenderer.invoke("saved:export"),
  importSavedApis: () => electron.ipcRenderer.invoke("saved:import"),
  replay: (request) => electron.ipcRenderer.invoke("replay:send", request),
  launchChrome: (url) => electron.ipcRenderer.invoke("browser:launch-chrome", url),
  copyText: (text) => electron.ipcRenderer.invoke("clipboard:write-text", text),
  openCertificateFolder: () => electron.ipcRenderer.invoke("cert:open-folder"),
  getCertificateStatus: () => electron.ipcRenderer.invoke("cert:status"),
  installCertificate: () => electron.ipcRenderer.invoke("cert:install"),
  getTheme: () => electron.ipcRenderer.invoke("theme:get"),
  listThemePresets: () => electron.ipcRenderer.invoke("theme:presets"),
  updateTheme: (theme) => electron.ipcRenderer.invoke("theme:update", theme),
  resetTheme: () => electron.ipcRenderer.invoke("theme:reset"),
  openThemeFile: () => electron.ipcRenderer.invoke("theme:open-file"),
  getThemeHotReload: () => electron.ipcRenderer.invoke("theme:hot-reload:get"),
  setThemeHotReload: (enabled) => electron.ipcRenderer.invoke("theme:hot-reload:set", enabled),
  getAppPlatform: () => electron.ipcRenderer.invoke("app:platform"),
  minimizeWindow: () => electron.ipcRenderer.invoke("window:minimize"),
  toggleMaximizeWindow: () => electron.ipcRenderer.invoke("window:toggle-maximize"),
  closeWindow: () => electron.ipcRenderer.invoke("window:close"),
  onCapture: (callback) => {
    const listener = (_event, exchange) => callback(exchange);
    electron.ipcRenderer.on("captures:new", listener);
    return () => electron.ipcRenderer.removeListener("captures:new", listener);
  },
  onProxyStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    electron.ipcRenderer.on("proxy:changed", listener);
    return () => electron.ipcRenderer.removeListener("proxy:changed", listener);
  },
  onThemeChanged: (callback) => {
    const listener = (_event, theme) => callback(theme);
    electron.ipcRenderer.on("theme:changed", listener);
    return () => electron.ipcRenderer.removeListener("theme:changed", listener);
  }
};
electron.contextBridge.exposeInMainWorld("steal", api);
