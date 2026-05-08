import type { CapturedExchange, HeaderMap } from '../shared/types'

type HarHeader = { name: string; value: string }
type HarQuery = { name: string; value: string }

type HarPostData = {
  mimeType: string
  text?: string
  encoding?: 'base64'
}

type HarContent = {
  size: number
  mimeType: string
  text?: string
  encoding?: 'base64'
}

type HarEntry = {
  startedDateTime: string
  time: number
  request: {
    method: string
    url: string
    httpVersion: string
    cookies: unknown[]
    headers: HarHeader[]
    queryString: HarQuery[]
    postData?: HarPostData
    headersSize: number
    bodySize: number
  }
  response: {
    status: number
    statusText: string
    httpVersion: string
    cookies: unknown[]
    headers: HarHeader[]
    content: HarContent
    redirectURL: string
    headersSize: number
    bodySize: number
  }
  cache: Record<string, never>
  timings: {
    send: number
    wait: number
    receive: number
  }
}

type HarLog = {
  log: {
    version: '1.2'
    creator: {
      name: string
      version: string
    }
    entries: HarEntry[]
  }
}

export function capturesToHar(captures: CapturedExchange[]): HarLog {
  return {
    log: {
      version: '1.2',
      creator: {
        name: 'Steal',
        version: '0.1.0'
      },
      entries: captures.slice().reverse().map(captureToHarEntry)
    }
  }
}

export function capturesFromHar(value: unknown): CapturedExchange[] {
  const entries = readHarEntries(value)
  return entries.map(harEntryToCapture)
}

function captureToHarEntry(capture: CapturedExchange): HarEntry {
  const requestMimeType = headerToString(capture.requestHeaders['content-type'])
  const responseMimeType = headerToString(capture.responseHeaders['content-type'])

  return {
    startedDateTime: capture.startedAt,
    time: capture.durationMs,
    request: {
      method: capture.method,
      url: capture.url,
      httpVersion: 'HTTP/1.1',
      cookies: [],
      headers: headersToHar(capture.requestHeaders),
      queryString: queryToHar(capture.url),
      postData: bodyToHarPostData(capture.requestBody, capture.requestBodyBase64, requestMimeType),
      headersSize: -1,
      bodySize: capture.requestSize
    },
    response: {
      status: capture.responseStatusCode,
      statusText: capture.responseStatusMessage,
      httpVersion: 'HTTP/1.1',
      cookies: [],
      headers: headersToHar(capture.responseHeaders),
      content: bodyToHarContent(capture.responseBody, capture.responseBodyBase64, responseMimeType, capture.responseSize),
      redirectURL: headerToString(capture.responseHeaders.location),
      headersSize: -1,
      bodySize: capture.responseSize
    },
    cache: {},
    timings: {
      send: 0,
      wait: capture.durationMs,
      receive: 0
    }
  }
}

function harEntryToCapture(entry: HarEntry): CapturedExchange {
  const requestHeaders = harHeadersToMap(entry.request?.headers)
  const responseHeaders = harHeadersToMap(entry.response?.headers)
  const url = entry.request?.url || 'http://unknown.local/'
  const parsedUrl = safeUrl(url)
  const requestBody = harBodyToCaptureBody(entry.request?.postData?.text, entry.request?.postData?.encoding, entry.request?.postData?.mimeType)
  const responseBody = harBodyToCaptureBody(entry.response?.content?.text, entry.response?.content?.encoding, entry.response?.content?.mimeType)

  return {
    id: crypto.randomUUID(),
    method: entry.request?.method || 'GET',
    url,
    protocol: parsedUrl.protocol === 'https:' ? 'https' : 'http',
    host: parsedUrl.host,
    path: `${parsedUrl.pathname}${parsedUrl.search}`,
    source: 'proxy',
    startedAt: entry.startedDateTime || new Date().toISOString(),
    durationMs: Number.isFinite(entry.time) ? Math.max(0, entry.time) : 0,
    requestHeaders,
    requestBody: requestBody.text,
    requestBodyBase64: requestBody.base64,
    requestSize: entry.request?.bodySize && entry.request.bodySize > 0 ? entry.request.bodySize : byteLength(requestBody),
    responseStatusCode: entry.response?.status || 0,
    responseStatusMessage: entry.response?.statusText || '',
    responseHeaders,
    responseBody: responseBody.text,
    responseBodyBase64: responseBody.base64,
    responseSize: entry.response?.bodySize && entry.response.bodySize > 0 ? entry.response.bodySize : byteLength(responseBody)
  }
}

function readHarEntries(value: unknown): HarEntry[] {
  if (!value || typeof value !== 'object') throw new Error('Invalid HAR file.')
  const root = value as { log?: { entries?: unknown } }
  if (!Array.isArray(root.log?.entries)) throw new Error('HAR log.entries was not found.')
  return root.log.entries as HarEntry[]
}

function bodyToHarPostData(text: string, base64: string | undefined, mimeType: string): HarPostData | undefined {
  if (!text && !base64) return undefined
  return {
    mimeType: mimeType || 'application/octet-stream',
    text: base64 || text,
    encoding: base64 ? 'base64' : undefined
  }
}

function bodyToHarContent(text: string, base64: string | undefined, mimeType: string, size: number): HarContent {
  return {
    size,
    mimeType: mimeType || 'application/octet-stream',
    text: base64 || text,
    encoding: base64 ? 'base64' : undefined
  }
}

function harBodyToCaptureBody(text: string | undefined, encoding: string | undefined, mimeType: string | undefined): { text: string; base64?: string } {
  if (!text) return { text: '' }
  if (encoding !== 'base64') return { text }

  const buffer = Buffer.from(text, 'base64')
  if (isTextMime(mimeType || '')) return { text: buffer.toString('utf8') }
  return {
    text: `[binary body: ${buffer.byteLength} bytes]`,
    base64: text
  }
}

function byteLength(body: { text: string; base64?: string }): number {
  if (body.base64) return Buffer.from(body.base64, 'base64').byteLength
  return Buffer.byteLength(body.text)
}

function headersToHar(headers: HeaderMap): HarHeader[] {
  return Object.entries(headers || {}).flatMap(([name, value]) => {
    if (Array.isArray(value)) return value.map((item) => ({ name, value: item }))
    if (value === undefined) return []
    return [{ name, value }]
  })
}

function harHeadersToMap(headers: HarHeader[] | undefined): HeaderMap {
  const output: HeaderMap = {}
  for (const header of headers || []) {
    if (!header?.name) continue
    const key = header.name.toLowerCase()
    if (output[key] === undefined) {
      output[key] = String(header.value ?? '')
    } else if (Array.isArray(output[key])) {
      output[key].push(String(header.value ?? ''))
    } else {
      output[key] = [String(output[key]), String(header.value ?? '')]
    }
  }
  return output
}

function queryToHar(url: string): HarQuery[] {
  return Array.from(safeUrl(url).searchParams.entries()).map(([name, value]) => ({ name, value }))
}

function safeUrl(url: string): URL {
  try {
    return new URL(url)
  } catch {
    return new URL('http://unknown.local/')
  }
}

function headerToString(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || ''
}

function isTextMime(mimeType: string): boolean {
  const normalized = mimeType.toLowerCase()
  return (
    normalized.startsWith('text/') ||
    normalized.includes('json') ||
    normalized.includes('xml') ||
    normalized.includes('javascript') ||
    normalized.includes('x-www-form-urlencoded')
  )
}
