import { brotliDecompressSync, gunzipSync, inflateRawSync, inflateSync } from 'node:zlib'
import type { HeaderMap } from '../shared/types'

export function decodeBodyText(buffer: Buffer, headers: HeaderMap): string {
  if (buffer.byteLength === 0) return ''
  const contentType = headerToString(headers['content-type']).toLowerCase()
  const contentEncoding = headerToString(headers['content-encoding']).toLowerCase()
  if (!isTextLikeContent(contentType)) return `[binary body: ${buffer.byteLength} bytes]`

  const decoded = decodeContentEncoding(buffer, contentEncoding)
  return decodeText(decoded, contentType)
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
