import { clipboard, contextBridge, ipcRenderer } from 'electron'
import type { AppApi, AppSettings, CapturedExchange, ProxyStatus, ReplayRequest } from '../shared/types'

const api: AppApi = {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings: Partial<AppSettings>) => ipcRenderer.invoke('settings:update', settings),
  getProxyStatus: () => ipcRenderer.invoke('proxy:status'),
  startProxy: () => ipcRenderer.invoke('proxy:start'),
  stopProxy: () => ipcRenderer.invoke('proxy:stop'),
  enableSystemProxy: () => ipcRenderer.invoke('system-proxy:enable'),
  disableSystemProxy: () => ipcRenderer.invoke('system-proxy:disable'),
  clearCaptures: () => ipcRenderer.invoke('captures:clear'),
  getCaptures: () => ipcRenderer.invoke('captures:list'),
  saveApi: (exchangeId: string, name: string, tags: string[], collectionName: string) =>
    ipcRenderer.invoke('saved:save', { exchangeId, name, tags, collectionName }),
  listCollections: () => ipcRenderer.invoke('collections:list'),
  listSavedApis: () => ipcRenderer.invoke('saved:list'),
  exportSavedApis: () => ipcRenderer.invoke('saved:export'),
  importSavedApis: () => ipcRenderer.invoke('saved:import'),
  replay: (request: ReplayRequest) => ipcRenderer.invoke('replay:send', request),
  launchChrome: (url: string) => ipcRenderer.invoke('browser:launch-chrome', url),
  copyText: async (text: string) => clipboard.writeText(text),
  openCertificateFolder: () => ipcRenderer.invoke('cert:open-folder'),
  onCapture: (callback: (exchange: CapturedExchange) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, exchange: CapturedExchange): void => callback(exchange)
    ipcRenderer.on('captures:new', listener)
    return () => ipcRenderer.removeListener('captures:new', listener)
  },
  onProxyStatus: (callback: (status: ProxyStatus) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: ProxyStatus): void => callback(status)
    ipcRenderer.on('proxy:changed', listener)
    return () => ipcRenderer.removeListener('proxy:changed', listener)
  }
}

contextBridge.exposeInMainWorld('steal', api)
