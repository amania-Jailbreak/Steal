import { homedir } from 'node:os'
import { join } from 'node:path'

export function resolveStealDataDir(): string {
  if (process.env.STEAL_DATA_DIR?.trim()) return process.env.STEAL_DATA_DIR.trim()

  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'steal', 'steal-data')
  }

  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || join(homedir(), 'AppData', 'Roaming')
    return join(appData, 'steal', 'steal-data')
  }

  const configHome = process.env.XDG_CONFIG_HOME || join(homedir(), '.config')
  return join(configHome, 'steal', 'steal-data')
}

export function resolveStealBridgeFilePath(dataDir = resolveStealDataDir()): string {
  return join(dataDir, 'mcp-bridge.json')
}
