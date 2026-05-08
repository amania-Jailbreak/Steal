export type HeaderMap = Record<string, string | string[] | undefined>

export interface CapturedExchange {
  id: string
  method: string
  url: string
  protocol: 'http' | 'https'
  host: string
  path: string
  source: 'browser' | 'proxy'
  sourceAppName?: string
  sourceProcessId?: number
  startedAt: string
  durationMs: number
  requestHeaders: HeaderMap
  requestBody: string
  requestSize: number
  responseStatusCode: number
  responseStatusMessage: string
  responseHeaders: HeaderMap
  responseBody: string
  responseSize: number
  savedName?: string
  tags?: string[]
}

export interface ProxyStatus {
  running: boolean
  host: string
  port: number
  caCertPath: string
  sslCaDir: string
  error?: string
}

export interface CertificateStatus {
  caCertPath: string
  exists: boolean
  trusted: boolean
}

export interface SavedApi {
  id: string
  name: string
  tags: string[]
  savedAt: string
  collectionId: string
  collectionName: string
  exchange: CapturedExchange
}

export interface SavedCollection {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  itemCount: number
}

export interface ReplayRequest {
  method: string
  url: string
  headers: Record<string, string>
  body: string
}

export interface ReplayResult {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  durationMs: number
  size: number
}

export type BrowserMode = 'embedded' | 'chrome'
export type AppPlatform = NodeJS.Platform
export type ThemeBackgroundMode = 'solid' | 'transparent' | 'image'

export interface AppTheme {
  name: string
  colors: {
    text: string
    textStrong: string
    textMuted: string
    appBackground: string
    surface: string
    surfaceSubtle: string
    surfaceHover: string
    border: string
    borderStrong: string
    primary: string
    primaryHover: string
    primarySoft: string
    primaryBorder: string
    success: string
    successSoft: string
    warning: string
    warningSoft: string
    danger: string
    dangerSoft: string
    codeBackground: string
    codeText: string
    overlay: string
  }
  methods: Record<string, {
    text: string
    background: string
  }>
  background: {
    mode: ThemeBackgroundMode
    opacity: number
    imagePath: string
    imageOpacity: number
    imageBrightness: number
  }
}

export interface AppSettings {
  autoStartProxy: boolean
  systemProxyEnabled: boolean
  autoShowBrowser: boolean
  browserMode: BrowserMode
}

export interface AppApi {
  getSettings: () => Promise<AppSettings>
  updateSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>
  getProxyStatus: () => Promise<ProxyStatus>
  startProxy: () => Promise<ProxyStatus>
  stopProxy: () => Promise<ProxyStatus>
  enableSystemProxy: () => Promise<void>
  disableSystemProxy: () => Promise<void>
  clearCaptures: () => Promise<void>
  getCaptures: () => Promise<CapturedExchange[]>
  saveApi: (exchangeId: string, name: string, tags: string[], collectionName: string) => Promise<SavedApi>
  listCollections: () => Promise<SavedCollection[]>
  listSavedApis: () => Promise<SavedApi[]>
  exportSavedApis: () => Promise<string | undefined>
  importSavedApis: () => Promise<SavedApi[]>
  replay: (request: ReplayRequest) => Promise<ReplayResult>
  launchChrome: (url: string) => Promise<void>
  copyText: (text: string) => Promise<void>
  openCertificateFolder: () => Promise<void>
  getCertificateStatus: () => Promise<CertificateStatus>
  installCertificate: () => Promise<CertificateStatus>
  getTheme: () => Promise<AppTheme>
  listThemePresets: () => Promise<AppTheme[]>
  updateTheme: (theme: AppTheme) => Promise<AppTheme>
  resetTheme: () => Promise<AppTheme>
  openThemeFile: () => Promise<void>
  chooseThemeImage: () => Promise<string | undefined>
  getThemeImageDataUrl: (imagePath: string) => Promise<string | undefined>
  applyThemeBackground: (background: AppTheme['background']) => Promise<void>
  getThemeHotReload: () => Promise<boolean>
  setThemeHotReload: (enabled: boolean) => Promise<boolean>
  getAppPlatform: () => Promise<AppPlatform>
  minimizeWindow: () => Promise<void>
  toggleMaximizeWindow: () => Promise<boolean>
  closeWindow: () => Promise<void>
  onCapture: (callback: (exchange: CapturedExchange) => void) => () => void
  onProxyStatus: (callback: (status: ProxyStatus) => void) => () => void
  onThemeChanged: (callback: (theme: AppTheme) => void) => () => void
}
