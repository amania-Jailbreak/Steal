import { clipboard, contextBridge, ipcRenderer } from 'electron'
import type { AppApi, AppSettings, AppTheme, CapturedExchange, ProxyStatus, ReplayRequest } from '../shared/types'

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
  getCertificateStatus: () => ipcRenderer.invoke('cert:status'),
  installCertificate: () => ipcRenderer.invoke('cert:install'),
  getTheme: () => ipcRenderer.invoke('theme:get'),
  listThemePresets: () => ipcRenderer.invoke('theme:presets'),
  updateTheme: (theme: AppTheme) => ipcRenderer.invoke('theme:update', theme),
  resetTheme: () => ipcRenderer.invoke('theme:reset'),
  openThemeFile: () => ipcRenderer.invoke('theme:open-file'),
  chooseThemeImage: () => ipcRenderer.invoke('theme:choose-image'),
  getThemeImageDataUrl: (imagePath: string) => ipcRenderer.invoke('theme:image-data-url', imagePath),
  applyThemeBackground: (background: AppTheme['background']) => ipcRenderer.invoke('theme:background', background),
  getThemeHotReload: () => ipcRenderer.invoke('theme:hot-reload:get'),
  setThemeHotReload: (enabled: boolean) => ipcRenderer.invoke('theme:hot-reload:set', enabled),
  getAppPlatform: () => ipcRenderer.invoke('app:platform'),
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximizeWindow: () => ipcRenderer.invoke('window:toggle-maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  onCapture: (callback: (exchange: CapturedExchange) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, exchange: CapturedExchange): void => callback(exchange)
    ipcRenderer.on('captures:new', listener)
    return () => ipcRenderer.removeListener('captures:new', listener)
  },
  onProxyStatus: (callback: (status: ProxyStatus) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: ProxyStatus): void => callback(status)
    ipcRenderer.on('proxy:changed', listener)
    return () => ipcRenderer.removeListener('proxy:changed', listener)
  },
  onThemeChanged: (callback: (theme: AppTheme) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, theme: AppTheme): void => callback(theme)
    ipcRenderer.on('theme:changed', listener)
    return () => ipcRenderer.removeListener('theme:changed', listener)
  }
}

contextBridge.exposeInMainWorld('steal', api)
