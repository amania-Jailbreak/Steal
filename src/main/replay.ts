import { decodeBody } from './body-decode'
import type { ReplayRequest, ReplayResult } from '../shared/types'

export async function replayRequest(request: ReplayRequest): Promise<ReplayResult> {
  const startedAt = performance.now()
  const headers = Object.fromEntries(Object.entries(request.headers).filter(([, value]) => value.trim() !== ''))
  const response = await fetch(request.url, {
    method: request.method,
    headers,
    body: ['GET', 'HEAD'].includes(request.method.toUpperCase()) ? undefined : request.body
  })
  const responseBuffer = Buffer.from(await response.arrayBuffer())
  const responseHeaders = Object.fromEntries(response.headers.entries())
  const body = decodeBody(responseBuffer, responseHeaders)
  return {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
    body: body.text,
    bodyBase64: body.base64,
    durationMs: Math.round(performance.now() - startedAt),
    size: responseBuffer.byteLength
  }
}
