import { EventEmitter } from 'node:events'
import { mkdirSync } from 'node:fs'
import { isIP } from 'node:net'
import { join } from 'node:path'
import { Proxy as MitmProxy } from 'http-mitm-proxy'
import { decodeBody } from './body-decode'
import { findClientProcess } from './client-process'
import type { CapturedExchange, HeaderMap, ProxyStatus } from '../shared/types'

type ProxyContext = Record<string, any>
const browserSourceHeader = 'x-steal-source'
type MitmProxyWithPrivateError = MitmProxy & {
  _onError: (kind: string, ctx: ProxyContext | null, error: Error) => void
}
let proxyConsoleFilterInstalled = false

interface ProxyServiceEvents {
  capture: [CapturedExchange]
  status: [ProxyStatus]
}

export declare interface ProxyService {
  on<K extends keyof ProxyServiceEvents>(event: K, listener: (...args: ProxyServiceEvents[K]) => void): this
  emit<K extends keyof ProxyServiceEvents>(event: K, ...args: ProxyServiceEvents[K]): boolean
}

export class ProxyService extends EventEmitter {
  private proxy?: MitmProxy
  private captures: CapturedExchange[] = []
  private status: ProxyStatus
  private capturePaused = false

  constructor(
    private readonly appDataDir: string,
    private readonly host = '127.0.0.1',
    private readonly port = 8899
  ) {
    super()
    const sslCaDir = join(appDataDir, 'certificates')
    mkdirSync(sslCaDir, { recursive: true })
    this.status = {
      running: false,
      capturePaused: false,
      host,
      port,
      caCertPath: join(sslCaDir, 'certs', 'ca.pem'),
      sslCaDir
    }
  }

  getStatus(): ProxyStatus {
    return { ...this.status }
  }

  getCaptures(): CapturedExchange[] {
    return [...this.captures].reverse()
  }

  findCapture(id: string): CapturedExchange | undefined {
    return this.captures.find((capture) => capture.id === id)
  }

  clearCaptures(): void {
    this.captures = []
  }

  appendCaptures(captures: CapturedExchange[]): void {
    this.captures.push(...captures)
  }

  setCapturePaused(paused: boolean): ProxyStatus {
    this.capturePaused = paused
    this.status = { ...this.status, capturePaused: paused }
    this.emit('status', this.getStatus())
    return this.getStatus()
  }

  async start(): Promise<ProxyStatus> {
    if (this.proxy) return this.getStatus()

    const proxy = new MitmProxy()
    this.proxy = proxy
    installProxyConsoleFilter()
    suppressNoisyProxyLogs(proxy)
    guardCertificateHosts(proxy)
    this.status = { ...this.status, running: false, error: undefined }
    this.emit('status', this.getStatus())

    proxy.onError((_ctx: ProxyContext, error: Error, kind?: string) => {
      if (isBenignProxyError(kind, error)) return
      this.status = { ...this.status, error: error.message }
      this.emit('status', this.getStatus())
    })

    proxy.onRequest((ctx: ProxyContext, callback: (error?: Error) => void) => {
      const startedAtMs = Date.now()
      const requestChunks: Buffer[] = []
      const responseChunks: Buffer[] = []
      const request = ctx.clientToProxyRequest
      const host = headerToString(request.headers.host)
      const protocol = ctx.isSSL ? 'https' : 'http'
      const path = request.url || '/'
      const url = path.startsWith('http://') || path.startsWith('https://') ? path : `${protocol}://${host}${path}`
      const source = headerToString(request.headers[browserSourceHeader]) === 'browser' ? 'browser' : 'proxy'
      const clientPort = request.socket.remotePort || 0
      const sourceAppLookup = source === 'browser'
        ? Promise.resolve({ name: 'Browser', pid: undefined })
        : findClientProcess(clientPort, this.port)
      delete request.headers[browserSourceHeader]
      ctx.stealSourceAppLookup = sourceAppLookup

      ctx.stealCapture = {
        id: crypto.randomUUID(),
        method: request.method || 'GET',
        url,
        protocol,
        host,
        path,
        source,
        sourceAppName: source === 'browser' ? 'Browser' : undefined,
        sourceProcessId: undefined,
        startedAt: new Date(startedAtMs).toISOString(),
        durationMs: 0,
        requestHeaders: normalizeHeaders(request.headers),
        requestBody: '',
        requestSize: 0,
        responseStatusCode: 0,
        responseStatusMessage: '',
        responseHeaders: {},
        responseBody: '',
        responseSize: 0
      } satisfies CapturedExchange

      void sourceAppLookup.then((sourceApp) => {
        const capture = ctx.stealCapture as CapturedExchange
        if (sourceApp.isStealChrome) capture.source = 'browser'
        capture.sourceAppName = sourceApp.name || capture.sourceAppName
        capture.sourceProcessId = sourceApp.pid
      }).finally(callback)

      ctx.onRequestData((_ctx: ProxyContext, chunk: Buffer, done: (error: Error | null, chunk: Buffer) => void) => {
        requestChunks.push(Buffer.from(chunk))
        done(null, chunk)
      })

      ctx.onResponse((_ctx: ProxyContext, done: (error?: Error) => void) => {
        const response = ctx.serverToProxyResponse
        const capture = ctx.stealCapture as CapturedExchange
        capture.responseStatusCode = response.statusCode || 0
        capture.responseStatusMessage = response.statusMessage || ''
        capture.responseHeaders = normalizeHeaders(response.headers)
        done()
      })

      ctx.onResponseData((_ctx: ProxyContext, chunk: Buffer, done: (error: Error | null, chunk: Buffer) => void) => {
        responseChunks.push(Buffer.from(chunk))
        done(null, chunk)
      })

      ctx.onResponseEnd((_ctx: ProxyContext, done: (error?: Error) => void) => {
        void (async () => {
        const capture = ctx.stealCapture as CapturedExchange
        const sourceApp = await (ctx.stealSourceAppLookup as Promise<{ name?: string; pid?: number; isStealChrome?: boolean }>)
        const requestBody = Buffer.concat(requestChunks)
        const responseBody = Buffer.concat(responseChunks)
        const decodedRequestBody = decodeBody(requestBody, capture.requestHeaders)
        const decodedResponseBody = decodeBody(responseBody, capture.responseHeaders)
        if (sourceApp.isStealChrome) capture.source = 'browser'
        capture.sourceAppName = sourceApp.name || capture.sourceAppName
        capture.sourceProcessId = sourceApp.pid
        capture.durationMs = Date.now() - startedAtMs
        capture.requestSize = requestBody.byteLength
        capture.responseSize = responseBody.byteLength
        capture.requestBody = decodedRequestBody.text
        capture.requestBodyBase64 = decodedRequestBody.base64
        capture.responseBody = decodedResponseBody.text
        capture.responseBodyBase64 = decodedResponseBody.base64
        if (!this.capturePaused) {
          this.captures.push(capture)
          this.emit('capture', capture)
        }
        done()
        })().catch((error: Error) => done(error))
      })

    })

    await new Promise<void>((resolve, reject) => {
      proxy.listen({ host: this.host, port: this.port, sslCaDir: this.status.sslCaDir }, (error?: Error) => {
        if (error) {
          this.proxy = undefined
          this.status = { ...this.status, running: false, error: error.message }
          this.emit('status', this.getStatus())
          reject(error)
          return
        }
        this.status = { ...this.status, running: true, error: undefined }
        this.emit('status', this.getStatus())
        resolve()
      })
    })

    return this.getStatus()
  }

  async stop(): Promise<ProxyStatus> {
    if (!this.proxy) return this.getStatus()
    const proxy = this.proxy
    this.proxy = undefined
    await withTimeout(new Promise<void>((resolve) => proxy.close(() => resolve())), 4_000).catch(() => undefined)
    this.status = { ...this.status, running: false, error: undefined }
    this.emit('status', this.getStatus())
    return this.getStatus()
  }
}

function normalizeHeaders(headers: HeaderMap): HeaderMap {
  return Object.fromEntries(Object.entries(headers || {}).map(([key, value]) => [key.toLowerCase(), value]))
}

function headerToString(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || ''
}

function suppressNoisyProxyLogs(proxy: MitmProxy): void {
  const mutableProxy = proxy as MitmProxyWithPrivateError
  const originalOnError = mutableProxy._onError.bind(proxy)
  mutableProxy._onError = (kind, ctx, error) => {
    if (isBenignProxyError(kind, error)) return
    originalOnError(kind, ctx, error)
  }
}

function guardCertificateHosts(proxy: MitmProxy): void {
  const originalOnCertificateMissing = proxy.onCertificateMissing.bind(proxy)
  proxy.onCertificateMissing = (ctx: ProxyContext, files: Record<string, any>, callback: (error?: Error, files?: Record<string, any>) => void): void => {
    const hosts = (files.hosts || [ctx.hostname]).map(String).filter(isValidCertificateHost)
    if (hosts.length === 0) {
      callback(new Error(`Invalid CONNECT host for certificate: ${String(ctx.hostname || '')}`))
      return
    }
    try {
      originalOnCertificateMissing(ctx, { ...files, hosts }, callback)
    } catch (error) {
      callback(error instanceof Error ? error : new Error(String(error)))
    }
  }
}

function isValidCertificateHost(host: string): boolean {
  const normalized = host.trim().replace(/^\[|\]$/g, '')
  if (!normalized || normalized.includes('/') || normalized.includes(':')) return false
  if (/^[\d.]+$/.test(normalized)) return isIP(normalized) !== 0
  return /^(?:\*\.)?(?:[a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+$/.test(normalized)
}

function isBenignProxyError(kind: string | undefined, error: Error): boolean {
  const code = (error as NodeJS.ErrnoException).code
  if (kind === 'HTTPS_CLIENT_ERROR' && (code === 'ECONNRESET' || error.message === 'socket hang up')) return true
  if (code === 'ECONNRESET' || code === 'EPIPE') return true
  return false
}

function installProxyConsoleFilter(): void {
  if (proxyConsoleFilterInstalled) return
  proxyConsoleFilterInstalled = true
  const originalDebug = console.debug.bind(console)
  console.debug = (...args: unknown[]) => {
    const message = args.map(String).join(' ')
    if (/^(starting server for|https server started for|creating SNI context for|https server started on)/.test(message)) return
    originalDebug(...args)
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms.`)), timeoutMs)
    promise
      .then(resolve, reject)
      .finally(() => clearTimeout(timer))
  })
}
