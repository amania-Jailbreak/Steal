import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const cache = new Map<string, { value: ClientProcessInfo; expiresAt: number }>()
const cacheTtlMs = 3_000

export interface ClientProcessInfo {
  name?: string
  pid?: number
}

export async function findClientProcess(clientPort: number, proxyPort: number): Promise<ClientProcessInfo> {
  if (process.platform !== 'darwin' || !clientPort) return {}
  const key = `${clientPort}:${proxyPort}`
  const cached = cache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  try {
    const { stdout } = await execFileAsync('lsof', ['-nP', `-iTCP:${proxyPort}`, '-sTCP:ESTABLISHED'])
    const value = parseLsof(stdout, clientPort, proxyPort)
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
