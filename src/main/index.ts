import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, nativeImage, shell, session, Tray } from 'electron'
import { execFile } from 'node:child_process'
import { join } from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync, mkdirSync, watch, type FSWatcher } from 'node:fs'
import { ProxyService } from './proxy-service'
import { SettingsStore } from './settings-store'
import { SavedApiStore } from './storage'
import { ThemeStore } from './theme-store'
import { WorkspaceStore } from './workspace-store'
import { capturesFromHar, capturesToHar } from './har'
import { disableStealSystemProxy, enableSystemProxy, installTrustedCertificate, isCertificateTrusted, restoreSystemProxy } from './system-proxy'
import { PluginLoader } from './plugin-loader'
import { PluginAPI } from './plugin-api'
import { replayRequest } from './replay'
import { McpBridgeServer } from './mcp-bridge'
import { resolveStealBridgeFilePath } from './app-data'
import type { AppSettings, AppTheme, CaptureReplacementRule, CaptureTabsState, CapturedExchange, CertificateStatus, CollectionSettings, ProxyStatus, ReplayRequest, ReplayResult, SavedApi, WorkspaceCaptureTab } from '../shared/types'
import type { StealPlugin } from '../shared/plugin-types'

let mainWindow: BrowserWindow | undefined
let proxyService: ProxyService
let savedApiStore: SavedApiStore
let settingsStore: SettingsStore
let themeStore: ThemeStore
let workspaceStore: WorkspaceStore
let pluginLoader: PluginLoader
let certificatePromptInFlight = false
let tray: Tray | undefined
let trayProxyTransitioning = false
let quitCleanupStarted = false
let quitCleanupComplete = false
let themeHotReloadEnabled = false
let themeWatcher: FSWatcher | undefined
let themeReloadTimer: NodeJS.Timeout | undefined
let sharedCaptureSyncTimer: NodeJS.Timeout | undefined
let mcpBridgeServer: McpBridgeServer | undefined
let captureTabsState: CaptureTabsState = {
  tabs: [{ id: 'live', title: 'Live', kind: 'live', filters: { query: '', showFilterPanel: false, appBrowserOnly: false, resourceFilter: 'all', selectedDomains: [], regexQuery: '', endpointPrefixes: [], displayReplacements: [], methodFilter: 'all' } }],
  activeCaptureTabId: 'live'
}

const isDev = !!process.env.ELECTRON_RENDERER_URL

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1120,
    minHeight: 720,
    title: 'Steal',
    backgroundColor: '#f7f8fb',
    frame: process.platform === 'darwin' ? undefined : false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : undefined,
    trafficLightPosition: process.platform === 'darwin' ? { x: 16, y: 13 } : undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true
    }
  })

  if (isDev) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL!)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('Renderer failed to load', { errorCode, errorDescription, validatedURL })
  })

  mainWindow.webContents.on('console-message', (_event, details: any) => {
    console.log(`renderer[${details.level}] ${details.message} (${details.sourceId}:${details.lineNumber})`)
  })

  mainWindow.on('closed', () => {
    mainWindow = undefined
  })
}

app.whenReady().then(async () => {
  const dataDir = join(app.getPath('userData'), 'steal-data')
  mkdirSync(dataDir, { recursive: true })
  proxyService = new ProxyService(dataDir)
  await proxyService.hydrateSharedCaptures()
  savedApiStore = new SavedApiStore(join(dataDir, 'collections'))
  settingsStore = new SettingsStore(join(dataDir, 'settings.json'))
  themeStore = new ThemeStore(join(dataDir, 'theme.json'))
  workspaceStore = new WorkspaceStore(join(dataDir, 'workspaces'))
  const settings = await settingsStore.get()

  const pluginAPI = new PluginAPI(proxyService)
  pluginLoader = new PluginLoader(pluginAPI)
  await pluginLoader.loadAllPlugins()

  mcpBridgeServer = new McpBridgeServer(resolveStealBridgeFilePath(dataDir))
  registerMcpBridge()
  await mcpBridgeServer.start()
  registerIpc()
  wireProxyEvents()
  startSharedCaptureSync()
  await configureCaptureSession()
  createWindow()
  createTray()
  if (settings.autoStartProxy) await startProxyWithSystemSetup().catch(() => undefined)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', (event) => {
  if (quitCleanupComplete) return
  event.preventDefault()
  if (quitCleanupStarted) return
  quitCleanupStarted = true
  void workspaceStore.saveLastSession({
    tabs: captureTabsState.tabs,
    activeCaptureTabId: captureTabsState.activeCaptureTabId
  }).catch(() => undefined).finally(() => {
    void cleanupBeforeQuit().finally(() => {
      quitCleanupComplete = true
      app.quit()
    })
  })
})

app.on('certificate-error', (event, webContents, _url, _error, _certificate, callback) => {
  if (webContents.getType() === 'webview') {
    event.preventDefault()
    callback(true)
    return
  }
  callback(false)
})

async function configureCaptureSession(): Promise<void> {
  const captureSession = session.fromPartition('persist:capture-browser')
  await captureSession.setProxy({
    proxyRules: 'http=127.0.0.1:8899;https=127.0.0.1:8899',
    proxyBypassRules: '<local>'
  })
  captureSession.webRequest.onBeforeSendHeaders((details, callback) => {
    callback({
      requestHeaders: {
        ...details.requestHeaders,
        'x-steal-source': 'browser'
      }
    })
  })
}

function wireProxyEvents(): void {
  proxyService.on('capture', (exchange) => {
    mainWindow?.webContents.send('captures:new', exchange)
  })
  proxyService.on('captures', (captures) => {
    mainWindow?.webContents.send('captures:changed', captures)
  })
  proxyService.on('status', (status) => {
    mainWindow?.webContents.send('proxy:changed', status)
    updateTray(status)
  })
}

function startSharedCaptureSync(): void {
  clearInterval(sharedCaptureSyncTimer)
  sharedCaptureSyncTimer = setInterval(() => {
    void proxyService.syncSharedCaptures().catch((error: Error) => {
      console.error('Failed to sync shared captures', error)
    })
  }, 1200)
}

function registerIpc(): void {
  ipcMain.on('capture-tabs:sync', (_event, state: CaptureTabsState) => {
    captureTabsState = normalizeCaptureTabsState(state)
  })
  ipcMain.handle('settings:get', () => settingsStore.get())
  ipcMain.handle('settings:update', (_event, patch) => settingsStore.update(patch))
  ipcMain.handle('theme:get', () => themeStore.get())
  ipcMain.handle('theme:presets', () => themeStore.presets())
  ipcMain.handle('theme:update', (_event, theme: AppTheme) => themeStore.update(theme))
  ipcMain.handle('theme:reset', () => themeStore.reset())
  ipcMain.handle('theme:open-file', async () => {
    await themeStore.get()
    await shell.openPath(themeStore.path)
  })
  ipcMain.handle('theme:hot-reload:get', () => themeHotReloadEnabled)
  ipcMain.handle('theme:hot-reload:set', async (_event, enabled: boolean) => {
    await setThemeHotReload(enabled)
    return themeHotReloadEnabled
  })
  ipcMain.handle('clipboard:write-text', (_event, text: string) => {
    clipboard.writeText(text)
  })
  ipcMain.handle('workspaces:state', () => workspaceStore.getState())
  ipcMain.handle('workspaces:load', (_event, workspaceId: string) => workspaceStore.load(workspaceId))
  ipcMain.handle('workspaces:save', (_event, payload: { workspaceId?: string; name: string; tabs: WorkspaceCaptureTab[]; activeCaptureTabId: string }) => {
    return workspaceStore.save(payload)
  })
  ipcMain.handle('workspaces:delete', (_event, workspaceId: string) => workspaceStore.delete(workspaceId))
  ipcMain.handle('proxy:status', () => proxyService.getStatus())
  ipcMain.handle('proxy:start', () => startProxyWithSystemSetup())
  ipcMain.handle('proxy:stop', () => stopProxyWithSystemRestore())
  ipcMain.handle('system-proxy:enable', async () => {
    const status = proxyService.getStatus()
    if (status.running) await enableSystemProxy(status.host, status.port)
  })
  ipcMain.handle('system-proxy:disable', () => {
    const status = proxyService.getStatus()
    return disableStealSystemProxy(status.host, status.port)
  })
  ipcMain.handle('captures:list', () => proxyService.getCaptures())
  ipcMain.handle('captures:pause', (_event, paused: boolean) => proxyService.setCapturePaused(paused))
  ipcMain.handle('captures:clear', () => {
    proxyService.clearCaptures()
  })
  ipcMain.handle('captures:export-har', async (_event, captures: CapturedExchange[]) => {
    const exportCaptures = Array.isArray(captures) ? captures : proxyService.getCaptures()
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export captures as HAR',
      defaultPath: 'steal-captures.har',
      filters: [{ name: 'HAR', extensions: ['har', 'json'] }]
    })
    if (canceled || !filePath) return undefined
    await writeFile(filePath, JSON.stringify(capturesToHar(exportCaptures), null, 2))
    return filePath
  })
  ipcMain.handle('captures:import-har', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Import HAR',
      properties: ['openFile'],
      filters: [{ name: 'HAR', extensions: ['har', 'json'] }]
    })
    if (canceled || filePaths.length === 0) return []
    const raw = await readFile(filePaths[0], 'utf8')
    const captures = capturesFromHar(JSON.parse(raw))
    return captures
  })
  ipcMain.handle('saved:list', () => savedApiStore.list())
  ipcMain.handle('collections:list', () => savedApiStore.listCollections())
  ipcMain.handle('collections:update-settings', (_event, payload: { collectionId: string; settings: CollectionSettings }) => {
    return savedApiStore.updateCollectionSettings(payload.collectionId, payload.settings)
  })
  ipcMain.handle('saved:save', async (_event, payload: { exchangeId: string; name: string; tags: string[]; collectionName: string }) => {
    const exchange = proxyService.findCapture(payload.exchangeId)
    if (!exchange) throw new Error('Capture not found.')
    return savedApiStore.save(exchange, payload.name, payload.tags, payload.collectionName)
  })
  ipcMain.handle('saved:export', async () => {
    const saved = await savedApiStore.list()
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export saved APIs',
      defaultPath: 'steal-apis.json',
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (canceled || !filePath) return undefined
    await writeFile(filePath, JSON.stringify(saved, null, 2))
    return filePath
  })
  ipcMain.handle('saved:import', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Import saved APIs',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (canceled || filePaths.length === 0) return savedApiStore.list()
    const raw = await readFile(filePaths[0], 'utf8')
    const parsed = JSON.parse(raw) as SavedApi[] | SavedApi
    await savedApiStore.importMany(Array.isArray(parsed) ? parsed : [parsed])
    return savedApiStore.list()
  })
  ipcMain.handle('replay:send', (_event, request: ReplayRequest) => replay(request))
  ipcMain.handle('cert:open-folder', async () => {
    const status = proxyService.getStatus()
    if (existsSync(status.sslCaDir)) await shell.openPath(status.sslCaDir)
  })
  ipcMain.handle('cert:status', () => getCertificateStatus())
  ipcMain.handle('cert:install', async () => {
    const status = proxyService.getStatus()
    if (!existsSync(status.caCertPath)) throw new Error('Start the proxy once to generate the Steal CA certificate.')
    await installTrustedCertificate(status.caCertPath)
    return getCertificateStatus()
  })
  ipcMain.handle('app:platform', () => process.platform)
  ipcMain.handle('window:minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })
  ipcMain.handle('window:toggle-maximize', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return false
    if (window.isMaximized()) window.unmaximize()
    else window.maximize()
    return window.isMaximized()
  })
  ipcMain.handle('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })
  ipcMain.handle('browser:launch-chrome', (_event, url: string) => launchChromeBrowser(url))
  
  ipcMain.handle('plugins:list', () => {
    return pluginLoader.getPlugins().map(p => ({
      name: p.name,
      version: p.version,
      description: p.description,
      author: p.author,
      enabled: p.enabled ?? true
    }))
  })
  
  ipcMain.handle('plugins:enable', (_event, name: string) => {
    pluginLoader.enablePlugin(name)
  })
  
  ipcMain.handle('plugins:disable', (_event, name: string) => {
    pluginLoader.disablePlugin(name)
  })
  
  ipcMain.handle('plugins:load', async (_event, path: string) => {
    const plugin = await pluginLoader.loadPlugin(path)
    return {
      name: plugin.name,
      version: plugin.version,
      description: plugin.description,
      author: plugin.author,
      enabled: plugin.enabled ?? true
    }
  })
  
  ipcMain.handle('plugins:get-filters', () => {
    const filters: Array<{ name: string; pluginName: string }> = []
    for (const plugin of pluginLoader.getPlugins()) {
      if (!plugin.enabled || !plugin.filters) continue
      for (const filterName of Object.keys(plugin.filters)) {
        filters.push({ name: filterName, pluginName: plugin.name })
      }
    }
    return filters
  })
  
  ipcMain.handle('plugins:get-exporters', () => {
    const exporters: Array<{ name: string; pluginName: string }> = []
    for (const plugin of pluginLoader.getPlugins()) {
      if (!plugin.enabled || !plugin.exporters) continue
      for (const exporterName of Object.keys(plugin.exporters)) {
        exporters.push({ name: exporterName, pluginName: plugin.name })
      }
    }
    return exporters
  })
  
  ipcMain.handle('plugins:run-filter', (_event, pluginName: string, filterName: string, captures: CapturedExchange[]) => {
    const plugin = pluginLoader.getPlugin(pluginName)
    if (!plugin || !plugin.enabled || !plugin.filters) return captures
    const filter = plugin.filters[filterName]
    if (!filter) return captures
    return captures.filter(filter)
  })
  
  ipcMain.handle('plugins:run-export', async (_event, pluginName: string, exporterName: string, captures: CapturedExchange[]) => {
    const plugin = pluginLoader.getPlugin(pluginName)
    if (!plugin || !plugin.enabled || !plugin.exporters) throw new Error('Plugin or exporter not found')
    const exporter = plugin.exporters[exporterName]
    if (!exporter) throw new Error('Exporter not found')
    const result = exporter(captures)
    
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: `Export with ${exporterName}`,
      defaultPath: `export-${Date.now()}`,
      filters: [{ name: 'File', extensions: ['txt', 'md', 'json'] }]
    })
    if (canceled || !filePath) return undefined
    
    await writeFile(filePath, typeof result === 'string' ? result : result)
    return filePath
  })
  
  ipcMain.handle('plugins:process-request', (_event, request: ReplayRequest) => {
    let processed = request
    for (const plugin of pluginLoader.getPlugins()) {
      if (!plugin.enabled || !plugin.processors?.onRequest) continue
      processed = plugin.processors.onRequest(processed)
    }
    return processed
  })
}

function registerMcpBridge(): void {
  if (!mcpBridgeServer) return

  mcpBridgeServer.register('listCaptureTabs', () => captureTabsState)
  mcpBridgeServer.register('updateCaptureTabFilters', (params) => {
    const payload = params as {
      tabId?: string
      query?: string
      showFilterPanel?: boolean
      appBrowserOnly?: boolean
      resourceFilter?: WorkspaceCaptureTab['filters']['resourceFilter']
      selectedDomains?: string[]
      regexQuery?: string
      endpointPrefixes?: string[]
      displayReplacements?: CaptureReplacementRule[]
      methodFilter?: string
      minDurationMs?: number | null
      maxDurationMs?: number | null
      clearAll?: boolean
    } | undefined
    captureTabsState = updateCaptureTabsStateFilters(captureTabsState, payload)
    mainWindow?.webContents.send('capture-tabs:apply-state', captureTabsState)
    return captureTabsState
  })
  mcpBridgeServer.register('getProxyStatus', () => proxyService.getStatus())
  mcpBridgeServer.register('startProxy', () => startProxyWithSystemSetup())
  mcpBridgeServer.register('stopProxy', () => stopProxyWithSystemRestore())
  mcpBridgeServer.register('setCapturePaused', (params) => proxyService.setCapturePaused(Boolean((params as { paused?: boolean } | undefined)?.paused)))
  mcpBridgeServer.register('clearCaptures', () => {
    proxyService.clearCaptures()
    return { cleared: true }
  })
  mcpBridgeServer.register('listCaptures', () => proxyService.getCaptures())
  mcpBridgeServer.register('getCapture', (params) => {
    const id = String((params as { id?: string } | undefined)?.id || '')
    const capture = proxyService.findCapture(id)
    if (!capture) throw new Error(`Capture not found: ${id}`)
    return capture
  })
  mcpBridgeServer.register('getSettings', () => settingsStore.get())
  mcpBridgeServer.register('updateSettings', (params) => settingsStore.update((params as Partial<AppSettings>) || {}))
  mcpBridgeServer.register('listWorkspaces', () => workspaceStore.getState())
  mcpBridgeServer.register('loadWorkspace', (params) => {
    const workspaceId = String((params as { workspaceId?: string } | undefined)?.workspaceId || '')
    return workspaceStore.load(workspaceId)
  })
  mcpBridgeServer.register('listCollections', () => savedApiStore.listCollections())
  mcpBridgeServer.register('listSavedApis', () => savedApiStore.list())
  mcpBridgeServer.register('getSavedApi', async (params) => {
    const id = String((params as { id?: string } | undefined)?.id || '')
    const api = (await savedApiStore.list()).find((item) => item.id === id)
    if (!api) throw new Error(`Saved API not found: ${id}`)
    return api
  })
  mcpBridgeServer.register('saveCaptureToCollection', async (params) => {
    const payload = (params || {}) as { exchangeId?: string; name?: string; tags?: string[]; collectionName?: string }
    const exchangeId = String(payload.exchangeId || '')
    const capture = proxyService.findCapture(exchangeId)
    if (!capture) throw new Error(`Capture not found: ${exchangeId}`)
    return savedApiStore.save(capture, payload.name || '', payload.tags || [], payload.collectionName?.trim() || 'Default')
  })
}

function normalizeCaptureTabsState(state: CaptureTabsState): CaptureTabsState {
  const tabs = Array.isArray(state?.tabs) && state.tabs.length > 0 ? state.tabs.map((tab) => ({
    ...tab,
    filters: normalizeWorkspaceCaptureFilters(tab.filters)
  })) : captureTabsState.tabs
  const activeCaptureTabId = tabs.some((tab) => tab.id === state?.activeCaptureTabId) ? state.activeCaptureTabId : tabs[0].id
  return { tabs, activeCaptureTabId }
}

function updateCaptureTabsStateFilters(
  state: CaptureTabsState,
  patch?: {
    tabId?: string
    query?: string
    showFilterPanel?: boolean
    appBrowserOnly?: boolean
    resourceFilter?: WorkspaceCaptureTab['filters']['resourceFilter']
    selectedDomains?: string[]
    regexQuery?: string
    endpointPrefixes?: string[]
    displayReplacements?: CaptureReplacementRule[]
    methodFilter?: string
    minDurationMs?: number | null
    maxDurationMs?: number | null
    clearAll?: boolean
  }
): CaptureTabsState {
  const targetId = patch?.tabId || state.activeCaptureTabId
  return normalizeCaptureTabsState({
    ...state,
    tabs: state.tabs.map((tab) => {
      if (tab.id !== targetId) return tab
      const baseFilters = patch?.clearAll ? normalizeWorkspaceCaptureFilters() : normalizeWorkspaceCaptureFilters(tab.filters)
      return {
        ...tab,
        filters: normalizeWorkspaceCaptureFilters({
          ...baseFilters,
          ...(patch?.query !== undefined ? { query: patch.query } : {}),
          ...(patch?.showFilterPanel !== undefined ? { showFilterPanel: patch.showFilterPanel } : {}),
          ...(patch?.appBrowserOnly !== undefined ? { appBrowserOnly: patch.appBrowserOnly } : {}),
          ...(patch?.resourceFilter !== undefined ? { resourceFilter: patch.resourceFilter } : {}),
          ...(patch?.selectedDomains !== undefined ? { selectedDomains: patch.selectedDomains } : {}),
          ...(patch?.regexQuery !== undefined ? { regexQuery: patch.regexQuery } : {}),
          ...(patch?.endpointPrefixes !== undefined ? { endpointPrefixes: patch.endpointPrefixes } : {}),
          ...(patch?.displayReplacements !== undefined ? { displayReplacements: patch.displayReplacements } : {}),
          ...(patch?.methodFilter !== undefined ? { methodFilter: patch.methodFilter } : {}),
          ...(patch?.minDurationMs !== undefined ? { minDurationMs: patch.minDurationMs ?? undefined } : {}),
          ...(patch?.maxDurationMs !== undefined ? { maxDurationMs: patch.maxDurationMs ?? undefined } : {})
        })
      }
    })
  })
}

function normalizeWorkspaceCaptureFilters(filters?: Partial<WorkspaceCaptureTab['filters']>): WorkspaceCaptureTab['filters'] {
  return {
    query: filters?.query || '',
    showFilterPanel: Boolean(filters?.showFilterPanel),
    appBrowserOnly: Boolean(filters?.appBrowserOnly),
    resourceFilter: filters?.resourceFilter || 'all',
    selectedDomains: Array.isArray(filters?.selectedDomains) ? [...filters.selectedDomains] : [],
    regexQuery: filters?.regexQuery || '',
    endpointPrefixes: Array.isArray(filters?.endpointPrefixes) ? filters.endpointPrefixes.map((item) => item.trim()).filter(Boolean) : [],
    displayReplacements: normalizeCaptureReplacementRules(filters?.displayReplacements),
    methodFilter: filters?.methodFilter || 'all',
    minDurationMs: typeof filters?.minDurationMs === 'number' ? filters.minDurationMs : undefined,
    maxDurationMs: typeof filters?.maxDurationMs === 'number' ? filters.maxDurationMs : undefined
  }
}

function normalizeCaptureReplacementRules(rules?: CaptureReplacementRule[]): CaptureReplacementRule[] {
  return Array.isArray(rules)
    ? rules
      .map((rule) => ({
        match: String(rule?.match || '').trim(),
        replace: String(rule?.replace || '').trim()
      }))
      .filter((rule) => rule.match && rule.replace)
    : []
}

async function setThemeHotReload(enabled: boolean): Promise<void> {
  themeHotReloadEnabled = enabled
  themeWatcher?.close()
  themeWatcher = undefined
  if (!enabled) return

  await themeStore.get()
  themeWatcher = watch(themeStore.path, { persistent: false }, () => {
    if (themeReloadTimer) clearTimeout(themeReloadTimer)
    themeReloadTimer = setTimeout(() => {
      void themeStore.get().then((theme) => {
        mainWindow?.webContents.send('theme:changed', theme)
      }).catch((error: Error) => {
        console.error('Failed to hot reload theme', error)
      })
    }, 120)
  })
}

async function startProxyWithSystemSetup(): Promise<ProxyStatus> {
  const status = await proxyService.start()
  updateTray(status)
  const settings = await settingsStore.get()
  if (settings.systemProxyEnabled) {
    await enableSystemProxy(status.host, status.port).catch((error: Error) => {
      console.error('Failed to configure system proxy', error)
    })
  }
  await promptForCertificateInstallIfNeeded(status).catch((error: Error) => {
    console.error('Failed to install certificate', error)
  })
  const nextStatus = proxyService.getStatus()
  updateTray(nextStatus)
  return nextStatus
}

async function stopProxyWithSystemRestore(): Promise<ProxyStatus> {
  await removeSystemProxyFromSystem()

  try {
    const status = await proxyService.stop()
    updateTray(status)
    return status
  } catch (error) {
    console.error('Failed to stop proxy', error)
    const status = { ...proxyService.getStatus(), running: false, error: error instanceof Error ? error.message : String(error) }
    updateTray(status)
    return status
  }
}

async function removeSystemProxyFromSystem(): Promise<void> {
  const status = proxyService.getStatus()
  try {
    await restoreSystemProxy()
  } catch (error) {
    console.error('Failed to restore system proxy', error)
  }

  try {
    await disableStealSystemProxy(status.host, status.port)
  } catch (error) {
    console.error('Failed to disable Steal system proxy', error)
  }
}

async function cleanupBeforeQuit(): Promise<void> {
  clearInterval(sharedCaptureSyncTimer)
  await mcpBridgeServer?.stop().catch(() => undefined)
  if (!proxyService) {
    await restoreSystemProxy().catch(() => undefined)
    return
  }
  await stopProxyWithSystemRestore()
}

function createTray(): void {
  tray = new Tray(createTrayIcon())
  tray.setToolTip('Steal')
  tray.on('click', () => showMainWindow())
  updateTray(proxyService.getStatus())
}

function updateTray(status = proxyService.getStatus()): void {
  if (!tray) return
  tray.setToolTip(`Steal - ${status.running ? 'Proxy running' : 'Proxy stopped'}`)
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: status.running ? 'Stop Proxy' : 'Start Proxy',
      enabled: !trayProxyTransitioning,
      click: () => {
        void toggleProxyFromTray()
      }
    },
    { type: 'separator' },
    {
      label: mainWindow?.isVisible() ? 'Hide Window' : 'Show Window',
      click: () => {
        if (mainWindow?.isVisible()) mainWindow.hide()
        else showMainWindow()
        updateTray()
      }
    },
    {
      label: 'Open Certificate Folder',
      click: async () => {
        const current = proxyService.getStatus()
        if (existsSync(current.sslCaDir)) await shell.openPath(current.sslCaDir)
      }
    },
    { type: 'separator' },
    {
      label: 'Quit Steal',
      click: () => app.quit()
    }
  ]))
}

async function toggleProxyFromTray(): Promise<void> {
  if (trayProxyTransitioning) return
  trayProxyTransitioning = true
  updateTray()
  try {
    if (proxyService.getStatus().running) await stopProxyWithSystemRestore()
    else await startProxyWithSystemSetup()
  } finally {
    trayProxyTransitioning = false
    updateTray()
  }
}

function showMainWindow(): void {
  if (!mainWindow) {
    createWindow()
  }
  mainWindow?.show()
  mainWindow?.focus()
}

function createTrayIcon(): Electron.NativeImage {
  const svg = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">
      <rect x="2" y="3" width="14" height="12" rx="3" fill="#2457c5"/>
      <path d="M5 9h8M9 5v8" stroke="white" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `.trim())
  const image = nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${svg}`)
  if (process.platform === 'darwin') image.setTemplateImage(true)
  return image
}

async function promptForCertificateInstallIfNeeded(status: ProxyStatus): Promise<void> {
  if (!['darwin', 'win32'].includes(process.platform) || certificatePromptInFlight || !existsSync(status.caCertPath)) return
  if (await isCertificateTrusted(status.caCertPath)) return
  certificatePromptInFlight = true
  const installDetail = process.platform === 'win32'
    ? 'The certificate is not trusted yet. Install it into the current Windows user Trusted Root store?'
    : 'The certificate is not trusted yet. Install it into the macOS System keychain using administrator privileges?'
  try {
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: ['Install', 'Cancel'],
      defaultId: 0,
      cancelId: 1,
      title: 'Install Steal HTTPS Certificate',
      message: 'HTTPS capture needs the Steal local CA certificate.',
      detail: installDetail
    })
    if (result.response !== 0) return
    await installTrustedCertificate(status.caCertPath)
  } finally {
    certificatePromptInFlight = false
  }
}

async function getCertificateStatus(): Promise<CertificateStatus> {
  const status = proxyService.getStatus()
  const exists = existsSync(status.caCertPath)
  return {
    caCertPath: status.caCertPath,
    exists,
    trusted: exists ? await isCertificateTrusted(status.caCertPath) : false
  }
}

async function replay(request: ReplayRequest): Promise<ReplayResult> {
  return replayRequest(request)
}

async function launchChromeBrowser(url: string): Promise<void> {
  const profileDir = join(app.getPath('userData'), 'steal-chrome-profile')
  mkdirSync(profileDir, { recursive: true })
  const targetUrl = /^https?:\/\//i.test(url) ? url : 'https://www.google.com'
  const args = [
    '--new-window',
    `--user-data-dir=${profileDir}`,
    `--proxy-server=http=${proxyService.getStatus().host}:${proxyService.getStatus().port};https=${proxyService.getStatus().host}:${proxyService.getStatus().port}`,
    '--remote-debugging-port=9222',
    '--disable-quic',
    targetUrl
  ]

  if (process.platform === 'darwin') {
    await new Promise<void>((resolve, reject) => {
      execFile('open', ['-na', 'Google Chrome', '--args', ...args], (error) => error ? reject(error) : resolve())
    })
    return
  }

  if (process.platform === 'win32') {
    await new Promise<void>((resolve, reject) => {
      execFile('cmd', ['/c', 'start', 'chrome', ...args], (error) => error ? reject(error) : resolve())
    })
    return
  }

  await new Promise<void>((resolve, reject) => {
    execFile('google-chrome', args, (error) => error ? reject(error) : resolve())
  })
}
