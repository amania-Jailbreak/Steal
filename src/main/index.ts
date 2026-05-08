import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, shell, session, Tray } from 'electron'
import { execFile } from 'node:child_process'
import { join } from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync, mkdirSync } from 'node:fs'
import { ProxyService } from './proxy-service'
import { SettingsStore } from './settings-store'
import { SavedApiStore } from './storage'
import { disableStealSystemProxy, enableSystemProxy, installTrustedCertificate, isCertificateTrusted, restoreSystemProxy } from './system-proxy'
import { decodeBodyText } from './body-decode'
import type { CertificateStatus, ProxyStatus, ReplayRequest, ReplayResult, SavedApi } from '../shared/types'

let mainWindow: BrowserWindow | undefined
let proxyService: ProxyService
let savedApiStore: SavedApiStore
let settingsStore: SettingsStore
let certificatePromptInFlight = false
let tray: Tray | undefined
let trayProxyTransitioning = false

const isDev = !!process.env.ELECTRON_RENDERER_URL

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1120,
    minHeight: 720,
    title: 'Steal',
    backgroundColor: '#f7f8fb',
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

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log(`renderer[${level}] ${message} (${sourceId}:${line})`)
  })

  mainWindow.on('closed', () => {
    mainWindow = undefined
  })
}

app.whenReady().then(async () => {
  const dataDir = join(app.getPath('userData'), 'steal-data')
  mkdirSync(dataDir, { recursive: true })
  proxyService = new ProxyService(dataDir)
  savedApiStore = new SavedApiStore(join(dataDir, 'collections'))
  settingsStore = new SettingsStore(join(dataDir, 'settings.json'))
  const settings = await settingsStore.get()

  registerIpc()
  wireProxyEvents()
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

app.on('before-quit', () => {
  restoreSystemProxy().catch(() => undefined)
  proxyService?.stop().catch(() => undefined)
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
  proxyService.on('status', (status) => {
    mainWindow?.webContents.send('proxy:changed', status)
    updateTray(status)
  })
}

function registerIpc(): void {
  ipcMain.handle('settings:get', () => settingsStore.get())
  ipcMain.handle('settings:update', (_event, patch) => settingsStore.update(patch))
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
  ipcMain.handle('captures:clear', () => {
    proxyService.clearCaptures()
  })
  ipcMain.handle('saved:list', () => savedApiStore.list())
  ipcMain.handle('collections:list', () => savedApiStore.listCollections())
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
  ipcMain.handle('browser:launch-chrome', (_event, url: string) => launchChromeBrowser(url))
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
  try {
    await restoreSystemProxy()
  } catch (error) {
    console.error('Failed to restore system proxy', error)
  }

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
  const startedAt = performance.now()
  const headers = Object.fromEntries(Object.entries(request.headers).filter(([, value]) => value.trim() !== ''))
  const response = await fetch(request.url, {
    method: request.method,
    headers,
    body: ['GET', 'HEAD'].includes(request.method.toUpperCase()) ? undefined : request.body
  })
  const responseBuffer = Buffer.from(await response.arrayBuffer())
  const responseHeaders = Object.fromEntries(response.headers.entries())
  const body = decodeBodyText(responseBuffer, responseHeaders)
  return {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
    body,
    durationMs: Math.round(performance.now() - startedAt),
    size: responseBuffer.byteLength
  }
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
