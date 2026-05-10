import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { resolveStealDataDir } from './app-data'
import { McpBridgeClient } from './mcp-bridge'
import { ProxyService } from './proxy-service'
import { replayRequest } from './replay'
import { SettingsStore } from './settings-store'
import { SavedApiStore } from './storage'
import { WorkspaceStore } from './workspace-store'
import type { AppSettings, CapturedExchange, ProxyStatus, SavedApi, SavedCollection, WorkspaceSnapshot, WorkspaceState } from '../shared/types'

const serverInfo = {
  name: 'steal-mcp',
  version: '0.1.0'
}

const dataDir = resolveStealDataDir()
mkdirSync(dataDir, { recursive: true })

const proxyService = new ProxyService(dataDir)
const settingsStore = new SettingsStore(join(dataDir, 'settings.json'))
const savedApiStore = new SavedApiStore(join(dataDir, 'collections'))
const workspaceStore = new WorkspaceStore(join(dataDir, 'workspaces'))
const bridgeClient = new McpBridgeClient()

const server = new McpServer(serverInfo)

server.registerResource(
  'server-info',
  'steal://server',
  {
    title: 'Steal MCP server',
    description: 'Runtime information about the Steal MCP server.',
    mimeType: 'application/json'
  },
  async (uri) => jsonResource(uri.href, {
    ...serverInfo,
    dataDir,
    note: await getServerNote()
  })
)

server.registerResource(
  'settings',
  'steal://settings',
  {
    title: 'Steal settings',
    description: 'Current persisted Steal settings.',
    mimeType: 'application/json'
  },
  async (uri) => jsonResource(uri.href, await getSettingsData())
)

server.registerResource(
  'workspaces',
  'steal://workspaces',
  {
    title: 'Steal workspaces',
    description: 'Saved workspace index and last opened workspace id.',
    mimeType: 'application/json'
  },
  async (uri) => jsonResource(uri.href, await getWorkspaceStateData())
)

server.registerResource(
  'collections',
  'steal://collections',
  {
    title: 'Steal collections',
    description: 'Saved API collections and collection settings.',
    mimeType: 'application/json'
  },
  async (uri) => jsonResource(uri.href, await getCollectionsData())
)

server.registerResource(
  'saved-apis',
  'steal://saved-apis',
  {
    title: 'Saved APIs',
    description: 'All saved APIs stored by Steal.',
    mimeType: 'application/json'
  },
  async (uri) => jsonResource(uri.href, await getSavedApisData())
)

server.registerResource(
  'live-captures',
  'steal://captures/live',
  {
    title: 'Live captures',
    description: 'Captures recorded by this MCP server process during its current lifetime.',
    mimeType: 'application/json'
  },
  async (uri) => jsonResource(uri.href, await getLiveCapturesData())
)

server.registerPrompt(
  'summarize-captures',
  {
    title: 'Summarize recent captures',
    description: 'Generate a user prompt that asks the model to summarize recent captured traffic.',
    argsSchema: {
      limit: z.number().int().min(1).max(200).optional()
    }
  },
  async ({ limit }) => {
    const captures = (await getLiveCapturesData()).slice(0, limit ?? 20)
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              'Summarize the following Steal captures.',
              'Call out important endpoints, auth/cookie behavior, error responses, and anything unusual.',
              '',
              JSON.stringify(captures, null, 2)
            ].join('\n')
          }
        }
      ]
    }
  }
)

server.registerTool(
  'get_server_info',
  {
    title: 'Get Steal MCP server info',
    description: 'Return MCP server metadata and the resolved Steal data directory.'
  },
  async () => ok({
    ...serverInfo,
    dataDir,
    note: await getServerNote()
  })
)

server.registerTool(
  'get_settings',
  {
    title: 'Get Steal settings',
    description: 'Return the persisted Steal application settings.'
  },
  async () => ok(await getSettingsData())
)

server.registerTool(
  'update_settings',
  {
    title: 'Update Steal settings',
    description: 'Update persisted Steal application settings.',
    inputSchema: {
      autoStartProxy: z.boolean().optional(),
      systemProxyEnabled: z.boolean().optional(),
      autoShowBrowser: z.boolean().optional(),
      browserMode: z.enum(['embedded', 'chrome']).optional(),
      autoOpenLastWorkspace: z.boolean().optional()
    }
  },
  async (patch) => ok(await updateSettingsData(normalizeSettingsPatch(patch)))
)

server.registerTool(
  'get_proxy_status',
  {
    title: 'Get proxy status',
    description: 'Return the current proxy status for the MCP server process.'
  },
  async () => ok(await getProxyStatusData())
)

server.registerTool(
  'start_proxy',
  {
    title: 'Start proxy',
    description: 'Start Steal proxy capture inside this MCP server process. This does not change system proxy settings.'
  },
  async () => {
    try {
      return ok(await startProxyData())
    } catch (error) {
      return fail(error)
    }
  }
)

server.registerTool(
  'stop_proxy',
  {
    title: 'Stop proxy',
    description: 'Stop the Steal proxy running inside this MCP server process.'
  },
  async () => {
    try {
      return ok(await stopProxyData())
    } catch (error) {
      return fail(error)
    }
  }
)

server.registerTool(
  'set_capture_paused',
  {
    title: 'Pause or resume capture',
    description: 'Pause or resume capture collection in the MCP server process.',
    inputSchema: {
      paused: z.boolean()
    }
  },
  async ({ paused }) => ok(await setCapturePausedData(paused))
)

server.registerTool(
  'clear_captures',
  {
    title: 'Clear live captures',
    description: 'Clear captures held in memory by this MCP server process.'
  },
  async () => {
    await clearCapturesData()
    return ok({ cleared: true })
  }
)

server.registerTool(
  'list_captures',
  {
    title: 'List live captures',
    description: 'List captures held in memory by this MCP server process, with optional filtering.',
    inputSchema: {
      limit: z.number().int().min(1).max(500).optional(),
      search: z.string().optional(),
      source: z.enum(['browser', 'proxy']).optional(),
      method: z.string().optional(),
      host: z.string().optional(),
      onlyWebSocket: z.boolean().optional()
    }
  },
  async ({ limit, search, source, method, host, onlyWebSocket }) => {
    const filtered = filterCaptures(await getLiveCapturesData(), { search, source, method, host, onlyWebSocket })
    const captures = filtered.slice(0, limit ?? 50)
    return ok({
      total: filtered.length,
      items: captures
    })
  }
)

server.registerTool(
  'get_capture',
  {
    title: 'Get capture by id',
    description: 'Return a single live capture from this MCP server process.',
    inputSchema: {
      id: z.string().min(1)
    }
  },
  async ({ id }) => {
    const capture = await getCaptureData(id)
    if (!capture) return fail(`Capture not found: ${id}`)
    return ok(capture)
  }
)

server.registerTool(
  'save_capture_to_collection',
  {
    title: 'Save a live capture',
    description: 'Save a live capture from this MCP server process into a Steal collection.',
    inputSchema: {
      exchangeId: z.string().min(1),
      name: z.string().optional(),
      tags: z.array(z.string()).optional(),
      collectionName: z.string().optional()
    }
  },
  async ({ exchangeId, name, tags, collectionName }) => {
    try {
      return ok(await saveCaptureToCollectionData(exchangeId, name || '', tags || [], collectionName?.trim() || 'Default'))
    } catch (error) {
      return fail(error)
    }
  }
)

server.registerTool(
  'list_collections',
  {
    title: 'List collections',
    description: 'List saved API collections.'
  },
  async () => {
    const items = await getCollectionsData()
    return ok({
      total: items.length,
      items
    })
  }
)

server.registerTool(
  'list_saved_apis',
  {
    title: 'List saved APIs',
    description: 'List saved APIs with optional collection and search filters.',
    inputSchema: {
      collectionId: z.string().optional(),
      collectionName: z.string().optional(),
      search: z.string().optional(),
      limit: z.number().int().min(1).max(500).optional()
    }
  },
  async ({ collectionId, collectionName, search, limit }) => {
    const filtered = filterSavedApis(await getSavedApisData(), { collectionId, collectionName, search })
    const items = filtered.slice(0, limit ?? 100)
    return ok({
      total: filtered.length,
      items
    })
  }
)

server.registerTool(
  'get_saved_api',
  {
    title: 'Get saved API',
    description: 'Return one saved API by id.',
    inputSchema: {
      id: z.string().min(1)
    }
  },
  async ({ id }) => {
    const api = await getSavedApiData(id)
    if (!api) return fail(`Saved API not found: ${id}`)
    return ok(api)
  }
)

server.registerTool(
  'list_workspaces',
  {
    title: 'List workspaces',
    description: 'List saved Steal workspaces.'
  },
  async () => ok(await getWorkspaceStateData())
)

server.registerTool(
  'load_workspace',
  {
    title: 'Load workspace snapshot',
    description: 'Load a saved workspace snapshot by id.',
    inputSchema: {
      workspaceId: z.string().min(1)
    }
  },
  async ({ workspaceId }) => {
    try {
      return ok(await loadWorkspaceData(workspaceId))
    } catch (error) {
      return fail(error)
    }
  }
)

server.registerTool(
  'replay_request',
  {
    title: 'Replay a request',
    description: 'Send a one-off HTTP request and return the decoded response.',
    inputSchema: {
      method: z.string().min(1),
      url: z.string().url(),
      headers: z.record(z.string(), z.string()).optional(),
      body: z.string().optional()
    }
  },
  async ({ method, url, headers, body }) => {
    try {
      return ok(await replayRequest({
        method,
        url,
        headers: headers || {},
        body: body || ''
      }))
    } catch (error) {
      return fail(error)
    }
  }
)

async function main(): Promise<void> {
  await proxyService.hydrateSharedCaptures()
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

void main().catch((error) => {
  process.stderr.write(`${formatError(error)}\n`)
  process.exitCode = 1
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void shutdown()
  })
}

let shuttingDown = false

async function shutdown(): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true
  try {
    await proxyService.stop().catch(() => undefined)
    await server.close().catch(() => undefined)
  } finally {
    process.exit(0)
  }
}

function jsonResource(uri: string, value: unknown): { contents: Array<{ uri: string; mimeType: string; text: string }> } {
  return {
    contents: [
      {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(value, null, 2)
      }
    ]
  }
}

function ok<T>(value: T): { content: Array<{ type: 'text'; text: string }>; structuredContent: T } {
  return {
    content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    structuredContent: value
  }
}

function fail(error: unknown): { content: Array<{ type: 'text'; text: string }>; isError: true } {
  return {
    content: [{ type: 'text', text: formatError(error) }],
    isError: true
  }
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function normalizeSettingsPatch(patch: Partial<AppSettings>): Partial<AppSettings> {
  return Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)) as Partial<AppSettings>
}

async function getServerNote(): Promise<string> {
  return (await bridgeClient.isAvailable())
    ? 'Using the GUI bridge when Steal is open; otherwise falls back to local MCP process state.'
    : 'Steal GUI bridge not detected; using local MCP process state.'
}

async function getSettingsData(): Promise<AppSettings> {
  return bridgeCall('getSettings', undefined, () => settingsStore.get())
}

async function updateSettingsData(patch: Partial<AppSettings>): Promise<AppSettings> {
  return bridgeCall('updateSettings', patch, () => settingsStore.update(patch))
}

async function getProxyStatusData(): Promise<ProxyStatus> {
  return bridgeCall('getProxyStatus', undefined, () => Promise.resolve(proxyService.getStatus()))
}

async function startProxyData(): Promise<ProxyStatus> {
  return bridgeCall('startProxy', undefined, () => proxyService.start())
}

async function stopProxyData(): Promise<ProxyStatus> {
  return bridgeCall('stopProxy', undefined, () => proxyService.stop())
}

async function setCapturePausedData(paused: boolean): Promise<ProxyStatus> {
  return bridgeCall('setCapturePaused', { paused }, () => Promise.resolve(proxyService.setCapturePaused(paused)))
}

async function clearCapturesData(): Promise<void> {
  await bridgeCall('clearCaptures', undefined, async () => {
    proxyService.clearCaptures()
    return { cleared: true }
  })
}

async function getLiveCapturesData(): Promise<CapturedExchange[]> {
  return bridgeCall('listCaptures', undefined, async () => {
    await proxyService.syncSharedCaptures().catch(() => undefined)
    return proxyService.getCaptures()
  })
}

async function getCaptureData(id: string): Promise<CapturedExchange | undefined> {
  return bridgeCall('getCapture', { id }, async () => {
    await proxyService.syncSharedCaptures().catch(() => undefined)
    return proxyService.findCapture(id)
  })
}

async function saveCaptureToCollectionData(exchangeId: string, name: string, tags: string[], collectionName: string): Promise<SavedApi> {
  return bridgeCall('saveCaptureToCollection', { exchangeId, name, tags, collectionName }, async () => {
    await proxyService.syncSharedCaptures().catch(() => undefined)
    const capture = proxyService.findCapture(exchangeId)
    if (!capture) throw new Error(`Capture not found: ${exchangeId}`)
    return savedApiStore.save(capture, name, tags, collectionName)
  })
}

async function getCollectionsData(): Promise<SavedCollection[]> {
  return bridgeCall('listCollections', undefined, () => savedApiStore.listCollections())
}

async function getSavedApisData(): Promise<SavedApi[]> {
  return bridgeCall('listSavedApis', undefined, () => savedApiStore.list())
}

async function getSavedApiData(id: string): Promise<SavedApi | undefined> {
  return bridgeCall('getSavedApi', { id }, async () => {
    const items = await savedApiStore.list()
    return items.find((item) => item.id === id)
  })
}

async function getWorkspaceStateData(): Promise<WorkspaceState> {
  return bridgeCall('listWorkspaces', undefined, () => workspaceStore.getState())
}

async function loadWorkspaceData(workspaceId: string): Promise<WorkspaceSnapshot> {
  return bridgeCall('loadWorkspace', { workspaceId }, () => workspaceStore.load(workspaceId))
}

async function bridgeCall<T>(method: string, params: unknown, fallback: () => Promise<T>): Promise<T> {
  try {
    return await bridgeClient.call<T>(method, params)
  } catch {
    return fallback()
  }
}

function filterCaptures(
  captures: CapturedExchange[],
  filters: {
    search?: string
    source?: 'browser' | 'proxy'
    method?: string
    host?: string
    onlyWebSocket?: boolean
  }
): CapturedExchange[] {
  const needle = filters.search?.trim().toLowerCase()
  const normalizedMethod = filters.method?.trim().toLowerCase()
  const normalizedHost = filters.host?.trim().toLowerCase()

  return captures.filter((capture) => {
    if (filters.source && capture.source !== filters.source) return false
    if (normalizedMethod && capture.method.toLowerCase() !== normalizedMethod) return false
    if (normalizedHost && !capture.host.toLowerCase().includes(normalizedHost)) return false
    if (filters.onlyWebSocket && !capture.isWebSocket) return false
    if (!needle) return true

    const haystack = [
      capture.method,
      capture.url,
      capture.host,
      capture.path,
      capture.requestBody,
      capture.responseBody,
      JSON.stringify(capture.requestHeaders),
      JSON.stringify(capture.responseHeaders)
    ].join('\n').toLowerCase()
    return haystack.includes(needle)
  })
}

function filterSavedApis(
  items: SavedApi[],
  filters: {
    collectionId?: string
    collectionName?: string
    search?: string
  }
): SavedApi[] {
  const needle = filters.search?.trim().toLowerCase()
  const normalizedCollectionName = filters.collectionName?.trim().toLowerCase()

  return items.filter((item) => {
    if (filters.collectionId && item.collectionId !== filters.collectionId) return false
    if (normalizedCollectionName && item.collectionName.toLowerCase() !== normalizedCollectionName) return false
    if (!needle) return true
    const haystack = [
      item.name,
      item.collectionName,
      item.exchange.method,
      item.exchange.url,
      item.exchange.requestBody,
      item.exchange.responseBody,
      item.tags.join(' ')
    ].join('\n').toLowerCase()
    return haystack.includes(needle)
  })
}
