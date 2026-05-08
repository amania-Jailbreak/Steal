import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type SetStateAction } from 'react'
import { createRoot } from 'react-dom/client'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import xml from 'highlight.js/lib/languages/xml'
import plaintext from 'highlight.js/lib/languages/plaintext'
import { Activity, ArrowLeft, ArrowRight, Check, ChevronRight, Clock3, Eye, EyeOff, FileDown, FileUp, Folder, FolderOpen, Funnel, Library, Maximize2, Minimize2, Minus, Monitor, Pause, Play, Plus, RadioTower, RefreshCcw, Save, Search, Send, Settings, ShieldAlert, ShieldCheck, Trash2, X } from 'lucide-react'
import type { AppPlatform, AppSettings, AppTheme, BrowserMode, CapturedExchange, CertificateStatus, CollectionSettings, ProxyStatus, ReplayRequest, ReplayResult, SavedApi, SavedCollection } from '../../shared/types'
import './styles.css'

type AppMode = 'capture' | 'collection' | 'settings'
type DetailTab = 'headers' | 'body' | 'response'
type HeaderMode = 'table' | 'raw'
type CodeLanguage = 'json' | 'javascript' | 'xml' | 'plaintext'
type RequestEditorTab = 'query' | 'headers' | 'body'
type ResponseViewerTab = 'headers' | 'body' | 'diff' | 'metrics'
type SettingsCategory = 'startup' | 'browser' | 'theme'
type CollectionSettingsTab = 'variables' | 'headers' | 'cookies' | 'user-agent'
type ResourceFilter = 'all' | 'fetch' | 'doc' | 'css' | 'js' | 'font' | 'img' | 'media' | 'manifest' | 'socket' | 'wasm' | 'other'
type KeyValueRow = { id: string; key: string; value: string; enabled: boolean }
type CaptureContextMenu = { capture: CapturedExchange; x: number; y: number }
type CollectionContextMenu = { collection: SavedCollection; x: number; y: number }
type CaptureTabContextMenu = { tab: CaptureTab; x: number; y: number }
type FocusHint = { text: string; x: number; y: number }
type CaptureFilters = {
  query: string
  showFilterPanel: boolean
  appBrowserOnly: boolean
  resourceFilter: ResourceFilter
  selectedDomains: string[]
}
type CaptureTabKind = 'live' | 'live-view' | 'snapshot' | 'har'
type CaptureTab = {
  id: string
  title: string
  kind: CaptureTabKind
  filters: CaptureFilters
  captures?: CapturedExchange[]
}

hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('json', json)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('plaintext', plaintext)

const emptyStatus: ProxyStatus = {
  running: false,
  capturePaused: false,
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
const CAPTURE_ROW_HEIGHT = 29
const CAPTURE_ROW_OVERSCAN = 10
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

const defaultCaptureFilters: CaptureFilters = {
  query: '',
  showFilterPanel: false,
  appBrowserOnly: false,
  resourceFilter: 'all',
  selectedDomains: []
}

const liveCaptureTab: CaptureTab = {
  id: 'live',
  title: 'Live',
  kind: 'live',
  filters: defaultCaptureFilters
}
const defaultAppSettings: AppSettings = {
  autoStartProxy: true,
  systemProxyEnabled: true,
  autoShowBrowser: true,
  browserMode: 'embedded'
}

const defaultCollectionSettings: CollectionSettings = {
  variables: {},
  headers: {},
  cookies: {},
  userAgent: {
    enabled: false,
    preset: 'none',
    value: ''
  }
}

const userAgentPresets = [
  { id: 'none', label: 'None', value: '' },
  { id: 'chrome-mac', label: 'Chrome macOS', value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' },
  { id: 'chrome-windows', label: 'Chrome Windows', value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' },
  { id: 'safari-ios', label: 'Safari iPhone', value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1' },
  { id: 'chrome-android', label: 'Chrome Android', value: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36' }
]

const collectionSettingsTabs: Array<{ id: CollectionSettingsTab; label: string }> = [
  { id: 'variables', label: 'Variables' },
  { id: 'headers', label: 'Headers' },
  { id: 'cookies', label: 'Cookies' },
  { id: 'user-agent', label: 'User-Agent' }
]

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
  }
}

export default function App(): JSX.Element {
  const webviewRef = useRef<Electron.WebviewTag | null>(null)
  const workspaceRef = useRef<HTMLElement | null>(null)
  const browserPaneRef = useRef<HTMLElement | null>(null)
  const captureTableRef = useRef<HTMLDivElement | null>(null)
  const [address, setAddress] = useState('https://www.google.com')
  const [browserUrl, setBrowserUrl] = useState('https://www.google.com')
  const [detailsWidth, setDetailsWidth] = useState(420)
  const [networkHeight, setNetworkHeight] = useState(270)
  const [captureTableHeight, setCaptureTableHeight] = useState(0)
  const [captureTableScrollTop, setCaptureTableScrollTop] = useState(0)
  const [status, setStatus] = useState<ProxyStatus>(emptyStatus)
  const [certificateStatus, setCertificateStatus] = useState<CertificateStatus>(emptyCertificateStatus)
  const [platform, setPlatform] = useState<AppPlatform>()
  const [windowMaximized, setWindowMaximized] = useState(false)
  const [captures, setCaptures] = useState<CapturedExchange[]>([])
  const [collections, setCollections] = useState<SavedCollection[]>([])
  const [savedApis, setSavedApis] = useState<SavedApi[]>([])
  const [selectedId, setSelectedId] = useState<string>()
  const [captureTabs, setCaptureTabs] = useState<CaptureTab[]>([liveCaptureTab])
  const [activeCaptureTabId, setActiveCaptureTabId] = useState('live')
  const [draggingCaptureTabId, setDraggingCaptureTabId] = useState<string>()
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>()
  const [selectedSavedApiId, setSelectedSavedApiId] = useState<string>()
  const [openSavedApiIds, setOpenSavedApiIds] = useState<string[]>([])
  const [draggingSavedApiId, setDraggingSavedApiId] = useState<string>()
  const [expandedCollectionIds, setExpandedCollectionIds] = useState<Set<string>>(new Set())
  const [activeMode, setActiveMode] = useState<AppMode>('capture')
  const [tab, setTab] = useState<DetailTab>('headers')
  const [headerMode, setHeaderMode] = useState<HeaderMode>('table')
  const [detailSearch, setDetailSearch] = useState('')
  const [saveTarget, setSaveTarget] = useState<CapturedExchange>()
  const [saveName, setSaveName] = useState('')
  const [saveTags, setSaveTags] = useState('')
  const [saveCollectionName, setSaveCollectionName] = useState('Default')
  const [contextMenu, setContextMenu] = useState<CaptureContextMenu>()
  const [captureTabContextMenu, setCaptureTabContextMenu] = useState<CaptureTabContextMenu>()
  const [renameCaptureTabTarget, setRenameCaptureTabTarget] = useState<CaptureTab>()
  const [renameCaptureTabName, setRenameCaptureTabName] = useState('')
  const [collectionContextMenu, setCollectionContextMenu] = useState<CollectionContextMenu>()
  const [collectionSettingsTarget, setCollectionSettingsTarget] = useState<SavedCollection>()
  const [collectionVariableRows, setCollectionVariableRows] = useState<KeyValueRow[]>([])
  const [collectionHeaderRows, setCollectionHeaderRows] = useState<KeyValueRow[]>([])
  const [collectionCookieRows, setCollectionCookieRows] = useState<KeyValueRow[]>([])
  const [collectionUaEnabled, setCollectionUaEnabled] = useState(false)
  const [collectionUaPreset, setCollectionUaPreset] = useState('none')
  const [collectionUaValue, setCollectionUaValue] = useState('')
  const [collectionSettingsTab, setCollectionSettingsTab] = useState<CollectionSettingsTab>('variables')
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
  const [focusHint, setFocusHint] = useState<FocusHint>()

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
    let timer: number | undefined
    let activeElement: HTMLElement | undefined

    const restoreTitle = (): void => {
      if (!activeElement) return
      const originalTitle = activeElement.dataset.stealHintTitle
      if (originalTitle !== undefined) {
        activeElement.setAttribute('title', originalTitle)
        delete activeElement.dataset.stealHintTitle
      }
      activeElement = undefined
    }

    const hideHint = (): void => {
      if (timer !== undefined) window.clearTimeout(timer)
      timer = undefined
      setFocusHint(undefined)
      restoreTitle()
    }

    const showHintLater = (target: EventTarget | null): void => {
      const element = target instanceof HTMLElement
        ? target.closest<HTMLElement>('[data-hint], [title], [aria-label]')
        : undefined
      const text = element?.dataset.hint || element?.getAttribute('title') || element?.getAttribute('aria-label') || ''
      if (!element || !text.trim()) return

      hideHint()
      activeElement = element
      const title = element.getAttribute('title')
      if (title !== null) {
        element.dataset.stealHintTitle = title
        element.removeAttribute('title')
      }

      timer = window.setTimeout(() => {
        const rect = element.getBoundingClientRect()
        const x = clamp(rect.left + rect.width / 2, 18, window.innerWidth - 18)
        const y = rect.bottom + 10 > window.innerHeight - 34 ? rect.top - 34 : rect.bottom + 10
        setFocusHint({ text, x, y: Math.max(10, y) })
      }, 650)
    }

    const onMouseEnter = (event: MouseEvent): void => showHintLater(event.target)
    const onFocusIn = (event: FocusEvent): void => showHintLater(event.target)

    document.addEventListener('mouseover', onMouseEnter)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('mouseout', hideHint)
    document.addEventListener('focusout', hideHint)
    document.addEventListener('click', hideHint)
    document.addEventListener('keydown', hideHint)
    window.addEventListener('scroll', hideHint, true)
    window.addEventListener('resize', hideHint)

    return () => {
      hideHint()
      document.removeEventListener('mouseover', onMouseEnter)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('mouseout', hideHint)
      document.removeEventListener('focusout', hideHint)
      document.removeEventListener('click', hideHint)
      document.removeEventListener('keydown', hideHint)
      window.removeEventListener('scroll', hideHint, true)
      window.removeEventListener('resize', hideHint)
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
  const activeCaptureTab = useMemo(() => {
    return captureTabs.find((captureTab) => captureTab.id === activeCaptureTabId) || captureTabs[0] || liveCaptureTab
  }, [activeCaptureTabId, captureTabs])
  const activeCaptureFilters = activeCaptureTab.filters
  const query = activeCaptureFilters.query
  const showFilterPanel = activeCaptureFilters.showFilterPanel
  const appBrowserOnly = activeCaptureFilters.appBrowserOnly
  const resourceFilter = activeCaptureFilters.resourceFilter
  const selectedDomains = useMemo(() => new Set(activeCaptureFilters.selectedDomains), [activeCaptureFilters.selectedDomains])
  const tabCaptures = activeCaptureTab.kind === 'live' || activeCaptureTab.kind === 'live-view' ? captures : activeCaptureTab.captures || []

  const selected = useMemo(() => {
    return tabCaptures.find((capture) => capture.id === selectedId && (showBrowserTraffic || capture.source !== 'browser'))
  }, [selectedId, showBrowserTraffic, tabCaptures])

  const detailSearchCount = useMemo(() => {
    if (!selected || !detailSearch.trim()) return 0
    return countOccurrences(detailSearchText(selected, tab, headerMode), detailSearch)
  }, [detailSearch, headerMode, selected, tab])

  const filteredCaptures = useMemo(() => {
    const tokens = searchTokens(query)
    const sourceFiltered = showBrowserTraffic ? tabCaptures : tabCaptures.filter((capture) => capture.source !== 'browser')
    if (!showFilterPanel) return sourceFiltered
    return sourceFiltered.filter((capture) => {
      if (appBrowserOnly && capture.source !== 'browser') return false
      if (resourceFilter !== 'all' && classifyResource(capture) !== resourceFilter) return false
      const domain = domainFromCapture(capture)
      if (selectedDomains.size > 0 && !selectedDomains.has(domain)) return false
      return tokens.length === 0 || captureMatchesQuery(capture, tokens)
    })
  }, [appBrowserOnly, query, resourceFilter, selectedDomains, showBrowserTraffic, showFilterPanel, tabCaptures])

  const visibleCaptureWindow = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(captureTableScrollTop / CAPTURE_ROW_HEIGHT) - CAPTURE_ROW_OVERSCAN)
    const visibleCount = Math.ceil((captureTableHeight || 1) / CAPTURE_ROW_HEIGHT) + CAPTURE_ROW_OVERSCAN * 2
    const endIndex = Math.min(filteredCaptures.length, startIndex + visibleCount)
    return {
      captures: filteredCaptures.slice(startIndex, endIndex),
      offsetTop: startIndex * CAPTURE_ROW_HEIGHT,
      totalHeight: filteredCaptures.length * CAPTURE_ROW_HEIGHT
    }
  }, [captureTableHeight, captureTableScrollTop, filteredCaptures])

  const availableDomains = useMemo(() => {
    const counts = new Map<string, number>()
    const sourceFiltered = showBrowserTraffic ? tabCaptures : tabCaptures.filter((capture) => capture.source !== 'browser')
    for (const capture of sourceFiltered) {
      const domain = domainFromCapture(capture)
      counts.set(domain, (counts.get(domain) || 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([domain, count]) => ({ domain, count }))
      .sort((left, right) => left.domain.localeCompare(right.domain))
  }, [showBrowserTraffic, tabCaptures])

  const selectedCollection = useMemo(() => {
    return collections.find((collection) => collection.id === selectedCollectionId) || collections[0]
  }, [collections, selectedCollectionId])

  const openSavedApis = useMemo(() => {
    return openSavedApiIds
      .map((id) => savedApis.find((api) => api.id === id))
      .filter((api): api is SavedApi => Boolean(api))
  }, [openSavedApiIds, savedApis])

  const selectedSavedApi = useMemo(() => {
    return savedApis.find((api) => api.id === selectedSavedApiId)
  }, [savedApis, selectedSavedApiId])

  const selectedSavedApiCollection = useMemo(() => {
    if (!selectedSavedApi) return undefined
    return collections.find((collection) => collection.id === selectedSavedApi.collectionId)
  }, [collections, selectedSavedApi])

  useEffect(() => {
    if (!selectedCollectionId && collections.length > 0) {
      setSelectedCollectionId(collections[0].id)
      setExpandedCollectionIds((current) => new Set([...current, collections[0].id]))
    }
  }, [collections, selectedCollectionId])

  useEffect(() => {
    setOpenSavedApiIds((current) => current.filter((id) => savedApis.some((api) => api.id === id)))
    setSelectedSavedApiId((current) => current && savedApis.some((api) => api.id === current) ? current : undefined)
  }, [savedApis])

  useEffect(() => {
    if (!selectedSavedApi) return
    setOpenSavedApiIds((current) => current.includes(selectedSavedApi.id) ? current : [...current, selectedSavedApi.id])
    setSelectedSavedApiId((current) => current || selectedSavedApi.id)
  }, [selectedSavedApi])

  useEffect(() => {
    if (selected) return
    setSelectedId(filteredCaptures[0]?.id)
  }, [filteredCaptures, selected])

  useEffect(() => {
    const element = captureTableRef.current
    if (!element) return

    const updateHeight = (): void => setCaptureTableHeight(element.clientHeight)
    updateHeight()
    const observer = new ResizeObserver(updateHeight)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const element = captureTableRef.current
    if (element) element.scrollTop = 0
    setCaptureTableScrollTop(0)
  }, [activeCaptureTabId, appBrowserOnly, query, resourceFilter, selectedDomains, showFilterPanel])

  function updateActiveCaptureFilters(patch: Partial<CaptureFilters>): void {
    setCaptureTabs((current) => current.map((captureTab) => (
      captureTab.id === activeCaptureTabId
        ? { ...captureTab, filters: { ...captureTab.filters, ...patch } }
        : captureTab
    )))
  }

  function setQuery(value: string): void {
    updateActiveCaptureFilters({ query: value })
  }

  function setShowFilterPanel(value: SetStateAction<boolean>): void {
    const next = typeof value === 'function' ? value(showFilterPanel) : value
    updateActiveCaptureFilters({ showFilterPanel: next })
  }

  function setAppBrowserOnly(value: SetStateAction<boolean>): void {
    const next = typeof value === 'function' ? value(appBrowserOnly) : value
    updateActiveCaptureFilters({ appBrowserOnly: next })
  }

  function setResourceFilter(value: ResourceFilter): void {
    updateActiveCaptureFilters({ resourceFilter: value })
  }

  function setSelectedDomains(value: Set<string>): void {
    updateActiveCaptureFilters({ selectedDomains: Array.from(value) })
  }

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
    if (activeCaptureTab.kind === 'live') {
      await window.steal.clearCaptures()
      setCaptures([])
    } else if (activeCaptureTab.kind === 'live-view') {
      closeCaptureTab(activeCaptureTab.id)
    } else {
      setCaptureTabs((current) => current.map((captureTab) => (
        captureTab.id === activeCaptureTab.id ? { ...captureTab, captures: [] } : captureTab
      )))
    }
    setSelectedId(undefined)
  }

  async function exportHar(): Promise<void> {
    const filePath = await window.steal.exportHar(tabCaptures)
    if (filePath) setMessage(`Exported HAR: ${filePath}`)
  }

  async function importHar(): Promise<void> {
    const importedCaptures = await window.steal.importHar()
    if (importedCaptures.length === 0) return
    const tabId = openCaptureTab('har', `HAR ${captureTabs.filter((captureTab) => captureTab.kind === 'har').length + 1}`, importedCaptures)
    setActiveCaptureTabId(tabId)
    setSelectedId(importedCaptures[0]?.id)
    setMessage(`Imported HAR: ${importedCaptures.length} captures`)
  }

  function openLiveViewTab(): void {
    const tabId = openCaptureTab('live-view', `View ${captureTabs.filter((captureTab) => captureTab.kind === 'live-view').length + 1}`)
    setActiveCaptureTabId(tabId)
  }

  function openSnapshotTab(): void {
    const snapshotCaptures = [...filteredCaptures]
    const tabId = openCaptureTab('snapshot', `Snapshot ${captureTabs.filter((captureTab) => captureTab.kind === 'snapshot').length + 1}`, snapshotCaptures)
    setActiveCaptureTabId(tabId)
    setSelectedId(snapshotCaptures[0]?.id)
  }

  function openCaptureTab(kind: Exclude<CaptureTabKind, 'live'>, title: string, tabCaptureList?: CapturedExchange[]): string {
    const id = `capture-${Date.now()}-${Math.random().toString(16).slice(2)}`
    setCaptureTabs((current) => [
      ...current,
      {
        id,
        title,
        kind,
        filters: { ...defaultCaptureFilters },
        captures: tabCaptureList
      }
    ])
    return id
  }

  function selectCaptureTab(tabId: string): void {
    setActiveCaptureTabId(tabId)
    setSelectedId(undefined)
  }

  function closeCaptureTab(tabId: string): void {
    if (tabId === 'live') return
    setCaptureTabs((current) => {
      const index = current.findIndex((captureTab) => captureTab.id === tabId)
      const next = current.filter((captureTab) => captureTab.id !== tabId)
      if (activeCaptureTabId === tabId) {
        const fallback = next[Math.min(Math.max(index - 1, 0), next.length - 1)] || next[0] || liveCaptureTab
        setActiveCaptureTabId(fallback.id)
        setSelectedId(undefined)
      }
      return next
    })
  }

  function duplicateCaptureTab(tab: CaptureTab): void {
    const id = `capture-${Date.now()}-${Math.random().toString(16).slice(2)}`
    const duplicate: CaptureTab = {
      ...tab,
      id,
      title: `${tab.title} Copy`,
      kind: tab.kind === 'live' ? 'live-view' : tab.kind,
      filters: {
        ...tab.filters,
        selectedDomains: [...tab.filters.selectedDomains]
      },
      captures: tab.kind === 'live' || tab.kind === 'live-view' ? undefined : [...(tab.captures || [])]
    }
    setCaptureTabs((current) => [...current, duplicate])
    setActiveCaptureTabId(id)
    setSelectedId(undefined)
  }

  function openRenameCaptureTab(tab: CaptureTab): void {
    setRenameCaptureTabTarget(tab)
    setRenameCaptureTabName(tab.title)
  }

  function renameCaptureTab(): void {
    if (!renameCaptureTabTarget) return
    const nextName = renameCaptureTabName.trim()
    if (!nextName) return
    setCaptureTabs((current) => current.map((captureTab) => (
      captureTab.id === renameCaptureTabTarget.id ? { ...captureTab, title: nextName } : captureTab
    )))
    setRenameCaptureTabTarget(undefined)
  }

  function moveCaptureTab(sourceId: string, targetId: string): void {
    if (sourceId === targetId || sourceId === 'live' || targetId === 'live') return
    setCaptureTabs((current) => {
      const sourceIndex = current.findIndex((captureTab) => captureTab.id === sourceId)
      const targetIndex = current.findIndex((captureTab) => captureTab.id === targetId)
      if (sourceIndex <= 0 || targetIndex <= 0) return current

      const next = [...current]
      const [movedTab] = next.splice(sourceIndex, 1)
      next.splice(targetIndex, 0, movedTab)
      return next
    })
  }

  async function toggleCapturePaused(): Promise<void> {
    const nextStatus = await window.steal.setCapturePaused(!status.capturePaused)
    setStatus(nextStatus)
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

  function openSavedApi(api: SavedApi): void {
    setSelectedCollectionId(api.collectionId)
    setSelectedSavedApiId(api.id)
    setOpenSavedApiIds((current) => current.includes(api.id) ? current : [...current, api.id])
    setExpandedCollectionIds((current) => new Set([...current, api.collectionId]))
  }

  function closeSavedApiTab(apiId: string): void {
    setOpenSavedApiIds((current) => {
      const index = current.indexOf(apiId)
      const next = current.filter((id) => id !== apiId)
      if (selectedSavedApiId === apiId) {
        const fallbackId = next[Math.min(index, next.length - 1)]
        setSelectedSavedApiId(fallbackId)
        const fallbackApi = savedApis.find((api) => api.id === fallbackId)
        if (fallbackApi) setSelectedCollectionId(fallbackApi.collectionId)
      }
      return next
    })
  }

  function moveSavedApiTab(sourceId: string, targetId: string): void {
    if (sourceId === targetId) return
    setOpenSavedApiIds((current) => {
      const sourceIndex = current.indexOf(sourceId)
      const targetIndex = current.indexOf(targetId)
      if (sourceIndex === -1 || targetIndex === -1) return current

      const next = [...current]
      const [movedId] = next.splice(sourceIndex, 1)
      next.splice(targetIndex, 0, movedId)
      return next
    })
  }

  async function copyCaptureUrl(capture: CapturedExchange): Promise<void> {
    try {
      await window.steal.copyText(capture.url)
      setMessage('Copied URL')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    }
  }

  async function copyCaptureAsCurl(capture: CapturedExchange): Promise<void> {
    try {
      await window.steal.copyText(captureToCurl(capture))
      setMessage('Copied as cURL')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    }
  }

  function openCollectionSettings(collection: SavedCollection): void {
    const settings = collection.settings || defaultCollectionSettings
    setCollectionSettingsTarget(collection)
    setCollectionVariableRows(mapToRows(settings.variables))
    setCollectionHeaderRows(mapToRows(settings.headers))
    setCollectionCookieRows(mapToRows(settings.cookies))
    setCollectionUaEnabled(settings.userAgent.enabled)
    setCollectionUaPreset(settings.userAgent.preset || 'none')
    setCollectionUaValue(settings.userAgent.value || userAgentPresets.find((preset) => preset.id === settings.userAgent.preset)?.value || '')
    setCollectionSettingsTab('variables')
  }

  async function saveCollectionSettings(): Promise<void> {
    if (!collectionSettingsTarget) return
    const nextCollections = await window.steal.updateCollectionSettings(collectionSettingsTarget.id, {
      variables: rowsToObject(collectionVariableRows),
      headers: rowsToObject(collectionHeaderRows),
      cookies: rowsToObject(collectionCookieRows),
      userAgent: {
        enabled: collectionUaEnabled,
        preset: collectionUaPreset,
        value: collectionUaValue
      }
    })
    setCollections(nextCollections)
    setCollectionSettingsTarget(undefined)
    setMessage(`Updated ${collectionSettingsTarget.name} settings`)
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
    setOpenSavedApiIds((current) => current.includes(saved.id) ? current : [...current, saved.id])
    setExpandedCollectionIds((current) => new Set([...current, saved.collectionId]))
    setMessage(`Saved ${saved.name} to ${saved.collectionName}`)
    setSaveTarget(undefined)
  }

  async function sendCollectionTest(): Promise<void> {
    setIsSendingTest(true)
    setTestError('')
    setTestResult(undefined)
    try {
      const collectionSettings = selectedSavedApiCollection?.settings || selectedCollection?.settings || defaultCollectionSettings
      const variables = collectionSettings.variables || {}
      const requestHeaders = rowsToObject(applyVariablesToRows(testHeaderRows, variables))
      const headers = buildCollectionHeaders(collectionSettings, requestHeaders)
      const result = await window.steal.replay({
        ...testRequest,
        url: expandVariables(buildUrlWithQueryRows(testRequest.url, applyVariablesToRows(testQueryRows, variables)), variables),
        headers,
        body: expandVariables(rowsToBody(applyVariablesToRows(testBodyRows, variables), testBodyMode), variables)
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
    <div className={`app-window platform-${platform || 'loading'}`}>
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
          <span>{modeSummary(activeMode, filteredCaptures.length, tabCaptures.length, collections.length, savedApis.length)}</span>
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
              <div className="capture-tab-bar">
                {captureTabs.map((captureTab) => (
                  <div
                    key={captureTab.id}
                    className={[
                      'capture-tab',
                      activeCaptureTab.id === captureTab.id ? 'active' : '',
                      draggingCaptureTabId === captureTab.id ? 'dragging' : ''
                    ].filter(Boolean).join(' ')}
                    draggable={captureTab.id !== 'live'}
                    role="button"
                    tabIndex={0}
                    title={captureTab.kind === 'live' || captureTab.kind === 'live-view' ? 'Live captures' : `${captureTab.captures?.length || 0} captures`}
                    onDragStart={(event) => {
                      if (captureTab.id === 'live') return
                      setDraggingCaptureTabId(captureTab.id)
                      event.dataTransfer.effectAllowed = 'move'
                      event.dataTransfer.setData('text/plain', captureTab.id)
                    }}
                    onDragOver={(event) => {
                      event.preventDefault()
                      const sourceId = draggingCaptureTabId || event.dataTransfer.getData('text/plain')
                      if (sourceId) moveCaptureTab(sourceId, captureTab.id)
                    }}
                    onDrop={(event) => {
                      event.preventDefault()
                      const sourceId = draggingCaptureTabId || event.dataTransfer.getData('text/plain')
                      if (sourceId) moveCaptureTab(sourceId, captureTab.id)
                      setDraggingCaptureTabId(undefined)
                    }}
                    onDragEnd={() => setDraggingCaptureTabId(undefined)}
                    onClick={() => selectCaptureTab(captureTab.id)}
                    onContextMenu={(event) => {
                      event.preventDefault()
                      setActiveCaptureTabId(captureTab.id)
                      setCaptureTabContextMenu({ tab: captureTab, x: event.clientX, y: event.clientY })
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return
                      event.preventDefault()
                      selectCaptureTab(captureTab.id)
                    }}
                  >
                    <span className="capture-tab-icon">
                      <CaptureTabIcon kind={captureTab.kind} />
                    </span>
                    <strong>{captureTab.title}</strong>
                    {captureTab.filters.showFilterPanel && <span className="capture-tab-dot" />}
                    {captureTab.id !== 'live' && (
                      <span
                        className="capture-tab-close"
                        role="button"
                        tabIndex={0}
                        title="Close tab"
                        onClick={(event) => {
                          event.stopPropagation()
                          closeCaptureTab(captureTab.id)
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter' && event.key !== ' ') return
                          event.preventDefault()
                          event.stopPropagation()
                          closeCaptureTab(captureTab.id)
                        }}
                      >
                        <X size={13} />
                      </span>
                    )}
                  </div>
                ))}
                <button title="New live view tab" onClick={openLiveViewTab}><Plus size={15} /></button>
              </div>
              <div className="pane-heading">
                <span>{activeCaptureTab.title}</span>
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
                  <button
                    className={status.capturePaused ? 'capture-pause active' : 'capture-pause'}
                    title={status.capturePaused ? 'Resume capture logging' : 'Pause capture logging'}
                    onClick={() => void toggleCapturePaused()}
                  >
                    {status.capturePaused ? <Play size={15} /> : <Pause size={15} />}
                  </button>
                  <button title="Snapshot filtered captures" onClick={openSnapshotTab} disabled={filteredCaptures.length === 0}><Clock3 size={15} /></button>
                  <button title="Save HAR" onClick={() => void exportHar()} disabled={tabCaptures.length === 0}><FileUp size={15} /></button>
                  <button title="Import HAR" onClick={() => void importHar()}><FileDown size={15} /></button>
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
                            title={`App Browser only (${tabCaptures.filter((capture) => capture.source === 'browser').length})`}
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
                <div
                  ref={captureTableRef}
                  className="capture-table"
                  onScroll={(event) => setCaptureTableScrollTop(event.currentTarget.scrollTop)}
                >
                  <div className="capture-table-spacer" style={{ height: visibleCaptureWindow.totalHeight }}>
                    <div className="capture-rows-virtual" style={{ transform: `translateY(${visibleCaptureWindow.offsetTop}px)` }}>
                      {visibleCaptureWindow.captures.map((capture) => (
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
                          <img className="capture-favicon" src={faviconUrl(capture.url)} alt="" loading="lazy" />
                          <span className="url-cell">{capture.url}</span>
                          <span>{capture.responseStatusCode || '-'}</span>
                          <span>{capture.durationMs}ms</span>
                          <span>{formatBytes(capture.responseSize)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
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
                  <label className="detail-search">
                    <Search size={14} />
                    <input
                      value={detailSearch}
                      placeholder="Search details"
                      onChange={(event) => setDetailSearch(event.target.value)}
                    />
                    {detailSearch.trim() && <span>{detailSearchCount}</span>}
                    {detailSearch && (
                      <button title="Clear detail search" onClick={() => setDetailSearch('')}>
                        <X size={13} />
                      </button>
                    )}
                  </label>
                </div>
                {tab === 'headers' && (
                  <HeadersPanel
                    exchange={selected}
                    mode={headerMode}
                    onModeChange={setHeaderMode}
                    searchQuery={detailSearch}
                  />
                )}
                {tab === 'body' && (
                  <BodyViewer
                    value={selected.requestBody || '(empty request body)'}
                    base64={selected.requestBodyBase64}
                    contentType={selected.requestHeaders['content-type']}
                    searchQuery={detailSearch}
                  />
                )}
                {tab === 'response' && (
                  <BodyViewer
                    value={selected.responseBody || '(empty response body)'}
                    base64={selected.responseBodyBase64}
                    contentType={selected.responseHeaders['content-type']}
                    searchQuery={detailSearch}
                  />
                )}
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
                    onContextMenu={(event) => {
                      event.preventDefault()
                      setSelectedCollectionId(collection.id)
                      setCollectionContextMenu({ collection, x: event.clientX, y: event.clientY })
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
                            openSavedApi(api)
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
                <div className="api-tab-bar">
                  {openSavedApis.map((api) => (
                    <div
                      key={api.id}
                      className={[
                        'api-tab',
                        selectedSavedApi.id === api.id ? 'active' : '',
                        draggingSavedApiId === api.id ? 'dragging' : ''
                      ].filter(Boolean).join(' ')}
                      draggable
                      role="button"
                      tabIndex={0}
                      onDragStart={(event) => {
                        setDraggingSavedApiId(api.id)
                        event.dataTransfer.effectAllowed = 'move'
                        event.dataTransfer.setData('text/plain', api.id)
                      }}
                      onDragOver={(event) => {
                        event.preventDefault()
                        const sourceId = draggingSavedApiId || event.dataTransfer.getData('text/plain')
                        if (sourceId) moveSavedApiTab(sourceId, api.id)
                      }}
                      onDrop={(event) => {
                        event.preventDefault()
                        const sourceId = draggingSavedApiId || event.dataTransfer.getData('text/plain')
                        if (sourceId) moveSavedApiTab(sourceId, api.id)
                        setDraggingSavedApiId(undefined)
                      }}
                      onDragEnd={() => setDraggingSavedApiId(undefined)}
                      onClick={() => {
                        setSelectedSavedApiId(api.id)
                        setSelectedCollectionId(api.collectionId)
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter' && event.key !== ' ') return
                        event.preventDefault()
                        setSelectedSavedApiId(api.id)
                        setSelectedCollectionId(api.collectionId)
                      }}
                    >
                      <span className={`method ${api.exchange.method.toLowerCase()}`}>{api.exchange.method}</span>
                      <strong>{api.name}</strong>
                      <span
                        className="api-tab-close"
                        role="button"
                        tabIndex={0}
                        title="Close tab"
                        onClick={(event) => {
                          event.stopPropagation()
                          closeSavedApiTab(api.id)
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter' && event.key !== ' ') return
                          event.preventDefault()
                          event.stopPropagation()
                          closeSavedApiTab(api.id)
                        }}
                      >
                        <X size={13} />
                      </span>
                    </div>
                  ))}
                </div>
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
                        <button className={responseTab === 'diff' ? 'active' : ''} onClick={() => setResponseTab('diff')}>Diff</button>
                        <button className={responseTab === 'metrics' ? 'active' : ''} onClick={() => setResponseTab('metrics')}>Metrics</button>
                        <strong>{testResult ? `${testResult.status}` : '-'}</strong>
                      </div>
                      {testError && <div className="test-error">{testError}</div>}
                      {testResult ? (
                        <>
                          {responseTab === 'headers' && <HeadersTable headers={testResult.headers} />}
                          {responseTab === 'body' && (
                            <BodyViewer
                              value={testResult.body || '(empty response body)'}
                              base64={testResult.bodyBase64}
                              contentType={testResult.headers['content-type']}
                            />
                          )}
                          {responseTab === 'diff' && (
                            <JsonDiffViewer
                              before={selectedSavedApi.exchange.responseBody}
                              after={testResult.body}
                              beforeBase64={selectedSavedApi.exchange.responseBodyBase64}
                              afterBase64={testResult.bodyBase64}
                            />
                          )}
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

      {captureTabContextMenu && (
        <div className="context-menu-backdrop" onMouseDown={() => setCaptureTabContextMenu(undefined)}>
          <div
            className="capture-context-menu"
            style={{ left: captureTabContextMenu.x, top: captureTabContextMenu.y }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              onClick={() => {
                duplicateCaptureTab(captureTabContextMenu.tab)
                setCaptureTabContextMenu(undefined)
              }}
            >
              複製
            </button>
            <button
              onClick={() => {
                openRenameCaptureTab(captureTabContextMenu.tab)
                setCaptureTabContextMenu(undefined)
              }}
            >
              名前変更
            </button>
            {captureTabContextMenu.tab.id !== 'live' && (
              <button
                onClick={() => {
                  closeCaptureTab(captureTabContextMenu.tab.id)
                  setCaptureTabContextMenu(undefined)
                }}
              >
                閉じる
              </button>
            )}
          </div>
        </div>
      )}

      {collectionContextMenu && (
        <div className="context-menu-backdrop" onMouseDown={() => setCollectionContextMenu(undefined)}>
          <div
            className="capture-context-menu"
            style={{ left: collectionContextMenu.x, top: collectionContextMenu.y }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              onClick={() => {
                openCollectionSettings(collectionContextMenu.collection)
                setCollectionContextMenu(undefined)
              }}
            >
              設定
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
              </>
            )}
          </section>
        </section>
      )}

      {renameCaptureTabTarget && (
        <div className="modal-backdrop" onMouseDown={() => setRenameCaptureTabTarget(undefined)}>
          <section className="save-dialog rename-tab-dialog" role="dialog" aria-modal="true" aria-labelledby="rename-tab-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="save-dialog-header">
              <div>
                <strong id="rename-tab-title">Rename Tab</strong>
                <span>{renameCaptureTabTarget.title}</span>
              </div>
              <button title="Close" onClick={() => setRenameCaptureTabTarget(undefined)}><X size={16} /></button>
            </div>
            <div className="save-dialog-body">
              <label>
                <span>Name</span>
                <input
                  value={renameCaptureTabName}
                  onChange={(event) => setRenameCaptureTabName(event.target.value)}
                  autoFocus
                />
              </label>
            </div>
            <div className="save-dialog-actions">
              <button onClick={() => setRenameCaptureTabTarget(undefined)}>Cancel</button>
              <button className="primary-action" onClick={renameCaptureTab}>Rename</button>
            </div>
          </section>
        </div>
      )}

      {collectionSettingsTarget && (
        <div className="modal-backdrop" onMouseDown={() => setCollectionSettingsTarget(undefined)}>
          <section className="save-dialog collection-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="collection-settings-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="save-dialog-header">
              <div>
                <strong id="collection-settings-title">{collectionSettingsTarget.name} Settings</strong>
                <span>Use variables with {'{{ name }}'} inside URL, headers, cookies, and body.</span>
              </div>
              <button title="Close" onClick={() => setCollectionSettingsTarget(undefined)}><X size={16} /></button>
            </div>
            <div className="collection-settings-layout">
              <aside className="collection-settings-tabs">
                {collectionSettingsTabs.map((item) => (
                  <button
                    key={item.id}
                    className={collectionSettingsTab === item.id ? 'settings-category active' : 'settings-category'}
                    onClick={() => setCollectionSettingsTab(item.id)}
                  >
                    <strong>{item.label}</strong>
                  </button>
                ))}
              </aside>
              <div className="collection-settings-page">
                {collectionSettingsTab === 'variables' && (
                  <>
                    <div className="collection-settings-page-title">
                      <strong>Variables</strong>
                      <span>Use values like {'{{ token }}'} or {'{{ baseUrl }}'} in URLs, query parameters, headers, cookies, and body.</span>
                    </div>
                    <KeyValueEditor title="Variables" rows={collectionVariableRows} keyPlaceholder="name" valuePlaceholder="Value" onChange={setCollectionVariableRows} />
                  </>
                )}
                {collectionSettingsTab === 'headers' && (
                  <>
                    <div className="collection-settings-page-title">
                      <strong>Common Headers</strong>
                      <span>These headers are added before each request. Per-request headers with the same name take priority.</span>
                    </div>
                    <KeyValueEditor title="Headers" rows={collectionHeaderRows} keyPlaceholder="Header" valuePlaceholder="Value" onChange={setCollectionHeaderRows} />
                  </>
                )}
                {collectionSettingsTab === 'cookies' && (
                  <>
                    <div className="collection-settings-page-title">
                      <strong>Common Cookies</strong>
                      <span>Cookies are joined into the Cookie header and can also use variables.</span>
                    </div>
                    <KeyValueEditor title="Cookies" rows={collectionCookieRows} keyPlaceholder="Cookie" valuePlaceholder="Value" onChange={setCollectionCookieRows} />
                  </>
                )}
                {collectionSettingsTab === 'user-agent' && (
                  <>
                    <div className="collection-settings-page-title inline">
                      <div>
                        <strong>User-Agent</strong>
                        <span>Override the User-Agent for every request in this collection.</span>
                      </div>
                      <button className={collectionUaEnabled ? 'system-proxy-toggle active' : 'system-proxy-toggle'} onClick={() => setCollectionUaEnabled((current) => !current)}>
                        {collectionUaEnabled ? 'ON' : 'OFF'}
                      </button>
                    </div>
                    <section className="ua-settings">
                      <div className="ua-controls">
                        <label>
                          Preset
                          <select
                            value={collectionUaPreset}
                            onChange={(event) => {
                              const preset = userAgentPresets.find((item) => item.id === event.target.value)
                              setCollectionUaPreset(event.target.value)
                              if (event.target.value === 'custom') {
                                setCollectionUaEnabled(true)
                                return
                              }
                              setCollectionUaEnabled(event.target.value !== 'none')
                              setCollectionUaValue(preset?.value || '')
                            }}
                          >
                            {userAgentPresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
                            <option value="custom">Custom</option>
                          </select>
                        </label>
                        <label>
                          Value
                          <textarea
                            value={collectionUaValue}
                            disabled={!collectionUaEnabled && collectionUaPreset !== 'custom'}
                            onChange={(event) => {
                              setCollectionUaPreset('custom')
                              setCollectionUaEnabled(true)
                              setCollectionUaValue(event.target.value)
                            }}
                            placeholder="User-Agent"
                          />
                        </label>
                      </div>
                    </section>
                  </>
                )}
              </div>
            </div>
            <div className="save-dialog-actions">
              <button onClick={() => setCollectionSettingsTarget(undefined)}>Cancel</button>
              <button className="primary-action" onClick={() => void saveCollectionSettings()}>Save Settings</button>
            </div>
          </section>
        </div>
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
      {focusHint && (
        <div
          className="focus-hint"
          role="tooltip"
          style={{ left: focusHint.x, top: focusHint.y }}
        >
          {focusHint.text}
        </div>
      )}
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
  for (const [key, value] of Object.entries(theme.colors)) {
    root.style.setProperty(`--theme-${kebabCase(key)}`, value)
  }
  for (const [method, value] of Object.entries(theme.methods)) {
    root.style.setProperty(`--theme-method-${method}-text`, value.text)
    root.style.setProperty(`--theme-method-${method}-background`, value.background)
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
  onModeChange,
  searchQuery
}: {
  exchange: CapturedExchange
  mode: HeaderMode
  onModeChange: (mode: HeaderMode) => void
  searchQuery: string
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
        <CodeBlock value={headersView(exchange)} language="json" searchQuery={searchQuery} />
      ) : (
        <div className="headers-table-scroll">
          <HeaderSection
            title="Request Headers"
            summary={`${exchange.method} ${exchange.url}`}
            headers={exchange.requestHeaders}
            searchQuery={searchQuery}
          />
          <HeaderSection
            title="Response Headers"
            summary={`${exchange.responseStatusCode || '-'} ${exchange.responseStatusMessage || ''}`.trim()}
            headers={exchange.responseHeaders}
            searchQuery={searchQuery}
          />
        </div>
      )}
    </div>
  )
}

function HeaderSection({
  title,
  summary,
  headers,
  searchQuery
}: {
  title: string
  summary: string
  headers: CapturedExchange['requestHeaders']
  searchQuery: string
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
            <code role="cell"><HighlightedText value={name} query={searchQuery} /></code>
            <span role="cell"><HighlightedText value={headerValueToString(value)} query={searchQuery} /></span>
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

function CaptureTabIcon({ kind }: { kind: CaptureTabKind }): JSX.Element {
  if (kind === 'snapshot') return <Clock3 size={15} />
  if (kind === 'har') return <FileDown size={15} />
  return <RadioTower size={15} />
}

function JsonDiffViewer({
  before,
  after,
  beforeBase64,
  afterBase64
}: {
  before: string
  after: string
  beforeBase64?: string
  afterBase64?: string
}): JSX.Element {
  const diff = useMemo(() => buildJsonDiff(before, after, Boolean(beforeBase64 || afterBase64)), [after, afterBase64, before, beforeBase64])

  if (!diff.ok) {
    return <div className="empty-state compact">{diff.message}</div>
  }

  return (
    <div className="json-diff-viewer">
      <div className="json-diff-summary">
        <span>Saved response</span>
        <strong>{diff.changed ? `${diff.added} added / ${diff.removed} removed` : 'No JSON changes'}</strong>
        <span>Latest response</span>
      </div>
      <pre className="json-diff-code" aria-label="JSON diff">
        <code>
          {diff.lines.map((line, index) => (
            <span key={`${line.type}-${index}`} className={`json-diff-line ${line.type}`}>
              <span className="json-diff-sign">{line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}</span>
              <span>{line.value || ' '}</span>
            </span>
          ))}
        </code>
      </pre>
    </div>
  )
}

function BodyViewer({
  value,
  base64,
  contentType,
  searchQuery = ''
}: {
  value: string
  base64?: string
  contentType?: string | string[]
  searchQuery?: string
}): JSX.Element {
  if (base64) return <BinaryViewer base64={base64} contentType={contentType} fallbackLabel={value} searchQuery={searchQuery} />
  const formattedValue = formatBodyForDisplay(value, contentType)
  return <CodeBlock value={formattedValue} language={languageFromBody(formattedValue, contentType)} searchQuery={searchQuery} />
}

function BinaryViewer({
  base64,
  contentType,
  fallbackLabel,
  searchQuery
}: {
  base64: string
  contentType?: string | string[]
  fallbackLabel: string
  searchQuery: string
}): JSX.Element {
  const bytes = useMemo(() => bytesFromBase64(base64), [base64])
  const rows = useMemo(() => makeHexRows(bytes), [bytes])
  const normalizedContentType = Array.isArray(contentType) ? contentType.join(', ') : contentType || 'application/octet-stream'
  const imageContentType = imageMimeType(contentType)
  const imageSrc = imageContentType ? `data:${imageContentType};base64,${base64}` : undefined

  if (!bytes) return <CodeBlock value={fallbackLabel} language="plaintext" />

  return (
    <div className="binary-viewer">
      <div className="binary-toolbar">
        <strong>{imageSrc ? 'Image' : 'Binary'}</strong>
        <span>{formatBytes(bytes.length)}</span>
        <span>{normalizedContentType}</span>
      </div>
      {imageSrc && (
        <div className="image-preview">
          <img src={imageSrc} alt="Captured binary image preview" />
        </div>
      )}
      <div className="binary-table" role="table" aria-label="Binary body hex view">
        <div className="binary-row binary-heading" role="row">
          <span>Offset</span>
          <span>Hex</span>
          <span>ASCII</span>
        </div>
        {rows.map((row) => (
          <div className="binary-row" role="row" key={row.offset}>
            <code className="binary-offset">{row.offset}</code>
            <code className="binary-hex"><HighlightedText value={row.hex} query={searchQuery} /></code>
            <code className="binary-ascii"><HighlightedText value={row.ascii} query={searchQuery} /></code>
          </div>
        ))}
      </div>
    </div>
  )
}

function imageMimeType(contentType?: string | string[]): string | undefined {
  const normalized = Array.isArray(contentType) ? contentType.join(';').toLowerCase() : (contentType || '').toLowerCase()
  const match = normalized.match(/image\/(?:png|jpe?g|gif|webp|avif|bmp|svg\+xml|x-icon|vnd\.microsoft\.icon)/)
  if (!match) return undefined
  if (match[0] === 'image/jpg') return 'image/jpeg'
  if (match[0] === 'image/x-icon' || match[0] === 'image/vnd.microsoft.icon') return 'image/x-icon'
  return match[0]
}

function CodeBlock({ value, language, searchQuery = '' }: { value: string; language?: CodeLanguage; searchQuery?: string }): JSX.Element {
  const highlighted = useMemo(() => highlightCode(value, language, searchQuery), [value, language, searchQuery])

  return (
    <pre className="code-block">
      <code
        className={`hljs language-${highlighted.language}`}
        dangerouslySetInnerHTML={{ __html: highlighted.html }}
      />
    </pre>
  )
}

function bytesFromBase64(value: string): Uint8Array | undefined {
  try {
    const binary = atob(value)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index)
    }
    return bytes
  } catch {
    return undefined
  }
}

function makeHexRows(bytes: Uint8Array | undefined): Array<{ offset: string; hex: string; ascii: string }> {
  if (!bytes) return []
  const rows: Array<{ offset: string; hex: string; ascii: string }> = []
  for (let offset = 0; offset < bytes.length; offset += 16) {
    const chunk = bytes.slice(offset, offset + 16)
    const hex = Array.from(chunk)
      .map((byte) => byte.toString(16).padStart(2, '0').toUpperCase())
      .join(' ')
      .padEnd(47, ' ')
    const ascii = Array.from(chunk)
      .map((byte) => (byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.'))
      .join('')
    rows.push({
      offset: offset.toString(16).padStart(8, '0').toUpperCase(),
      hex,
      ascii
    })
  }
  return rows
}

function HighlightedText({ value, query }: { value: string; query: string }): JSX.Element {
  const needle = query.trim()
  if (!needle) return <>{value}</>
  const lowerValue = value.toLowerCase()
  const lowerNeedle = needle.toLowerCase()
  const parts: JSX.Element[] = []
  let cursor = 0
  let matchIndex = lowerValue.indexOf(lowerNeedle)
  while (matchIndex !== -1) {
    if (matchIndex > cursor) parts.push(<span key={`t-${cursor}`}>{value.slice(cursor, matchIndex)}</span>)
    const end = matchIndex + needle.length
    parts.push(<mark key={`m-${matchIndex}`}>{value.slice(matchIndex, end)}</mark>)
    cursor = end
    matchIndex = lowerValue.indexOf(lowerNeedle, cursor)
  }
  if (cursor < value.length) parts.push(<span key={`t-${cursor}`}>{value.slice(cursor)}</span>)
  return <>{parts}</>
}

function highlightSearchHtml(value: string, query: string): string {
  const needle = query.trim()
  if (!needle) return escapeHtml(value)
  const lowerValue = value.toLowerCase()
  const lowerNeedle = needle.toLowerCase()
  const chunks: string[] = []
  let cursor = 0
  let matchIndex = lowerValue.indexOf(lowerNeedle)
  while (matchIndex !== -1) {
    chunks.push(escapeHtml(value.slice(cursor, matchIndex)))
    const end = matchIndex + needle.length
    chunks.push(`<mark>${escapeHtml(value.slice(matchIndex, end))}</mark>`)
    cursor = end
    matchIndex = lowerValue.indexOf(lowerNeedle, cursor)
  }
  chunks.push(escapeHtml(value.slice(cursor)))
  return chunks.join('')
}

function highlightCode(value: string, language?: CodeLanguage, searchQuery = ''): { html: string; language: CodeLanguage } {
  const detectedLanguage = language || languageFromBody(value)
  if (searchQuery.trim()) {
    return {
      html: highlightSearchHtml(value, searchQuery),
      language: 'plaintext'
    }
  }

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

function formatBodyForDisplay(value: string, contentType?: string | string[]): string {
  const normalizedContentType = Array.isArray(contentType) ? contentType.join(';').toLowerCase() : (contentType || '').toLowerCase()
  const trimmed = value.trim()
  if (!trimmed || (!normalizedContentType.includes('json') && !looksLikeJson(trimmed))) return value

  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2)
  } catch {
    return value
  }
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

type JsonDiffLine = { type: 'same' | 'added' | 'removed'; value: string }
type JsonDiffResult =
  | { ok: true; changed: boolean; added: number; removed: number; lines: JsonDiffLine[] }
  | { ok: false; message: string }

function buildJsonDiff(before: string, after: string, hasBinaryBody: boolean): JsonDiffResult {
  if (hasBinaryBody) return { ok: false, message: 'Binary responses cannot be compared as JSON.' }

  const beforeJson = parseJsonForDiff(before)
  const afterJson = parseJsonForDiff(after)
  if (!beforeJson.ok || !afterJson.ok) {
    return { ok: false, message: 'Both saved and latest responses must be valid JSON to show a diff.' }
  }

  const beforeLines = JSON.stringify(sortJsonValue(beforeJson.value), null, 2).split('\n')
  const afterLines = JSON.stringify(sortJsonValue(afterJson.value), null, 2).split('\n')
  const lines = diffLines(beforeLines, afterLines)
  const added = lines.filter((line) => line.type === 'added').length
  const removed = lines.filter((line) => line.type === 'removed').length

  return {
    ok: true,
    changed: added + removed > 0,
    added,
    removed,
    lines
  }
}

function parseJsonForDiff(value: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(value) }
  } catch {
    return { ok: false }
  }
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJsonValue)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, sortJsonValue(entry)])
  )
}

function diffLines(beforeLines: string[], afterLines: string[]): JsonDiffLine[] {
  const lengths: number[][] = Array.from({ length: beforeLines.length + 1 }, () => Array(afterLines.length + 1).fill(0))

  for (let beforeIndex = beforeLines.length - 1; beforeIndex >= 0; beforeIndex -= 1) {
    for (let afterIndex = afterLines.length - 1; afterIndex >= 0; afterIndex -= 1) {
      lengths[beforeIndex][afterIndex] = beforeLines[beforeIndex] === afterLines[afterIndex]
        ? lengths[beforeIndex + 1][afterIndex + 1] + 1
        : Math.max(lengths[beforeIndex + 1][afterIndex], lengths[beforeIndex][afterIndex + 1])
    }
  }

  const lines: JsonDiffLine[] = []
  let beforeIndex = 0
  let afterIndex = 0
  while (beforeIndex < beforeLines.length && afterIndex < afterLines.length) {
    if (beforeLines[beforeIndex] === afterLines[afterIndex]) {
      lines.push({ type: 'same', value: beforeLines[beforeIndex] })
      beforeIndex += 1
      afterIndex += 1
    } else if (lengths[beforeIndex + 1][afterIndex] >= lengths[beforeIndex][afterIndex + 1]) {
      lines.push({ type: 'removed', value: beforeLines[beforeIndex] })
      beforeIndex += 1
    } else {
      lines.push({ type: 'added', value: afterLines[afterIndex] })
      afterIndex += 1
    }
  }

  while (beforeIndex < beforeLines.length) {
    lines.push({ type: 'removed', value: beforeLines[beforeIndex] })
    beforeIndex += 1
  }
  while (afterIndex < afterLines.length) {
    lines.push({ type: 'added', value: afterLines[afterIndex] })
    afterIndex += 1
  }

  return lines
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

function detailSearchText(exchange: CapturedExchange, tab: DetailTab, headerMode: HeaderMode): string {
  if (tab === 'headers') return headerMode === 'raw' ? headersView(exchange) : [
    exchange.method,
    exchange.url,
    headerTableSearchText(exchange.requestHeaders),
    exchange.responseStatusCode,
    exchange.responseStatusMessage,
    headerTableSearchText(exchange.responseHeaders)
  ].join('\n')
  if (tab === 'body') return bodySearchText(exchange.requestBody, exchange.requestBodyBase64)
  return bodySearchText(exchange.responseBody, exchange.responseBodyBase64)
}

function headerTableSearchText(headers: CapturedExchange['requestHeaders']): string {
  return Object.entries(headers)
    .map(([key, value]) => `${key}: ${headerValueToString(value)}`)
    .join('\n')
}

function bodySearchText(value: string, base64?: string): string {
  if (!base64) return value
  const rows = makeHexRows(bytesFromBase64(base64))
  return [
    value,
    ...rows.map((row) => `${row.offset} ${row.hex} ${row.ascii}`)
  ].join('\n')
}

function countOccurrences(value: string, query: string): number {
  const needle = query.trim().toLowerCase()
  if (!needle) return 0
  const haystack = value.toLowerCase()
  let count = 0
  let cursor = haystack.indexOf(needle)
  while (cursor !== -1) {
    count += 1
    cursor = haystack.indexOf(needle, cursor + needle.length)
  }
  return count
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

function mapToRows(values: Record<string, string> | undefined): KeyValueRow[] {
  return objectToRows(values || {})
}

function rowsToObject(rows: KeyValueRow[]): Record<string, string> {
  return Object.fromEntries(rows.filter((row) => row.enabled && row.key.trim()).map((row) => [row.key.trim(), row.value]))
}

function applyVariablesToRows(rows: KeyValueRow[], variables: Record<string, string>): KeyValueRow[] {
  return rows.map((row) => ({
    ...row,
    key: expandVariables(row.key, variables),
    value: expandVariables(row.value, variables)
  }))
}

function expandVariables(value: string, variables: Record<string, string>): string {
  return value.replace(/\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g, (match, name: string) => (
    Object.prototype.hasOwnProperty.call(variables, name) ? variables[name] : match
  ))
}

function buildCollectionHeaders(settings: CollectionSettings, requestHeaders: Record<string, string>): Record<string, string> {
  const variables = settings.variables || {}
  const headers = {
    ...expandRecord(settings.headers || {}, variables),
    ...requestHeaders
  }
  const commonCookie = cookieRecordToHeader(expandRecord(settings.cookies || {}, variables))
  if (commonCookie) {
    const cookieKey = Object.keys(headers).find((key) => key.toLowerCase() === 'cookie') || 'Cookie'
    headers[cookieKey] = headers[cookieKey] ? `${commonCookie}; ${headers[cookieKey]}` : commonCookie
  }
  if (settings.userAgent.enabled && settings.userAgent.value.trim()) {
    const userAgentKey = Object.keys(headers).find((key) => key.toLowerCase() === 'user-agent') || 'User-Agent'
    headers[userAgentKey] = expandVariables(settings.userAgent.value.trim(), variables)
  }
  return headers
}

function expandRecord(values: Record<string, string>, variables: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [expandVariables(key, variables), expandVariables(value, variables)]))
}

function cookieRecordToHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .filter(([key]) => key.trim())
    .map(([key, value]) => `${key.trim()}=${value}`)
    .join('; ')
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

function faviconUrl(url: string): string {
  try {
    const parsed = new URL(url)
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(parsed.hostname)}&sz=32`
  } catch {
    return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='
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

function captureMatchesQuery(capture: CapturedExchange, tokens: string[]): boolean {
  const haystack = [
    capture.method,
    capture.url,
    normalizeUrlForSearch(capture.url),
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
  ].join('\n').toLowerCase()
  return tokens.every((token) => haystack.includes(token))
}

function searchTokens(value: string): string[] {
  return normalizeSearchText(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
}

function normalizeSearchText(value: string): string {
  return [value, decodeUriSafe(value), stripUrlProtocol(value), stripUrlProtocol(decodeUriSafe(value))]
    .join(' ')
    .toLowerCase()
}

function normalizeUrlForSearch(url: string): string {
  try {
    const parsed = new URL(url)
    const decodedUrl = decodeUriSafe(url)
    const path = `${parsed.pathname}${parsed.search}${parsed.hash}`
    return [
      url,
      decodedUrl,
      stripUrlProtocol(url),
      parsed.hostname,
      parsed.host,
      path,
      decodeUriSafe(path)
    ].join('\n')
  } catch {
    return [url, decodeUriSafe(url), stripUrlProtocol(url)].join('\n')
  }
}

function stripUrlProtocol(value: string): string {
  return value.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
}

function decodeUriSafe(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
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
