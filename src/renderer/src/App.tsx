import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createRoot } from 'react-dom/client'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import xml from 'highlight.js/lib/languages/xml'
import plaintext from 'highlight.js/lib/languages/plaintext'
import { Activity, ArrowLeft, ArrowRight, Check, ChevronRight, Eye, EyeOff, Folder, FolderOpen, Funnel, Library, Maximize2, Minimize2, Minus, Monitor, Pause, Play, Plus, RefreshCcw, Save, Search, Send, Settings, ShieldAlert, ShieldCheck, Trash2, X } from 'lucide-react'
import type { AppPlatform, AppSettings, AppTheme, BrowserMode, CapturedExchange, CertificateStatus, ProxyStatus, ReplayRequest, ReplayResult, SavedApi, SavedCollection, ThemeBackgroundMode } from '../../shared/types'
import './styles.css'

type AppMode = 'capture' | 'collection' | 'settings'
type DetailTab = 'headers' | 'body' | 'response'
type HeaderMode = 'table' | 'raw'
type CodeLanguage = 'json' | 'javascript' | 'xml' | 'plaintext'
type RequestEditorTab = 'query' | 'headers' | 'body'
type ResponseViewerTab = 'headers' | 'body' | 'metrics'
type SettingsCategory = 'startup' | 'browser' | 'theme'
type ResourceFilter = 'all' | 'fetch' | 'doc' | 'css' | 'js' | 'font' | 'img' | 'media' | 'manifest' | 'socket' | 'wasm' | 'other'
type KeyValueRow = { id: string; key: string; value: string; enabled: boolean }
type CaptureContextMenu = { capture: CapturedExchange; x: number; y: number }

hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('json', json)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('plaintext', plaintext)

const emptyStatus: ProxyStatus = {
  running: false,
  host: '127.0.0.1',
  port: 8899,
  caCertPath: '',
  sslCaDir: ''
}

const emptyCertificateStatus: CertificateStatus = {
  caCertPath: '',
  exists: false,
  trusted: false
}

const MIN_DETAILS_WIDTH = 300
const MAX_DETAILS_WIDTH = 760
const MIN_CENTER_WIDTH = 460
const MIN_BROWSER_HEIGHT = 220
const MIN_NETWORK_HEIGHT = 150
const resourceFilters: Array<{ id: ResourceFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'fetch', label: 'Fetch/XHR' },
  { id: 'doc', label: 'Doc' },
  { id: 'css', label: 'CSS' },
  { id: 'js', label: 'JS' },
  { id: 'font', label: 'Font' },
  { id: 'img', label: 'Img' },
  { id: 'media', label: 'Media' },
  { id: 'manifest', label: 'Manifest' },
  { id: 'socket', label: 'Socket' },
  { id: 'wasm', label: 'Wasm' },
  { id: 'other', label: 'Other' }
]
const defaultAppSettings: AppSettings = {
  autoStartProxy: true,
  systemProxyEnabled: true,
  autoShowBrowser: true,
  browserMode: 'embedded'
}

const emptyTheme: AppTheme = {
  name: '',
  colors: {
    text: '',
    textStrong: '',
    textMuted: '',
    appBackground: '',
    surface: '',
    surfaceSubtle: '',
    surfaceHover: '',
    border: '',
    borderStrong: '',
    primary: '',
    primaryHover: '',
    primarySoft: '',
    primaryBorder: '',
    success: '',
    successSoft: '',
    warning: '',
    warningSoft: '',
    danger: '',
    dangerSoft: '',
    codeBackground: '',
    codeText: '',
    overlay: ''
  },
  methods: {
    default: { text: '', background: '' },
    get: { text: '', background: '' },
    post: { text: '', background: '' },
    put: { text: '', background: '' },
    patch: { text: '', background: '' },
    delete: { text: '', background: '' },
    head: { text: '', background: '' },
    options: { text: '', background: '' }
  },
  background: {
    mode: 'solid',
    opacity: 1,
    imagePath: '',
    imageOpacity: 0.45,
    imageBrightness: 0.85
  }
}

export default function App(): JSX.Element {
  const webviewRef = useRef<Electron.WebviewTag | null>(null)
  const workspaceRef = useRef<HTMLElement | null>(null)
  const browserPaneRef = useRef<HTMLElement | null>(null)
  const [address, setAddress] = useState('https://www.google.com')
  const [browserUrl, setBrowserUrl] = useState('https://www.google.com')
  const [detailsWidth, setDetailsWidth] = useState(420)
  const [networkHeight, setNetworkHeight] = useState(270)
  const [status, setStatus] = useState<ProxyStatus>(emptyStatus)
  const [certificateStatus, setCertificateStatus] = useState<CertificateStatus>(emptyCertificateStatus)
  const [platform, setPlatform] = useState<AppPlatform>()
  const [windowMaximized, setWindowMaximized] = useState(false)
  const [captures, setCaptures] = useState<CapturedExchange[]>([])
  const [collections, setCollections] = useState<SavedCollection[]>([])
  const [savedApis, setSavedApis] = useState<SavedApi[]>([])
  const [selectedId, setSelectedId] = useState<string>()
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>()
  const [selectedSavedApiId, setSelectedSavedApiId] = useState<string>()
  const [expandedCollectionIds, setExpandedCollectionIds] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [showFilterPanel, setShowFilterPanel] = useState(false)
  const [appBrowserOnly, setAppBrowserOnly] = useState(false)
  const [resourceFilter, setResourceFilter] = useState<ResourceFilter>('all')
  const [selectedDomains, setSelectedDomains] = useState<Set<string>>(new Set())
  const [activeMode, setActiveMode] = useState<AppMode>('capture')
  const [tab, setTab] = useState<DetailTab>('headers')
  const [headerMode, setHeaderMode] = useState<HeaderMode>('table')
  const [saveTarget, setSaveTarget] = useState<CapturedExchange>()
  const [saveName, setSaveName] = useState('')
  const [saveTags, setSaveTags] = useState('')
  const [saveCollectionName, setSaveCollectionName] = useState('Default')
  const [contextMenu, setContextMenu] = useState<CaptureContextMenu>()
  const [showBrowser, setShowBrowser] = useState(true)
  const [settings, setSettings] = useState<AppSettings>(defaultAppSettings)
  const [theme, setTheme] = useState<AppTheme>(emptyTheme)
  const [themePresets, setThemePresets] = useState<AppTheme[]>([])
  const [themeSaving, setThemeSaving] = useState(false)
  const [themeHotReload, setThemeHotReload] = useState(false)
  const [settingsCategory, setSettingsCategory] = useState<SettingsCategory>('startup')
  const [testRequest, setTestRequest] = useState<ReplayRequest>({ method: 'GET', url: '', headers: {}, body: '' })
  const [testQueryRows, setTestQueryRows] = useState<KeyValueRow[]>([])
  const [testHeaderRows, setTestHeaderRows] = useState<KeyValueRow[]>([])
  const [testBodyRows, setTestBodyRows] = useState<KeyValueRow[]>([])
  const [testBodyMode, setTestBodyMode] = useState<'json' | 'raw'>('raw')
  const [requestTab, setRequestTab] = useState<RequestEditorTab>('query')
  const [responseTab, setResponseTab] = useState<ResponseViewerTab>('body')
  const [testResult, setTestResult] = useState<ReplayResult>()
  const [testError, setTestError] = useState('')
  const [isSendingTest, setIsSendingTest] = useState(false)
  const [proxyTransition, setProxyTransition] = useState<'starting' | 'stopping'>()
  const [certificateInstalling, setCertificateInstalling] = useState(false)
  const [certificateChecking, setCertificateChecking] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    void refreshAll()
    void window.steal.getAppPlatform().then(setPlatform)
    const removeCapture = window.steal.onCapture((capture) => {
      setCaptures((current) => [capture, ...current])
      setSelectedId((current) => current || capture.id)
    })
    const removeStatus = window.steal.onProxyStatus((nextStatus) => {
      setStatus(nextStatus)
      void refreshCertificateStatus()
    })
    return () => {
      removeCapture()
      removeStatus()
    }
  }, [])

  useEffect(() => {
    void window.steal.getSettings().then((nextSettings) => {
      setSettings(nextSettings)
      setShowBrowser(nextSettings.autoShowBrowser)
    })
    void window.steal.getTheme().then((nextTheme) => {
      setTheme(nextTheme)
      applyTheme(nextTheme)
    })
    void window.steal.listThemePresets().then(setThemePresets)
    void window.steal.getThemeHotReload().then(setThemeHotReload)
    const removeThemeChanged = window.steal.onThemeChanged((nextTheme) => {
      setTheme(nextTheme)
      applyTheme(nextTheme)
      setMessage(`Theme hot reloaded: ${nextTheme.name}`)
    })
    return removeThemeChanged
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.code !== 'Space' || event.repeat || isEditableTarget(event.target)) return
      event.preventDefault()
      void toggleProxy()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [proxyTransition, status.running])

  const embeddedBrowserVisible = showBrowser && settings.browserMode === 'embedded'
  const showBrowserTraffic = settings.browserMode === 'chrome' || showBrowser

  const selected = useMemo(() => {
    return captures.find((capture) => capture.id === selectedId && (showBrowserTraffic || capture.source !== 'browser'))
  }, [captures, selectedId, showBrowserTraffic])

  const filteredCaptures = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const sourceFiltered = showBrowserTraffic ? captures : captures.filter((capture) => capture.source !== 'browser')
    if (!showFilterPanel) return sourceFiltered
    return sourceFiltered.filter((capture) => {
      if (appBrowserOnly && capture.source !== 'browser') return false
      if (resourceFilter !== 'all' && classifyResource(capture) !== resourceFilter) return false
      const domain = domainFromCapture(capture)
      if (selectedDomains.size > 0 && !selectedDomains.has(domain)) return false
      return !needle || captureMatchesQuery(capture, needle)
    })
  }, [appBrowserOnly, captures, query, resourceFilter, selectedDomains, showBrowserTraffic, showFilterPanel])

  const availableDomains = useMemo(() => {
    const counts = new Map<string, number>()
    const sourceFiltered = showBrowserTraffic ? captures : captures.filter((capture) => capture.source !== 'browser')
    for (const capture of sourceFiltered) {
      const domain = domainFromCapture(capture)
      counts.set(domain, (counts.get(domain) || 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([domain, count]) => ({ domain, count }))
      .sort((left, right) => left.domain.localeCompare(right.domain))
  }, [captures, showBrowserTraffic])

  const selectedCollection = useMemo(() => {
    return collections.find((collection) => collection.id === selectedCollectionId) || collections[0]
  }, [collections, selectedCollectionId])

  const filteredSavedApis = useMemo(() => {
    if (!selectedCollection) return []
    return savedApis.filter((api) => api.collectionId === selectedCollection.id)
  }, [savedApis, selectedCollection])

  const selectedSavedApi = useMemo(() => {
    return savedApis.find((api) => api.id === selectedSavedApiId) || filteredSavedApis[0]
  }, [filteredSavedApis, savedApis, selectedSavedApiId])

  useEffect(() => {
    if (!selectedCollectionId && collections.length > 0) {
      setSelectedCollectionId(collections[0].id)
      setExpandedCollectionIds((current) => new Set([...current, collections[0].id]))
    }
  }, [collections, selectedCollectionId])

  useEffect(() => {
    if (selected) return
    setSelectedId(filteredCaptures[0]?.id)
  }, [filteredCaptures, selected])

  useEffect(() => {
    if (!selectedSavedApi) return
    const headers = compactEditableHeaders(selectedSavedApi.exchange.requestHeaders)
    const parsedUrl = splitUrlForEditing(selectedSavedApi.exchange.url)
    setTestRequest({
      method: selectedSavedApi.exchange.method,
      url: parsedUrl.baseUrl,
      headers,
      body: selectedSavedApi.exchange.requestBody.startsWith('[binary body:') ? '' : selectedSavedApi.exchange.requestBody
    })
    setTestQueryRows(parsedUrl.queryRows)
    setTestHeaderRows(objectToRows(headers))
    const body = selectedSavedApi.exchange.requestBody.startsWith('[binary body:') ? '' : selectedSavedApi.exchange.requestBody
    const bodyState = bodyToRows(body)
    setTestBodyRows(bodyState.rows)
    setTestBodyMode(bodyState.mode)
    setTestResult(undefined)
    setTestError('')
  }, [selectedSavedApi])

  async function refreshAll(): Promise<void> {
    const [nextStatus, nextCaptures, nextCollections, nextSavedApis, nextCertificateStatus] = await Promise.all([
      window.steal.getProxyStatus(),
      window.steal.getCaptures(),
      window.steal.listCollections(),
      window.steal.listSavedApis(),
      window.steal.getCertificateStatus()
    ])
    setStatus(nextStatus)
    setCaptures(nextCaptures)
    setCollections(nextCollections)
    setSavedApis(nextSavedApis)
    setCertificateStatus(nextCertificateStatus)
    setSelectedId((current) => current || nextCaptures.find((capture) => showBrowserTraffic || capture.source !== 'browser')?.id)
  }

  async function refreshCertificateStatus(): Promise<void> {
    setCertificateChecking(true)
    try {
      setCertificateStatus(await window.steal.getCertificateStatus())
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setCertificateChecking(false)
    }
  }

  function navigate(): void {
    const url = normalizeAddress(address)
    setAddress(url)
    setBrowserUrl(url)
    webviewRef.current?.loadURL(url)
  }

  async function toggleProxy(): Promise<void> {
    if (proxyTransition) return
    const transition = status.running ? 'stopping' : 'starting'
    setProxyTransition(transition)
    try {
      const next = transition === 'stopping' ? await window.steal.stopProxy() : await window.steal.startProxy()
      setStatus(next)
      await refreshCertificateStatus()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setProxyTransition(undefined)
    }
  }

  async function clearCaptures(): Promise<void> {
    await window.steal.clearCaptures()
    setCaptures([])
    setSelectedId(undefined)
  }

  async function updateAppSettings(patch: Partial<AppSettings>): Promise<void> {
    const nextSettings = await window.steal.updateSettings(patch)
    setSettings(nextSettings)
    if (patch.autoShowBrowser !== undefined) setShowBrowser(nextSettings.autoShowBrowser)
  }

  async function toggleSystemProxy(): Promise<void> {
    const nextEnabled = !settings.systemProxyEnabled
    const nextSettings = await window.steal.updateSettings({ systemProxyEnabled: nextEnabled })
    setSettings(nextSettings)
    if (nextEnabled) await window.steal.enableSystemProxy()
    else await window.steal.disableSystemProxy()
  }

  async function launchChrome(): Promise<void> {
    await window.steal.launchChrome(address)
    setMessage('Chrome launched with Steal proxy.')
  }

  async function saveTheme(nextTheme: AppTheme): Promise<void> {
    setThemeSaving(true)
    try {
      const savedTheme = await window.steal.updateTheme(nextTheme)
      setTheme(savedTheme)
      applyTheme(savedTheme)
      setMessage(`Theme saved: ${savedTheme.name}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setThemeSaving(false)
    }
  }

  async function updateThemeBackground(patch: Partial<AppTheme['background']>): Promise<void> {
    await saveTheme({ ...theme, background: { ...theme.background, ...patch } })
  }

  async function selectBackgroundMode(mode: ThemeBackgroundMode): Promise<void> {
    const patch: Partial<AppTheme['background']> = { mode }
    if (mode === 'transparent') patch.opacity = 0
    if (mode === 'solid' && theme.background.opacity < 1) patch.opacity = 1
    await updateThemeBackground(patch)
  }

  async function chooseBackgroundImage(): Promise<void> {
    const imagePath = await window.steal.chooseThemeImage()
    if (!imagePath) return
    await updateThemeBackground({ mode: 'image', imagePath })
  }

  async function resetTheme(): Promise<void> {
    setThemeSaving(true)
    setThemeError('')
    try {
      const nextTheme = await window.steal.resetTheme()
      setTheme(nextTheme)
      applyTheme(nextTheme)
      setMessage('Theme reset.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setThemeSaving(false)
    }
  }

  async function toggleThemeHotReload(checked: boolean): Promise<void> {
    const enabled = await window.steal.setThemeHotReload(checked)
    setThemeHotReload(enabled)
    setMessage(enabled ? 'Theme hot reload enabled.' : 'Theme hot reload disabled.')
  }

  async function installCertificate(): Promise<void> {
    setCertificateInstalling(true)
    setMessage('')
    try {
      const nextCertificateStatus = await window.steal.installCertificate()
      setCertificateStatus(nextCertificateStatus)
      setMessage(nextCertificateStatus.trusted ? 'Certificate installed.' : 'Certificate install finished, but trust was not detected yet.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setCertificateInstalling(false)
    }
  }

  function handleBrowserButton(): void {
    if (settings.browserMode === 'chrome') {
      void launchChrome()
      return
    }
    setShowBrowser((current) => !current)
  }

  function toggleCollection(collectionId: string): void {
    setExpandedCollectionIds((current) => {
      const next = new Set(current)
      if (next.has(collectionId)) next.delete(collectionId)
      else next.add(collectionId)
      return next
    })
  }

  function toggleDomain(domain: string): void {
    setSelectedDomains((current) => {
      const next = new Set(current)
      if (next.has(domain)) next.delete(domain)
      else next.add(domain)
      return next
    })
  }

  function clearFilters(): void {
    setQuery('')
    setAppBrowserOnly(false)
    setResourceFilter('all')
    setSelectedDomains(new Set())
  }

  function openSavePopup(capture: CapturedExchange): void {
    setSelectedId(capture.id)
    setSaveTarget(capture)
    setSaveName(capture.savedName || `${capture.method} ${safePath(capture.url)}`)
    setSaveTags(capture.tags?.join(', ') || '')
    setSaveCollectionName(collections[0]?.name || 'Default')
  }

  async function copyCaptureUrl(capture: CapturedExchange): Promise<void> {
    await window.steal.copyText(capture.url)
    setMessage('Copied URL')
  }

  async function copyCaptureAsCurl(capture: CapturedExchange): Promise<void> {
    await window.steal.copyText(captureToCurl(capture))
    setMessage('Copied as cURL')
  }

  async function saveCapturedApi(): Promise<void> {
    if (!saveTarget) return
    const saved = await window.steal.saveApi(saveTarget.id, saveName, splitTags(saveTags), saveCollectionName)
    const [nextCollections, nextSavedApis] = await Promise.all([
      window.steal.listCollections(),
      window.steal.listSavedApis()
    ])
    setCollections(nextCollections)
    setSavedApis(nextSavedApis)
    setSelectedCollectionId(saved.collectionId)
    setSelectedSavedApiId(saved.id)
    setExpandedCollectionIds((current) => new Set([...current, saved.collectionId]))
    setMessage(`Saved ${saved.name} to ${saved.collectionName}`)
    setSaveTarget(undefined)
  }

  async function sendCollectionTest(): Promise<void> {
    setIsSendingTest(true)
    setTestError('')
    setTestResult(undefined)
    try {
      const result = await window.steal.replay({
        ...testRequest,
        url: buildUrlWithQueryRows(testRequest.url, testQueryRows),
        headers: rowsToObject(testHeaderRows),
        body: rowsToBody(testBodyRows, testBodyMode)
      })
      setTestResult(result)
    } catch (error) {
      setTestError(error instanceof Error ? error.message : String(error))
    } finally {
      setIsSendingTest(false)
    }
  }

  function startDetailsResize(event: ReactPointerEvent<HTMLDivElement>): void {
    const rect = workspaceRef.current?.getBoundingClientRect()
    if (!rect) return
    startDocumentDrag('col-resize', (pointerEvent) => {
      const maxWidth = Math.min(MAX_DETAILS_WIDTH, rect.width - MIN_CENTER_WIDTH - 6)
      setDetailsWidth(clamp(rect.right - pointerEvent.clientX, MIN_DETAILS_WIDTH, maxWidth))
    })
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function startNetworkResize(event: ReactPointerEvent<HTMLDivElement>): void {
    const rect = browserPaneRef.current?.getBoundingClientRect()
    if (!rect) return
    startDocumentDrag('row-resize', (pointerEvent) => {
      setNetworkHeight(clamp(rect.bottom - pointerEvent.clientY, MIN_NETWORK_HEIGHT, rect.height - MIN_BROWSER_HEIGHT - 6))
    })
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  return (
    <div className={`app-window platform-${platform || 'loading'} background-${theme.background.mode}`}>
      <div className="app-background" aria-hidden="true" />
      <header className="window-titlebar">
        <div className="window-drag-region">
          <div className="window-brand">
            <strong>Steal</strong>
            <span
              className={status.running ? 'window-status-dot running' : 'window-status-dot stopped'}
              title={status.running ? 'Proxy running' : 'Proxy stopped'}
              aria-label={status.running ? 'Proxy running' : 'Proxy stopped'}
            />
          </div>
        </div>
        {platform && platform !== 'darwin' && (
          <div className="window-controls">
            <button title="Minimize" aria-label="Minimize" onClick={() => void window.steal.minimizeWindow()}>
              <Minus size={15} />
            </button>
            <button
              title={windowMaximized ? 'Restore' : 'Maximize'}
              aria-label={windowMaximized ? 'Restore' : 'Maximize'}
              onClick={() => void window.steal.toggleMaximizeWindow().then(setWindowMaximized)}
            >
              {windowMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
            <button className="close" title="Close" aria-label="Close" onClick={() => void window.steal.closeWindow()}>
              <X size={16} />
            </button>
          </div>
        )}
      </header>
      <main className="app-shell">
      <nav className="mode-rail" aria-label="Mode navigation">
        <button
          className={activeMode === 'capture' ? 'active' : ''}
          title="Capture"
          aria-label="Capture"
          onClick={() => setActiveMode('capture')}
        >
          <Activity size={19} />
        </button>
        <button
          className={activeMode === 'collection' ? 'active' : ''}
          title="API Collection"
          aria-label="API Collection"
          onClick={() => setActiveMode('collection')}
        >
          <Library size={19} />
        </button>
        <button
          className={activeMode === 'settings' ? 'active' : ''}
          title="Setting"
          aria-label="Setting"
          onClick={() => setActiveMode('settings')}
        >
          <Settings size={19} />
        </button>
      </nav>

      <header className="topbar">
        <div className="topbar-summary">
          <strong>{modeTitle(activeMode)}</strong>
          <span>{modeSummary(activeMode, filteredCaptures.length, captures.length, collections.length, savedApis.length)}</span>
          {activeMode === 'capture' && (
            <em className={showFilterPanel && (query || selectedDomains.size > 0 || appBrowserOnly || resourceFilter !== 'all') ? 'summary-chip active' : 'summary-chip'}>
              {showFilterPanel ? 'Filter ON' : 'Filter OFF'}
            </em>
          )}
        </div>
        <div className="topbar-actions">
          <button
            className={status.running ? 'proxy-pill running' : 'proxy-pill'}
            onClick={toggleProxy}
            disabled={!!proxyTransition}
          >
            {proxyTransition ? <span className="spinner" aria-hidden="true" /> : status.running ? <Pause size={15} /> : <Play size={15} />}
            {proxyTransition === 'starting' ? 'Starting...' : proxyTransition === 'stopping' ? 'Stopping...' : `${status.host}:${status.port}`}
          </button>
          <button
            className={settings.systemProxyEnabled ? 'system-proxy-toggle active' : 'system-proxy-toggle'}
            title={settings.systemProxyEnabled ? 'Disable system proxy' : 'Enable system proxy'}
            onClick={() => void toggleSystemProxy()}
          >
            System {settings.systemProxyEnabled ? 'ON' : 'OFF'}
          </button>
          <button title="Open certificate folder" onClick={() => window.steal.openCertificateFolder()}>
            <FolderOpen size={16} />
          </button>
        </div>
      </header>

      {activeMode === 'capture' && (
        <section
          ref={workspaceRef}
          className="workspace"
          style={{
            gridTemplateColumns: `minmax(${MIN_CENTER_WIDTH}px, 1fr) 6px ${detailsWidth}px`
          }}
        >
          <section
            ref={browserPaneRef}
            className="browser-pane"
            style={{
              gridTemplateRows: embeddedBrowserVisible ? `42px minmax(${MIN_BROWSER_HEIGHT}px, 1fr) 6px ${networkHeight}px` : 'minmax(0, 1fr)'
            }}
          >
            {embeddedBrowserVisible && (
              <>
                <div className="browser-toolbar">
                  <div className="traffic-controls">
                    <button title="Back" onClick={() => webviewRef.current?.goBack()}><ArrowLeft size={17} /></button>
                    <button title="Forward" onClick={() => webviewRef.current?.goForward()}><ArrowRight size={17} /></button>
                    <button title="Reload" onClick={() => webviewRef.current?.reload()}><RefreshCcw size={16} /></button>
                  </div>
                  <form className="address-bar" onSubmit={(event) => { event.preventDefault(); navigate() }}>
                    <input value={address} onChange={(event) => setAddress(event.target.value)} aria-label="URL" />
                    <button title="Open URL"><Search size={16} /></button>
                  </form>
                </div>
                <webview
                  ref={webviewRef}
                  className="capture-webview"
                  src={browserUrl}
                  partition="persist:capture-browser"
                />
                <div
                  className="pane-resizer horizontal"
                  role="separator"
                  aria-orientation="horizontal"
                  title="Resize captured traffic pane"
                  onPointerDown={startNetworkResize}
                />
              </>
            )}
            <div className="network-panel">
              <div className="pane-heading">
                <span>Captured Traffic</span>
                <div className="inline-actions">
                  <button
                    className={embeddedBrowserVisible || settings.browserMode === 'chrome' ? 'browser-toggle active' : 'browser-toggle'}
                    title={settings.browserMode === 'chrome' ? 'Open Chrome' : embeddedBrowserVisible ? 'Hide browser and browser traffic' : 'Show browser and browser traffic'}
                    onClick={handleBrowserButton}
                  >
                    {settings.browserMode === 'chrome' ? <Eye size={15} /> : embeddedBrowserVisible ? <Eye size={15} /> : <EyeOff size={15} />}
                    {settings.browserMode === 'chrome' ? 'Chrome' : 'Browser'}
                  </button>
                  <button
                    className={showFilterPanel ? 'filter-toggle active' : 'filter-toggle'}
                    title="Filters"
                    onClick={() => setShowFilterPanel((current) => !current)}
                  >
                    <Funnel size={15} />
                  </button>
                  <button title="Clear captures" onClick={clearCaptures}><Trash2 size={15} /></button>
                </div>
              </div>
              <div className={showFilterPanel ? 'network-content with-filters' : 'network-content'}>
                {showFilterPanel && (
                  <aside className="filter-panel">
                    <div className="filter-panel-section">
                      <div className="filter-panel-heading">
                        <span>Search</span>
                        <div className="filter-heading-actions">
                          <button
                            className={appBrowserOnly ? 'source-icon-filter active' : 'source-icon-filter'}
                            title={`App Browser only (${captures.filter((capture) => capture.source === 'browser').length})`}
                            onClick={() => setAppBrowserOnly((current) => !current)}
                          >
                            <Monitor size={14} />
                          </button>
                          {(query || selectedDomains.size > 0 || appBrowserOnly || resourceFilter !== 'all') && <button title="Clear filters" onClick={clearFilters}><X size={14} /></button>}
                        </div>
                      </div>
                      <label className="filter-search">
                        <Search size={14} />
                        <input
                          value={query}
                          placeholder="URL, headers, body, response"
                          onChange={(event) => setQuery(event.target.value)}
                        />
                      </label>
                    </div>
                    <div className="filter-panel-section">
                      <div className="resource-filter-list">
                        {resourceFilters.map((item) => (
                          <button
                            key={item.id}
                            className={resourceFilter === item.id ? 'resource-filter active' : 'resource-filter'}
                            onClick={() => setResourceFilter(item.id)}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="filter-panel-section domain-section">
                      <div className="filter-panel-heading">
                        <span>Domains</span>
                        <strong>{availableDomains.length}</strong>
                      </div>
                      <div className="domain-list">
                        {availableDomains.map(({ domain, count }) => (
                          <button
                            key={domain}
                            className={selectedDomains.has(domain) ? 'domain-filter active' : 'domain-filter'}
                            onClick={() => toggleDomain(domain)}
                          >
                            <span>{domain}</span>
                            <strong>{count}</strong>
                          </button>
                        ))}
                        {availableDomains.length === 0 && <div className="empty-state compact">No domains yet.</div>}
                      </div>
                    </div>
                  </aside>
                )}
                <div className="capture-table">
                  {filteredCaptures.map((capture) => (
                    <button
                      key={capture.id}
                      className={selectedId === capture.id ? 'capture-row active' : 'capture-row'}
                      onClick={() => setSelectedId(capture.id)}
                      onContextMenu={(event) => {
                        event.preventDefault()
                        setSelectedId(capture.id)
                        setContextMenu({ capture, x: event.clientX, y: event.clientY })
                      }}
                    >
                      <span className={`method ${capture.method.toLowerCase()}`}>{capture.method}</span>
                      <span className="url-cell">{capture.url}</span>
                      <span>{capture.responseStatusCode || '-'}</span>
                      <span>{capture.durationMs}ms</span>
                      <span>{formatBytes(capture.responseSize)}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <div
            className="pane-resizer vertical"
            role="separator"
            aria-orientation="vertical"
            title="Resize details pane"
            onPointerDown={startDetailsResize}
          />

          <aside className="details">
            {selected ? (
              <>
                <div className="detail-title">
                  <span className={`method ${selected.method.toLowerCase()}`}>{selected.method}</span>
                  <strong>{selected.url}</strong>
                </div>
                <div className="tabs">
                  {(['headers', 'body', 'response'] as DetailTab[]).map((item) => (
                    <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item}</button>
                  ))}
                </div>
                {tab === 'headers' && (
                  <HeadersPanel
                    exchange={selected}
                    mode={headerMode}
                    onModeChange={setHeaderMode}
                  />
                )}
                {tab === 'body' && <CodeBlock value={selected.requestBody || '(empty request body)'} language={languageFromBody(selected.requestBody, selected.requestHeaders['content-type'])} />}
                {tab === 'response' && <CodeBlock value={selected.responseBody || '(empty response body)'} language={languageFromBody(selected.responseBody, selected.responseHeaders['content-type'])} />}
              </>
            ) : (
              <div className="empty-state">Open a URL or configure another app to use the local proxy.</div>
            )}
          </aside>
        </section>
      )}

      {activeMode === 'collection' && (
        <section className="collection-view">
          <aside className="collection-sidebar">
            <div className="pane-heading">
              <span>Collections</span>
              <strong>{collections.length}</strong>
            </div>
            <div className="collection-list">
              {collections.length > 0 ? collections.map((collection) => (
                <div className="collection-tree-group" key={collection.id}>
                  <button
                    className={selectedCollection?.id === collection.id ? 'collection-item active' : 'collection-item'}
                    onClick={() => {
                      setSelectedCollectionId(collection.id)
                      toggleCollection(collection.id)
                    }}
                  >
                    <ChevronRight className={expandedCollectionIds.has(collection.id) ? 'tree-chevron open' : 'tree-chevron'} size={15} />
                    {expandedCollectionIds.has(collection.id) ? <FolderOpen size={15} /> : <Folder size={15} />}
                    <strong>{collection.name}</strong>
                    <span>{collection.itemCount}</span>
                  </button>
                  {expandedCollectionIds.has(collection.id) && (
                    <div className="collection-tree-apis">
                      {savedApis.filter((api) => api.collectionId === collection.id).map((api) => (
                        <button
                          key={api.id}
                          className={selectedSavedApi?.id === api.id ? 'tree-api-item active' : 'tree-api-item'}
                          onClick={() => {
                            setSelectedCollectionId(collection.id)
                            setSelectedSavedApiId(api.id)
                          }}
                        >
                          <span className={`method ${api.exchange.method.toLowerCase()}`}>{api.exchange.method}</span>
                          <strong>{api.name}</strong>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )) : (
                <div className="empty-state compact">No collections yet.</div>
              )}
            </div>
          </aside>

          <aside className="details collection-details">
            {selectedSavedApi ? (
              <>
                <div className="detail-title">
                  <span className={`method ${selectedSavedApi.exchange.method.toLowerCase()}`}>{selectedSavedApi.exchange.method}</span>
                  <strong>{selectedSavedApi.name}</strong>
                </div>
                <div className="collection-meta">
                  <span>{selectedSavedApi.collectionName}</span>
                  <span>{selectedSavedApi.exchange.url}</span>
                </div>
                <div className="test-panel">
                  <div className="test-request-line">
                    <select value={testRequest.method} onChange={(event) => setTestRequest({ ...testRequest, method: event.target.value })}>
                      {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'].map((method) => <option key={method}>{method}</option>)}
                    </select>
                    <input value={testRequest.url} onChange={(event) => setTestRequest({ ...testRequest, url: event.target.value })} />
                    <button className="primary-action" onClick={sendCollectionTest} disabled={isSendingTest}>
                      <Send size={16} /> {isSendingTest ? 'Sending' : 'Send'}
                    </button>
                  </div>
                  <div className="test-split">
                    <section className="request-editor">
                      <div className="test-tabs">
                        <button className={requestTab === 'query' ? 'active' : ''} onClick={() => setRequestTab('query')}>Query({enabledCount(testQueryRows)})</button>
                        <button className={requestTab === 'headers' ? 'active' : ''} onClick={() => setRequestTab('headers')}>Headers({enabledCount(testHeaderRows)})</button>
                        <button className={requestTab === 'body' ? 'active' : ''} onClick={() => setRequestTab('body')}>Body</button>
                      </div>
                      {requestTab === 'query' && (
                        <KeyValueEditor title="Query Parameters" rows={testQueryRows} keyPlaceholder="Key" valuePlaceholder="Value" onChange={setTestQueryRows} />
                      )}
                      {requestTab === 'headers' && (
                        <KeyValueEditor title="Headers" rows={testHeaderRows} keyPlaceholder="Header" valuePlaceholder="Value" onChange={setTestHeaderRows} />
                      )}
                      {requestTab === 'body' && (
                        <KeyValueEditor
                          title={testBodyMode === 'json' ? 'Body JSON' : 'Body'}
                          rows={testBodyRows}
                          keyPlaceholder={testBodyMode === 'json' ? 'Key' : 'Name'}
                          valuePlaceholder="Value"
                          onChange={setTestBodyRows}
                        />
                      )}
                    </section>
                    <section className="test-response">
                      <div className="test-tabs response-tabs">
                        <button className={responseTab === 'headers' ? 'active' : ''} onClick={() => setResponseTab('headers')}>Headers</button>
                        <button className={responseTab === 'body' ? 'active' : ''} onClick={() => setResponseTab('body')}>Body</button>
                        <button className={responseTab === 'metrics' ? 'active' : ''} onClick={() => setResponseTab('metrics')}>Metrics</button>
                        <strong>{testResult ? `${testResult.status}` : '-'}</strong>
                      </div>
                      {testError && <div className="test-error">{testError}</div>}
                      {testResult ? (
                        <>
                          {responseTab === 'headers' && <HeadersTable headers={testResult.headers} />}
                          {responseTab === 'body' && <CodeBlock value={testResult.body || '(empty response body)'} language={languageFromBody(testResult.body, testResult.headers['content-type'])} />}
                          {responseTab === 'metrics' && <MetricsPanel result={testResult} />}
                        </>
                      ) : (
                        <div className="empty-state compact">Send the request to inspect the latest response.</div>
                      )}
                    </section>
                  </div>
                </div>
              </>
            ) : (
              <div className="empty-state">Select a saved API.</div>
            )}
          </aside>
        </section>
      )}

      {contextMenu && (
        <div className="context-menu-backdrop" onMouseDown={() => setContextMenu(undefined)}>
          <div
            className="capture-context-menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              onClick={() => {
                openSavePopup(contextMenu.capture)
                setContextMenu(undefined)
              }}
            >
              保存
            </button>
            <button
              onClick={() => {
                void copyCaptureAsCurl(contextMenu.capture)
                setContextMenu(undefined)
              }}
            >
              curlとしてコピー
            </button>
            <button
              onClick={() => {
                void copyCaptureUrl(contextMenu.capture)
                setContextMenu(undefined)
              }}
            >
              URLをコピー
            </button>
          </div>
        </div>
      )}

      {activeMode === 'settings' && (
        <section className="settings-view">
          <aside className="settings-sidebar">
            <div className="pane-heading">
              <span>Settings</span>
            </div>
            <button className={settingsCategory === 'startup' ? 'settings-category active' : 'settings-category'} onClick={() => setSettingsCategory('startup')}>
              <strong>Startup</strong>
            </button>
            <button className={settingsCategory === 'browser' ? 'settings-category active' : 'settings-category'} onClick={() => setSettingsCategory('browser')}>
              <strong>Browser</strong>
            </button>
            <button className={settingsCategory === 'theme' ? 'settings-category active' : 'settings-category'} onClick={() => setSettingsCategory('theme')}>
              <strong>Theme</strong>
            </button>
          </aside>

          <section className="settings-page">
            {settingsCategory === 'startup' && (
              <>
                <div className="settings-page-title">
                  <strong>Startup</strong>
                  <span>Choose what Steal turns on when the app opens.</span>
                </div>
                <SettingToggle
                  title="Start proxy on launch"
                  description="Automatically starts the local proxy and applies the system proxy setting when Steal launches."
                  checked={settings.autoStartProxy}
                  onChange={(checked) => void updateAppSettings({ autoStartProxy: checked })}
                />
                <SettingToggle
                  title="Use system proxy"
                  description="When enabled, Steal writes the macOS/Windows system HTTP and HTTPS proxy to the local proxy while it is running."
                  checked={settings.systemProxyEnabled}
                  onChange={(checked) => {
                    void updateAppSettings({ systemProxyEnabled: checked }).then(async () => {
                      if (checked) await window.steal.enableSystemProxy()
                      else await window.steal.disableSystemProxy()
                    })
                  }}
                />
                <div className="setting-card certificate-card">
                  <div>
                    <strong>HTTPS certificate</strong>
                    <span>Install the Steal local CA so HTTPS clients trust captured traffic.</span>
                    <code>{certificateStatus.caCertPath || status.caCertPath || 'Certificate has not been generated yet.'}</code>
                  </div>
                  <div className="certificate-actions">
                    <span className={certificateStatus.trusted ? 'certificate-indicator trusted' : certificateStatus.exists ? 'certificate-indicator warning' : 'certificate-indicator missing'}>
                      {certificateStatus.trusted ? <ShieldCheck size={15} /> : <ShieldAlert size={15} />}
                      {certificateChecking ? 'Checking...' : certificateStatus.trusted ? 'Installed' : certificateStatus.exists ? 'Not installed' : 'Not generated'}
                    </span>
                    <button
                      className="primary-action"
                      disabled={certificateInstalling || !certificateStatus.exists}
                      onClick={() => void installCertificate()}
                    >
                      {certificateInstalling ? <span className="spinner" aria-hidden="true" /> : <ShieldCheck size={16} />}
                      {certificateInstalling ? 'Installing...' : 'Install certificate'}
                    </button>
                    <button title="Refresh certificate status" onClick={() => void refreshCertificateStatus()}>
                      <RefreshCcw size={16} />
                    </button>
                    <button title="Open certificate folder" onClick={() => window.steal.openCertificateFolder()}>
                      <FolderOpen size={16} />
                    </button>
                  </div>
                </div>
                <SettingToggle
                  title="Show browser on launch"
                  description="Automatically opens the browser pane when Steal launches."
                  checked={settings.autoShowBrowser}
                  onChange={(checked) => void updateAppSettings({ autoShowBrowser: checked })}
                />
              </>
            )}
            {settingsCategory === 'browser' && (
              <>
                <div className="settings-page-title">
                  <strong>Browser</strong>
                  <span>Select the browser surface used from the Capture view.</span>
                </div>
                <div className="setting-card">
                  <div>
                    <strong>Browser mode</strong>
                    <span>Embedded stays inside Steal. Chrome launches a dedicated automation-style Chrome profile.</span>
                  </div>
                  <div className="mode-choice">
                    {(['embedded', 'chrome'] as BrowserMode[]).map((mode) => (
                      <button
                        key={mode}
                        className={settings.browserMode === mode ? 'active' : ''}
                        onClick={() => void updateAppSettings({ browserMode: mode })}
                      >
                        {mode === 'embedded' ? '内蔵' : 'Chrome'}
                      </button>
                    ))}
                  </div>
                </div>
                {settings.browserMode === 'chrome' && (
                  <div className="setting-card">
                    <div>
                      <strong>Chrome launcher</strong>
                      <span>Opens Chrome with a Steal-specific user data directory, proxy, and remote debugging port 9222.</span>
                    </div>
                    <button className="primary-action" onClick={launchChrome}>Open Chrome</button>
                  </div>
                )}
              </>
            )}
            {settingsCategory === 'theme' && (
              <>
                <div className="settings-page-title">
                  <strong>Theme</strong>
                  <span>Choose a preset or edit theme.json externally with optional hot reload.</span>
                </div>
                <div className="setting-card theme-editor-card">
                  <div>
                    <strong>{theme.name || 'Theme'}</strong>
                    <span>Open theme.json for manual edits. Hot reload applies valid JSON changes as soon as the file is saved.</span>
                  </div>
                  <div className="theme-editor-actions">
                    <button onClick={() => void window.steal.openThemeFile()}>Open JSON</button>
                    <button onClick={() => void resetTheme()} disabled={themeSaving}>Reset</button>
                    <button className={themeHotReload ? 'system-proxy-toggle active' : 'system-proxy-toggle'} onClick={() => void toggleThemeHotReload(!themeHotReload)}>
                      Hot Reload {themeHotReload ? 'ON' : 'OFF'}
                    </button>
                  </div>
                </div>
                <div className="theme-preset-grid">
                  {themePresets.map((preset) => (
                    <button
                      key={preset.name}
                      className={theme.name === preset.name ? 'theme-preset active' : 'theme-preset'}
                      onClick={() => void saveTheme(preset)}
                    >
                      <span className="theme-preset-swatches" aria-hidden="true">
                        <i style={{ background: preset.colors.appBackground }} />
                        <i style={{ background: preset.colors.surface }} />
                        <i style={{ background: preset.colors.primary }} />
                        <i style={{ background: preset.colors.danger }} />
                      </span>
                      <strong>{preset.name}</strong>
                    </button>
                  ))}
                </div>
                <div className="setting-card background-card">
                  <div>
                    <strong>Custom background</strong>
                    <span>Choose a solid, transparent, or image background. Values are saved in theme.json.</span>
                  </div>
                  <div className="background-controls">
                    <div className="mode-choice">
                      {(['solid', 'transparent', 'image'] as const).map((mode) => (
                        <button
                          key={mode}
                          className={theme.background.mode === mode ? 'active' : ''}
                          onClick={() => void selectBackgroundMode(mode)}
                        >
                          {mode === 'solid' ? 'Solid' : mode === 'transparent' ? 'Transparent' : 'Image'}
                        </button>
                      ))}
                    </div>
                    <label className="range-control">
                      <span>Opacity</span>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={theme.background.opacity}
                        onChange={(event) => void updateThemeBackground({ opacity: Number(event.target.value) })}
                      />
                    </label>
                    <button onClick={() => void chooseBackgroundImage()}>Choose image</button>
                    <label className="range-control">
                      <span>Image opacity</span>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={theme.background.imageOpacity}
                        disabled={theme.background.mode !== 'image'}
                        onChange={(event) => void updateThemeBackground({ imageOpacity: Number(event.target.value) })}
                      />
                    </label>
                    <label className="range-control">
                      <span>Image brightness</span>
                      <input
                        type="range"
                        min="0.2"
                        max="1.6"
                        step="0.05"
                        value={theme.background.imageBrightness}
                        disabled={theme.background.mode !== 'image'}
                        onChange={(event) => void updateThemeBackground({ imageBrightness: Number(event.target.value) })}
                      />
                    </label>
                  </div>
                </div>
              </>
            )}
          </section>
        </section>
      )}

      {saveTarget && (
        <div className="modal-backdrop" onMouseDown={() => setSaveTarget(undefined)}>
          <section className="save-dialog" role="dialog" aria-modal="true" aria-labelledby="save-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="save-dialog-header">
              <div>
                <strong id="save-dialog-title">Save API</strong>
                <span>{saveTarget.method} {saveTarget.responseStatusCode || '-'}</span>
              </div>
              <button title="Close" onClick={() => setSaveTarget(undefined)}><X size={16} /></button>
            </div>
            <div className="save-dialog-body">
              <label>
                Name
                <input value={saveName} onChange={(event) => setSaveName(event.target.value)} autoFocus />
              </label>
              <label>
                Tags
                <input value={saveTags} onChange={(event) => setSaveTags(event.target.value)} placeholder="auth, smoke" />
              </label>
              <label>
                Collection
                <input
                  value={saveCollectionName}
                  onChange={(event) => setSaveCollectionName(event.target.value)}
                  placeholder="Default"
                  list="save-collection-options"
                />
                <datalist id="save-collection-options">
                  {collections.map((collection) => (
                    <option key={collection.id} value={collection.name} />
                  ))}
                </datalist>
              </label>
              <div className="save-summary">
                <span>Method</span>
                <code>{saveTarget.method}</code>
                <span>Collection</span>
                <code>{saveCollectionName.trim() || 'Default'}</code>
                <span>URL</span>
                <code>{saveTarget.url}</code>
                <span>Captured</span>
                <code>{new Date(saveTarget.startedAt).toLocaleString()}</code>
              </div>
            </div>
            <div className="save-dialog-actions">
              <button onClick={() => setSaveTarget(undefined)}>Cancel</button>
              <button className="primary-action" onClick={saveCapturedApi}><Save size={16} /> Save</button>
            </div>
          </section>
        </div>
      )}

      <footer className="statusbar">
        <span>{status.running ? 'Proxy running' : 'Proxy stopped'}</span>
        <span>{status.error || message || `CA: ${status.caCertPath || 'not generated yet'} | Set external clients to HTTP/HTTPS proxy 127.0.0.1:8899.`}</span>
      </footer>
      </main>
    </div>
  )
}

function startDocumentDrag(cursor: 'col-resize' | 'row-resize', onMove: (event: PointerEvent) => void): void {
  const previousCursor = document.body.style.cursor
  const previousUserSelect = document.body.style.userSelect
  document.body.style.cursor = cursor
  document.body.style.userSelect = 'none'

  const handlePointerMove = (event: PointerEvent): void => onMove(event)
  const handlePointerUp = (): void => {
    document.removeEventListener('pointermove', handlePointerMove)
    document.removeEventListener('pointerup', handlePointerUp)
    document.body.style.cursor = previousCursor
    document.body.style.userSelect = previousUserSelect
  }

  document.addEventListener('pointermove', handlePointerMove)
  document.addEventListener('pointerup', handlePointerUp, { once: true })
}

function applyTheme(theme: AppTheme): void {
  const root = document.documentElement
  void window.steal.applyThemeBackground(theme.background)
  for (const [key, value] of Object.entries(theme.colors)) {
    root.style.setProperty(`--theme-${kebabCase(key)}`, value)
  }
  for (const [method, value] of Object.entries(theme.methods)) {
    root.style.setProperty(`--theme-method-${method}-text`, value.text)
    root.style.setProperty(`--theme-method-${method}-background`, value.background)
  }
  root.style.setProperty('--theme-background-opacity', String(theme.background.opacity))
  root.style.setProperty('--theme-background-image-opacity', String(theme.background.imageOpacity))
  root.style.setProperty('--theme-background-image-brightness', String(theme.background.imageBrightness))
  root.style.setProperty('--theme-transparent-surface', colorWithAlpha(theme.colors.surface, 0.22))
  root.style.setProperty('--theme-image-surface', colorWithAlpha(theme.colors.surface, 0.58))
  root.style.setProperty('--theme-transparent-subtle', colorWithAlpha(theme.colors.surfaceSubtle, 0.18))
  root.style.setProperty('--theme-image-subtle', colorWithAlpha(theme.colors.surfaceSubtle, 0.48))
  root.style.setProperty('--theme-background-image', 'none')
  if (theme.background.mode === 'image' && theme.background.imagePath) {
    root.dataset.themeImagePath = theme.background.imagePath
    void window.steal.getThemeImageDataUrl(theme.background.imagePath).then((dataUrl) => {
      if (root.dataset.themeImagePath !== theme.background.imagePath) return
      if (!dataUrl) {
        console.warn(`Theme background image could not be loaded: ${theme.background.imagePath}`)
        return
      }
      root.style.setProperty('--theme-background-image', `url("${dataUrl}")`)
    })
  } else {
    delete root.dataset.themeImagePath
  }
}

function kebabCase(value: string): string {
  return value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)
}

function colorWithAlpha(value: string, alpha: number): string {
  const hex = value.trim()
  const short = hex.match(/^#([0-9a-fA-F]{3})$/)
  if (short) {
    const [r, g, b] = short[1].split('').map((part) => parseInt(part + part, 16))
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  const long = hex.match(/^#([0-9a-fA-F]{6})/)
  if (long) {
    const raw = long[1]
    const r = parseInt(raw.slice(0, 2), 16)
    const g = parseInt(raw.slice(2, 4), 16)
    const b = parseInt(raw.slice(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  return `rgba(255, 255, 255, ${alpha})`
}

function SettingToggle({
  title,
  description,
  checked,
  onChange
}: {
  title: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}): JSX.Element {
  return (
    <div className="setting-card">
      <div>
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      <button className={checked ? 'switch-control active' : 'switch-control'} onClick={() => onChange(!checked)}>
        <span />
      </button>
    </div>
  )
}

function HeadersPanel({
  exchange,
  mode,
  onModeChange
}: {
  exchange: CapturedExchange
  mode: HeaderMode
  onModeChange: (mode: HeaderMode) => void
}): JSX.Element {
  return (
    <div className="headers-panel">
      <div className="detail-toolbar">
        <div className="segment-control" aria-label="Header display mode">
          <button className={mode === 'table' ? 'active' : ''} onClick={() => onModeChange('table')}>Table</button>
          <button className={mode === 'raw' ? 'active' : ''} onClick={() => onModeChange('raw')}>Raw</button>
        </div>
      </div>
      {mode === 'raw' ? (
        <CodeBlock value={headersView(exchange)} language="json" />
      ) : (
        <div className="headers-table-scroll">
          <HeaderSection
            title="Request Headers"
            summary={`${exchange.method} ${exchange.url}`}
            headers={exchange.requestHeaders}
          />
          <HeaderSection
            title="Response Headers"
            summary={`${exchange.responseStatusCode || '-'} ${exchange.responseStatusMessage || ''}`.trim()}
            headers={exchange.responseHeaders}
          />
        </div>
      )}
    </div>
  )
}

function HeaderSection({
  title,
  summary,
  headers
}: {
  title: string
  summary: string
  headers: CapturedExchange['requestHeaders']
}): JSX.Element {
  const rows = Object.entries(headers).sort(([left], [right]) => left.localeCompare(right))

  return (
    <section className="header-section">
      <div className="header-section-title">
        <strong>{title}</strong>
        <span>{summary}</span>
      </div>
      <div className="header-table" role="table">
        <div className="header-row heading" role="row">
          <span role="columnheader">Name</span>
          <span role="columnheader">Value</span>
        </div>
        {rows.length > 0 ? rows.map(([name, value]) => (
          <div className="header-row" role="row" key={name}>
            <code role="cell">{name}</code>
            <span role="cell">{headerValueToString(value)}</span>
          </div>
        )) : (
          <div className="header-empty">No headers captured.</div>
        )}
      </div>
    </section>
  )
}

function KeyValueEditor({
  title,
  rows,
  keyPlaceholder,
  valuePlaceholder,
  onChange
}: {
  title: string
  rows: KeyValueRow[]
  keyPlaceholder: string
  valuePlaceholder: string
  onChange: (rows: KeyValueRow[]) => void
}): JSX.Element {
  function updateRow(id: string, patch: Partial<KeyValueRow>): void {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  function removeRow(id: string): void {
    onChange(rows.filter((row) => row.id !== id))
  }

  return (
    <section className="kv-editor">
      <div className="kv-editor-title">
        <span>{title}</span>
        <button title={`Add ${title} row`} onClick={() => onChange([...rows, emptyRow()])}><Plus size={14} /></button>
      </div>
      <div className="kv-grid">
        <span className="kv-heading" />
        <span className="kv-heading">Name</span>
        <span className="kv-heading">Value</span>
        <span className="kv-heading" />
        {rows.map((row) => (
          <div className="kv-row" key={row.id}>
            <button
              className={row.enabled ? 'kv-check active' : 'kv-check'}
              title={row.enabled ? 'Disable row' : 'Enable row'}
              onClick={() => updateRow(row.id, { enabled: !row.enabled })}
            >
              {row.enabled && <Check size={13} strokeWidth={3} />}
            </button>
            <input value={row.key} placeholder={keyPlaceholder} onChange={(event) => updateRow(row.id, { key: event.target.value })} />
            <input value={row.value} placeholder={valuePlaceholder} onChange={(event) => updateRow(row.id, { value: event.target.value })} />
            <button title="Remove row" onClick={() => removeRow(row.id)}><X size={14} /></button>
          </div>
        ))}
      </div>
    </section>
  )
}

function HeadersTable({ headers }: { headers: Record<string, string> }): JSX.Element {
  const rows = Object.entries(headers)
  return (
    <div className="headers-table-scroll response-headers">
      <div className="header-table" role="table">
        <div className="header-row heading" role="row">
          <span role="columnheader">Name</span>
          <span role="columnheader">Value</span>
        </div>
        {rows.map(([name, value]) => (
          <div className="header-row" role="row" key={name}>
            <code role="cell">{name}</code>
            <span role="cell">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MetricsPanel({ result }: { result: ReplayResult }): JSX.Element {
  return (
    <div className="metrics-panel">
      <div><span>Status</span><strong>{result.status} {result.statusText}</strong></div>
      <div><span>Duration</span><strong>{result.durationMs}ms</strong></div>
      <div><span>Size</span><strong>{formatBytes(result.size)}</strong></div>
      <div><span>Headers</span><strong>{Object.keys(result.headers).length}</strong></div>
    </div>
  )
}

function CodeBlock({ value, language }: { value: string; language?: CodeLanguage }): JSX.Element {
  const highlighted = useMemo(() => highlightCode(value, language), [value, language])

  return (
    <pre className="code-block">
      <code
        className={`hljs language-${highlighted.language}`}
        dangerouslySetInnerHTML={{ __html: highlighted.html }}
      />
    </pre>
  )
}

function highlightCode(value: string, language?: CodeLanguage): { html: string; language: CodeLanguage } {
  const detectedLanguage = language || languageFromBody(value)

  try {
    return {
      html: hljs.highlight(value, { language: detectedLanguage, ignoreIllegals: true }).value,
      language: detectedLanguage
    }
  } catch {
    return {
      html: escapeHtml(value),
      language: 'plaintext'
    }
  }
}

function languageFromBody(value: string, contentType?: string | string[]): CodeLanguage {
  const normalizedContentType = Array.isArray(contentType) ? contentType.join(';').toLowerCase() : (contentType || '').toLowerCase()
  const trimmed = value.trim()

  if (normalizedContentType.includes('json') || looksLikeJson(trimmed)) return 'json'
  if (
    normalizedContentType.includes('javascript') ||
    normalizedContentType.includes('ecmascript') ||
    trimmed.startsWith('function ') ||
    trimmed.startsWith('const ') ||
    trimmed.startsWith('let ') ||
    trimmed.startsWith('var ') ||
    trimmed.startsWith('import ') ||
    trimmed.startsWith('export ')
  ) {
    return 'javascript'
  }
  if (normalizedContentType.includes('xml') || normalizedContentType.includes('html') || /^<[\w!?/]/.test(trimmed)) return 'xml'
  return 'plaintext'
}

function looksLikeJson(value: string): boolean {
  if (!value || !((value.startsWith('{') && value.endsWith('}')) || (value.startsWith('[') && value.endsWith(']')))) return false
  try {
    JSON.parse(value)
    return true
  } catch {
    return false
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function normalizeAddress(value: string): string {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

function safePath(value: string): string {
  try {
    return new URL(value).pathname || '/'
  } catch {
    return value
  }
}

function splitTags(value: string): string[] {
  return value.split(',').map((tag) => tag.trim()).filter(Boolean)
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} KB`
  return `${Math.round(bytes / 1024 / 102.4) / 10} MB`
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

function headersView(capture: CapturedExchange): string {
  return [
    `${capture.method} ${capture.url}`,
    '',
    'Request Headers',
    JSON.stringify(capture.requestHeaders, null, 2),
    '',
    `Response ${capture.responseStatusCode} ${capture.responseStatusMessage}`,
    JSON.stringify(capture.responseHeaders, null, 2)
  ].join('\n')
}

function captureToCurl(capture: CapturedExchange): string {
  const parts = ['curl', '-X', shellQuote(capture.method), shellQuote(capture.url)]
  const blockedHeaders = new Set(['content-length'])

  for (const [name, value] of Object.entries(capture.requestHeaders)) {
    if (blockedHeaders.has(name.toLowerCase()) || value === undefined) continue
    parts.push('-H', shellQuote(`${name}: ${headerValueToString(value)}`))
  }

  if (capture.requestBody && !capture.requestBody.startsWith('[binary body:')) {
    parts.push('--data-raw', shellQuote(capture.requestBody))
  }

  return parts.join(' ')
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`
}

function compactEditableHeaders(headers: CapturedExchange['requestHeaders']): Record<string, string> {
  const blocked = new Set(['host', 'content-length', 'connection', 'accept-encoding'])
  return Object.fromEntries(
    Object.entries(headers)
      .filter(([key]) => !blocked.has(key.toLowerCase()))
      .map(([key, value]) => [key, Array.isArray(value) ? value.join(', ') : value || ''])
  )
}

function objectToRows(values: Record<string, string>): KeyValueRow[] {
  const rows = Object.entries(values).map(([key, value]) => ({ id: crypto.randomUUID(), key, value, enabled: true }))
  return rows.length > 0 ? rows : [emptyRow()]
}

function rowsToObject(rows: KeyValueRow[]): Record<string, string> {
  return Object.fromEntries(rows.filter((row) => row.enabled && row.key.trim()).map((row) => [row.key.trim(), row.value]))
}

function bodyToRows(body: string): { rows: KeyValueRow[]; mode: 'json' | 'raw' } {
  try {
    const parsed = JSON.parse(body) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return {
        mode: 'json',
        rows: objectToRows(Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, stringifyEditableValue(value)])))
      }
    }
  } catch {
    // Fall through to raw body row.
  }
  return { mode: 'raw', rows: [{ id: crypto.randomUUID(), key: 'body', value: body }] }
}

function rowsToBody(rows: KeyValueRow[], mode: 'json' | 'raw'): string {
  if (mode === 'json') {
    const body = Object.fromEntries(rows.filter((row) => row.enabled && row.key.trim()).map((row) => [row.key.trim(), parseEditableValue(row.value)]))
    return JSON.stringify(body, null, 2)
  }
  return rows.find((row) => row.enabled)?.value || ''
}

function emptyRow(): KeyValueRow {
  return { id: crypto.randomUUID(), key: '', value: '', enabled: true }
}

function stringifyEditableValue(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value)
}

function parseEditableValue(value: string): unknown {
  const trimmed = value.trim()
  if (!trimmed) return ''
  try {
    return JSON.parse(trimmed)
  } catch {
    return value
  }
}

function splitUrlForEditing(url: string): { baseUrl: string; queryRows: KeyValueRow[] } {
  try {
    const parsed = new URL(url)
    const queryRows = Array.from(parsed.searchParams.entries()).map(([key, value]) => ({
      id: crypto.randomUUID(),
      key,
      value,
      enabled: true
    }))
    parsed.search = ''
    return { baseUrl: parsed.toString(), queryRows: queryRows.length > 0 ? queryRows : [emptyRow()] }
  } catch {
    return { baseUrl: url, queryRows: [emptyRow()] }
  }
}

function buildUrlWithQueryRows(url: string, rows: KeyValueRow[]): string {
  try {
    const parsed = new URL(url)
    parsed.search = ''
    for (const row of rows) {
      if (row.enabled && row.key.trim()) parsed.searchParams.append(row.key.trim(), row.value)
    }
    return parsed.toString()
  } catch {
    return url
  }
}

function enabledCount(rows: KeyValueRow[]): number {
  return rows.filter((row) => row.enabled && row.key.trim()).length
}

function headerValueToString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value.join(', ')
  return value || ''
}

function domainFromCapture(capture: CapturedExchange): string {
  if (capture.host) return capture.host
  try {
    return new URL(capture.url).hostname
  } catch {
    return '(unknown)'
  }
}

function classifyResource(capture: CapturedExchange): Exclude<ResourceFilter, 'all'> {
  const responseType = headerValueToString(capture.responseHeaders['content-type']).toLowerCase()
  const requestAccept = headerValueToString(capture.requestHeaders.accept).toLowerCase()
  const requestUpgrade = headerValueToString(capture.requestHeaders.upgrade).toLowerCase()
  const url = capture.url.toLowerCase().split('?')[0]

  if (requestUpgrade.includes('websocket') || url.startsWith('ws://') || url.startsWith('wss://')) return 'socket'
  if (responseType.includes('text/html') || requestAccept.includes('text/html')) return 'doc'
  if (responseType.includes('text/css') || url.endsWith('.css')) return 'css'
  if (responseType.includes('javascript') || responseType.includes('ecmascript') || /\.(mjs|cjs|js)$/.test(url)) return 'js'
  if (responseType.includes('font') || /\.(woff2?|ttf|otf|eot)$/.test(url)) return 'font'
  if (responseType.startsWith('image/') || /\.(png|jpe?g|gif|webp|avif|svg|ico)$/.test(url)) return 'img'
  if (responseType.startsWith('audio/') || responseType.startsWith('video/') || /\.(mp4|webm|mov|m4v|mp3|wav|m4a|aac|ogg|m3u8|ts)$/.test(url)) return 'media'
  if (responseType.includes('manifest') || url.endsWith('.webmanifest') || url.endsWith('/manifest.json')) return 'manifest'
  if (responseType.includes('wasm') || url.endsWith('.wasm')) return 'wasm'
  if (responseType.includes('json') || responseType.includes('xml') || responseType.includes('text/plain') || requestAccept.includes('application/json')) return 'fetch'
  if (['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(capture.method.toUpperCase()) && !requestAccept.includes('text/html')) return 'fetch'
  return 'other'
}

function captureMatchesQuery(capture: CapturedExchange, needle: string): boolean {
  return [
    capture.method,
    capture.url,
    capture.host,
    capture.path,
    capture.responseStatusCode,
    capture.responseStatusMessage,
    JSON.stringify(capture.requestHeaders),
    capture.requestBody,
    JSON.stringify(capture.responseHeaders),
    capture.responseBody,
    capture.startedAt,
    capture.tags?.join(' ')
  ].join('\n').toLowerCase().includes(needle)
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tagName = target.tagName.toLowerCase()
  return target.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select'
}

function modeTitle(mode: AppMode): string {
  if (mode === 'collection') return 'API Collection'
  if (mode === 'settings') return 'Setting'
  return 'Capture'
}

function modeSummary(mode: AppMode, filteredCount: number, captureCount: number, collectionCount: number, savedApiCount: number): string {
  if (mode === 'collection') return `${collectionCount} collections / ${savedApiCount} APIs`
  if (mode === 'settings') return 'Proxy and certificate controls'
  return `${filteredCount} shown / ${captureCount} captured`
}

const root = document.getElementById('root')

if (!root) {
  throw new Error('Root element not found.')
}

createRoot(root).render(<App />)
