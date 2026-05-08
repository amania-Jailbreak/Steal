import { brotliDecompressSync, gunzipSync, inflateRawSync, inflateSync } from 'node:zlib'
import type { HeaderMap } from '../shared/types'

export interface DecodedBody {
  text: string
  base64?: string
}

export function decodeBodyText(buffer: Buffer, headers: HeaderMap): string {
  return decodeBody(buffer, headers).text
}

export function decodeBody(buffer: Buffer, headers: HeaderMap): DecodedBody {
  if (buffer.byteLength === 0) return { text: '' }
  const contentType = headerToString(headers['content-type']).toLowerCase()
  const contentEncoding = headerToString(headers['content-encoding']).toLowerCase()
  const decoded = decodeContentEncoding(buffer, contentEncoding)
  if ((contentType && !isTextLikeContent(contentType)) || (!contentType && looksBinary(decoded))) {
    return {
      text: `[binary body: ${decoded.byteLength} bytes]`,
      base64: decoded.toString('base64')
    }
  }
  return { text: decodeText(decoded, contentType) }
}

function isTextLikeContent(contentType: string): boolean {
  return (
    contentType.includes('application/json') ||
    contentType.includes('text/') ||
    contentType.includes('application/xml') ||
    contentType.includes('application/javascript') ||
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('graphql')
  )
}

function decodeContentEncoding(buffer: Buffer, contentEncoding: string): Buffer {
  return contentEncoding
    .split(',')
    .map((encoding) => encoding.trim())
    .filter(Boolean)
    .reverse()
    .reduce((current, encoding) => {
      try {
        if (encoding === 'br') return brotliDecompressSync(current)
        if (encoding === 'gzip' || encoding === 'x-gzip') return gunzipSync(current)
        if (encoding === 'deflate') {
          try {
            return inflateSync(current)
          } catch {
            return inflateRawSync(current)
          }
        }
      } catch {
        return current
      }
      return current
    }, buffer)
}

function decodeText(buffer: Buffer, contentType: string): string {
  const charset = extractCharset(contentType)

  if (charset) {
    try {
      return new TextDecoder(charset, { fatal: false }).decode(buffer)
    } catch {
      return buffer.toString('utf8')
    }
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    for (const candidate of ['shift_jis', 'euc-jp', 'iso-2022-jp']) {
      try {
        return new TextDecoder(candidate, { fatal: false }).decode(buffer)
      } catch {
        continue
      }
    }
  }

  return buffer.toString('utf8')
}

function looksBinary(buffer: Buffer): boolean {
  if (buffer.byteLength === 0) return false
  const sampleLength = Math.min(buffer.byteLength, 4096)
  let controlBytes = 0
  for (let index = 0; index < sampleLength; index += 1) {
    const byte = buffer[index]
    if (byte === 0) return true
    if (byte < 7 || (byte > 13 && byte < 32)) controlBytes += 1
  }
  return controlBytes / sampleLength > 0.08
}

function extractCharset(contentType: string): string | undefined {
  const match = /charset\s*=\s*"?([^";\s]+)"?/i.exec(contentType)
  if (!match) return undefined
  const charset = match[1].toLowerCase()
  if (charset === 'shift-jis' || charset === 'sjis' || charset === 'windows-31j') return 'shift_jis'
  if (charset === 'eucjp') return 'euc-jp'
  if (charset === 'jis' || charset === 'iso2022jp') return 'iso-2022-jp'
  return charset
}

function headerToString(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || ''
}
