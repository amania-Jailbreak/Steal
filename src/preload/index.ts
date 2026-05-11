import { contextBridge, ipcRenderer } from 'electron'
import type { AppApi, AppSettings, AppTheme, CaptureTabsState, CapturedExchange, CollectionSettings, ProxyStatus, ReplayRequest, WorkspaceCaptureTab } from '../shared/types'

const api: AppApi = {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings: Partial<AppSettings>) => ipcRenderer.invoke('settings:update', settings),
  getProxyStatus: () => ipcRenderer.invoke('proxy:status'),
  startProxy: () => ipcRenderer.invoke('proxy:start'),
  stopProxy: () => ipcRenderer.invoke('proxy:stop'),
  setCapturePaused: (paused: boolean) => ipcRenderer.invoke('captures:pause', paused),
  enableSystemProxy: () => ipcRenderer.invoke('system-proxy:enable'),
  disableSystemProxy: () => ipcRenderer.invoke('system-proxy:disable'),
  clearCaptures: () => ipcRenderer.invoke('captures:clear'),
  getCaptures: () => ipcRenderer.invoke('captures:list'),
  exportHar: (captures: CapturedExchange[]) => ipcRenderer.invoke('captures:export-har', captures),
  importHar: () => ipcRenderer.invoke('captures:import-har'),
  saveApi: (exchangeId: string, name: string, tags: string[], collectionName: string) =>
    ipcRenderer.invoke('saved:save', { exchangeId, name, tags, collectionName }),
  listCollections: () => ipcRenderer.invoke('collections:list'),
  updateCollectionSettings: (collectionId: string, settings: CollectionSettings) =>
    ipcRenderer.invoke('collections:update-settings', { collectionId, settings }),
  listSavedApis: () => ipcRenderer.invoke('saved:list'),
  exportSavedApis: () => ipcRenderer.invoke('saved:export'),
  importSavedApis: () => ipcRenderer.invoke('saved:import'),
  replay: (request: ReplayRequest) => ipcRenderer.invoke('replay:send', request),
  launchChrome: (url: string) => ipcRenderer.invoke('browser:launch-chrome', url),
  copyText: (text: string) => ipcRenderer.invoke('clipboard:write-text', text),
  openCertificateFolder: () => ipcRenderer.invoke('cert:open-folder'),
  getCertificateStatus: () => ipcRenderer.invoke('cert:status'),
  installCertificate: () => ipcRenderer.invoke('cert:install'),
  getTheme: () => ipcRenderer.invoke('theme:get'),
  listThemePresets: () => ipcRenderer.invoke('theme:presets'),
  updateTheme: (theme: AppTheme) => ipcRenderer.invoke('theme:update', theme),
  resetTheme: () => ipcRenderer.invoke('theme:reset'),
  openThemeFile: () => ipcRenderer.invoke('theme:open-file'),
  getThemeHotReload: () => ipcRenderer.invoke('theme:hot-reload:get'),
  setThemeHotReload: (enabled: boolean) => ipcRenderer.invoke('theme:hot-reload:set', enabled),
  getAppPlatform: () => ipcRenderer.invoke('app:platform'),
  getWorkspaceState: () => ipcRenderer.invoke('workspaces:state'),
  loadWorkspace: (workspaceId: string) => ipcRenderer.invoke('workspaces:load', workspaceId),
  saveWorkspace: (payload: { workspaceId?: string; name: string; tabs: WorkspaceCaptureTab[]; activeCaptureTabId: string }) => ipcRenderer.invoke('workspaces:save', payload),
  deleteWorkspace: (workspaceId: string) => ipcRenderer.invoke('workspaces:delete', workspaceId),
  syncCaptureTabsState: (state: CaptureTabsState) => {
    ipcRenderer.send('capture-tabs:sync', state)
  },
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximizeWindow: () => ipcRenderer.invoke('window:toggle-maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  onCapture: (callback: (exchange: CapturedExchange) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, exchange: CapturedExchange): void => callback(exchange)
    ipcRenderer.on('captures:new', listener)
    return () => ipcRenderer.removeListener('captures:new', listener)
  },
  onCapturesChanged: (callback: (captures: CapturedExchange[]) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, captures: CapturedExchange[]): void => callback(captures)
    ipcRenderer.on('captures:changed', listener)
    return () => ipcRenderer.removeListener('captures:changed', listener)
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
  },
  onCaptureTabsStateApplied: (callback: (state: CaptureTabsState) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: CaptureTabsState): void => callback(state)
    ipcRenderer.on('capture-tabs:apply-state', listener)
    return () => ipcRenderer.removeListener('capture-tabs:apply-state', listener)
  },
  
  listPlugins: () => ipcRenderer.invoke('plugins:list'),
  enablePlugin: (name: string) => ipcRenderer.invoke('plugins:enable', name),
  disablePlugin: (name: string) => ipcRenderer.invoke('plugins:disable', name),
  loadPlugin: (path: string) => ipcRenderer.invoke('plugins:load', path),
  getPluginFilters: () => ipcRenderer.invoke('plugins:get-filters'),
  getPluginExporters: () => ipcRenderer.invoke('plugins:get-exporters'),
  runPluginFilter: (pluginName: string, filterName: string, captures: CapturedExchange[]) =>
    ipcRenderer.invoke('plugins:run-filter', pluginName, filterName, captures),
  runPluginExport: (pluginName: string, exporterName: string, captures: CapturedExchange[]) =>
    ipcRenderer.invoke('plugins:run-export', pluginName, exporterName, captures),
  processRequest: (request: ReplayRequest) => ipcRenderer.invoke('plugins:process-request', request),
  
  listOpenAPISpecs: () => ipcRenderer.invoke('openapi:list'),
  importOpenAPISpec: () => ipcRenderer.invoke('openapi:import'),
  deleteOpenAPISpec: (id: string) => ipcRenderer.invoke('openapi:delete', id),
  matchOpenAPIEndpoint: (capture: CapturedExchange) => 
    ipcRenderer.invoke('openapi:match', capture),
  getOpenAPITags: (captures: CapturedExchange[]) => 
    ipcRenderer.invoke('openapi:tags', captures)
}

contextBridge.exposeInMainWorld('steal', api)
