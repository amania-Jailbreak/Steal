import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const cache = new Map<string, { value: ClientProcessInfo; expiresAt: number }>()
const cacheTtlMs = 3_000

export interface ClientProcessInfo {
  name?: string
  pid?: number
  isStealChrome?: boolean
}

export async function findClientProcess(clientPort: number, proxyPort: number): Promise<ClientProcessInfo> {
  if (process.platform !== 'darwin' || !clientPort) return {}
  const key = `${clientPort}:${proxyPort}`
  const cached = cache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  try {
    const { stdout } = await execFileAsync('lsof', ['-nP', `-iTCP:${proxyPort}`, '-sTCP:ESTABLISHED'])
    const value = await resolveStealChrome(parseLsof(stdout, clientPort, proxyPort))
    cache.set(key, { value, expiresAt: Date.now() + cacheTtlMs })
    return value
  } catch {
    return {}
  }
}

function parseLsof(stdout: string, clientPort: number, proxyPort: number): ClientProcessInfo {
  const candidates: ClientProcessInfo[] = []

  for (const line of stdout.split('\n').slice(1)) {
    const name = line.match(/\s+(.+?\(ESTABLISHED\))$/)?.[1] || ''
    if (!name.includes(`:${clientPort}`) || !name.includes(`:${proxyPort}`)) continue
    const columns = line.trim().split(/\s+/)
    const pid = Number(columns[1])
    const info = {
      name: columns[0],
      pid: Number.isFinite(pid) ? pid : undefined
    }
    if (name.includes(`:${clientPort}->`) && name.includes(`:${proxyPort}`)) return info
    candidates.push(info)
  }

  return candidates.find((candidate) => candidate.pid !== process.pid) || candidates[0] || {}
}

async function resolveStealChrome(info: ClientProcessInfo): Promise<ClientProcessInfo> {
  if (!info.pid || process.platform !== 'darwin') return info
  try {
    const { stdout } = await execFileAsync('ps', ['-p', String(info.pid), '-o', 'command='])
    return {
      ...info,
      isStealChrome: stdout.includes('steal-chrome-profile')
    }
  } catch {
    return info
  }
}
