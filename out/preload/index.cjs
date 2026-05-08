"use strict";
const electron = require("electron");
const api = {
  getSettings: () => electron.ipcRenderer.invoke("settings:get"),
  updateSettings: (settings) => electron.ipcRenderer.invoke("settings:update", settings),
  getProxyStatus: () => electron.ipcRenderer.invoke("proxy:status"),
  startProxy: () => electron.ipcRenderer.invoke("proxy:start"),
  stopProxy: () => electron.ipcRenderer.invoke("proxy:stop"),
  enableSystemProxy: () => electron.ipcRenderer.invoke("system-proxy:enable"),
  disableSystemProxy: () => electron.ipcRenderer.invoke("system-proxy:disable"),
  clearCaptures: () => electron.ipcRenderer.invoke("captures:clear"),
  getCaptures: () => electron.ipcRenderer.invoke("captures:list"),
  saveApi: (exchangeId, name, tags, collectionName) => electron.ipcRenderer.invoke("saved:save", { exchangeId, name, tags, collectionName }),
  listCollections: () => electron.ipcRenderer.invoke("collections:list"),
  listSavedApis: () => electron.ipcRenderer.invoke("saved:list"),
  exportSavedApis: () => electron.ipcRenderer.invoke("saved:export"),
  importSavedApis: () => electron.ipcRenderer.invoke("saved:import"),
  replay: (request) => electron.ipcRenderer.invoke("replay:send", request),
  launchChrome: (url) => electron.ipcRenderer.invoke("browser:launch-chrome", url),
  copyText: async (text) => electron.clipboard.writeText(text),
  openCertificateFolder: () => electron.ipcRenderer.invoke("cert:open-folder"),
  getCertificateStatus: () => electron.ipcRenderer.invoke("cert:status"),
  installCertificate: () => electron.ipcRenderer.invoke("cert:install"),
  onCapture: (callback) => {
    const listener = (_event, exchange) => callback(exchange);
    electron.ipcRenderer.on("captures:new", listener);
    return () => electron.ipcRenderer.removeListener("captures:new", listener);
  },
  onProxyStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    electron.ipcRenderer.on("proxy:changed", listener);
    return () => electron.ipcRenderer.removeListener("proxy:changed", listener);
  }
};
electron.contextBridge.exposeInMainWorld("steal", api);
