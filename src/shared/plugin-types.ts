import type { CapturedExchange, ReplayRequest, ReplayResult } from './types'

export interface PluginPanel {
  id: string
  title: string
  position: 'sidebar' | 'main'
  render: (props: PluginPanelProps) => JSX.Element
}

export interface PluginMenuItem {
  id: string
  label: string
  icon?: string
  onClick: () => void
}

export interface PluginPanelProps {
  captures: CapturedExchange[]
  selectedCapture?: CapturedExchange
  onCaptureSelect: (id: string) => void
}

export interface StealPlugin {
  name: string
  version: string
  description?: string
  author?: string
  enabled?: boolean
  
  onLoad?: (api: StealPluginAPI) => void | Promise<void>
  onUnload?: () => void | Promise<void>
  
  filters?: {
    [name: string]: (capture: CapturedExchange) => boolean
  }
  
  processors?: {
    onRequest?: (request: ReplayRequest) => ReplayRequest
    onResponse?: (response: ReplayResult) => ReplayResult
  }
  
  ui?: {
    panels?: PluginPanel[]
    menuItems?: PluginMenuItem[]
  }
  
  exporters?: {
    [name: string]: (captures: CapturedExchange[]) => string | Buffer
  }
}

export interface StealPluginAPI {
  getCaptures: () => CapturedExchange[]
  getSelectedCapture: () => CapturedExchange | undefined
  showMessage: (message: string) => void
  showDialog: (options: PluginDialogOptions) => Promise<boolean>
  fetch: (url: string, options?: RequestInit) => Promise<Response>
  readFile: (path: string) => Promise<string>
  writeFile: (path: string, content: string) => Promise<void>
}

export interface PluginDialogOptions {
  title?: string
  message: string
  type?: 'none' | 'info' | 'error' | 'question' | 'warning'
  buttons?: string[]
}

export interface PluginManager {
  loadPlugin: (path: string) => Promise<StealPlugin>
  unloadPlugin: (name: string) => Promise<void>
  getPlugins: () => StealPlugin[]
  getPlugin: (name: string) => StealPlugin | undefined
  enablePlugin: (name: string) => void
  disablePlugin: (name: string) => void
}

export interface PluginFilter {
  name: string
  pluginName: string
  filter: (capture: CapturedExchange) => boolean
}

export interface PluginExporter {
  name: string
  pluginName: string
  export: (captures: CapturedExchange[]) => string | Buffer
}

export interface PluginProcessor {
  pluginName: string
  onRequest?: (request: ReplayRequest) => ReplayRequest
  onResponse?: (response: ReplayResult) => ReplayResult
}
