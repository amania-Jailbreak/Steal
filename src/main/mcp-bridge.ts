import { randomUUID } from 'node:crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { mkdirSync } from 'node:fs'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { resolveStealBridgeFilePath } from './app-data'

type BridgeHandler = (params: unknown) => Promise<unknown> | unknown

type BridgeMetadata = {
  port: number
  token: string
  pid: number
}

export class McpBridgeServer {
  private server?: Server
  private readonly token = randomUUID()
  private readonly handlers = new Map<string, BridgeHandler>()

  constructor(private readonly bridgeFilePath: string) {
    mkdirSync(dirname(bridgeFilePath), { recursive: true })
  }

  register(method: string, handler: BridgeHandler): void {
    this.handlers.set(method, handler)
  }

  async start(): Promise<void> {
    if (this.server) return

    this.server = createServer((request, response) => {
      void this.handleRequest(request, response)
    })

    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject)
      this.server!.listen(0, '127.0.0.1', () => {
        this.server!.off('error', reject)
        resolve()
      })
    })

    const address = this.server.address()
    if (!address || typeof address === 'string') throw new Error('Failed to resolve MCP bridge port.')

    const metadata: BridgeMetadata = {
      port: address.port,
      token: this.token,
      pid: process.pid
    }
    await writeFile(this.bridgeFilePath, JSON.stringify(metadata, null, 2))
  }

  async stop(): Promise<void> {
    const server = this.server
    this.server = undefined
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
    await rm(this.bridgeFilePath, { force: true }).catch(() => undefined)
  }

  private async handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (request.method !== 'POST' || request.url !== '/rpc') {
      sendJson(response, 404, { error: 'Not found' })
      return
    }

    if (request.headers.authorization !== `Bearer ${this.token}`) {
      sendJson(response, 401, { error: 'Unauthorized' })
      return
    }

    try {
      const payload = JSON.parse(await readRequestBody(request)) as { method?: string; params?: unknown }
      const method = payload.method?.trim()
      if (!method) {
        sendJson(response, 400, { error: 'Missing method' })
        return
      }
      const handler = this.handlers.get(method)
      if (!handler) {
        sendJson(response, 404, { error: `Unknown method: ${method}` })
        return
      }
      const result = await handler(payload.params)
      sendJson(response, 200, { result })
    } catch (error) {
      sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) })
    }
  }
}

export class McpBridgeClient {
  constructor(private readonly bridgeFilePath = resolveStealBridgeFilePath()) {}

  async isAvailable(): Promise<boolean> {
    return this.readMetadata().then(() => true).catch(() => false)
  }

  async call<T>(method: string, params?: unknown): Promise<T> {
    const metadata = await this.readMetadata()
    const response = await fetch(`http://127.0.0.1:${metadata.port}/rpc`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${metadata.token}`
      },
      body: JSON.stringify({ method, params }),
      signal: AbortSignal.timeout(2_500)
    })

    const payload = await response.json() as { result?: T; error?: string }
    if (!response.ok) throw new Error(payload.error || `Bridge request failed with status ${response.status}`)
    return payload.result as T
  }

  private async readMetadata(): Promise<BridgeMetadata> {
    const raw = await readFile(this.bridgeFilePath, 'utf8')
    const parsed = JSON.parse(raw) as Partial<BridgeMetadata>
    if (!parsed.port || !parsed.token) throw new Error('Invalid MCP bridge metadata.')
    return {
      port: parsed.port,
      token: parsed.token,
      pid: parsed.pid || 0
    }
  }
}

async function readRequestBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString('utf8')
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.statusCode = statusCode
  response.setHeader('content-type', 'application/json')
  response.end(JSON.stringify(payload))
}
