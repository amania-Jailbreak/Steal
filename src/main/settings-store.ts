import { mkdirSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { AppSettings } from '../shared/types'

export const defaultSettings: AppSettings = {
  autoStartProxy: true,
  systemProxyEnabled: true,
  autoShowBrowser: true,
  browserMode: 'embedded'
}

export class SettingsStore {
  constructor(private readonly filePath: string) {
    mkdirSync(dirname(filePath), { recursive: true })
  }

  async get(): Promise<AppSettings> {
    try {
      const raw = await readFile(this.filePath, 'utf8')
      const parsed = JSON.parse(raw) as Partial<AppSettings>
      return normalizeSettings(parsed)
    } catch {
      await this.set(defaultSettings)
      return defaultSettings
    }
  }

  async update(patch: Partial<AppSettings>): Promise<AppSettings> {
    const next = normalizeSettings({ ...(await this.get()), ...patch })
    await this.set(next)
    return next
  }

  private async set(settings: AppSettings): Promise<void> {
    await writeFile(this.filePath, JSON.stringify(settings, null, 2))
  }
}

function normalizeSettings(value: Partial<AppSettings>): AppSettings {
  return {
    autoStartProxy: typeof value.autoStartProxy === 'boolean' ? value.autoStartProxy : defaultSettings.autoStartProxy,
    systemProxyEnabled: typeof value.systemProxyEnabled === 'boolean' ? value.systemProxyEnabled : defaultSettings.systemProxyEnabled,
    autoShowBrowser: typeof value.autoShowBrowser === 'boolean' ? value.autoShowBrowser : defaultSettings.autoShowBrowser,
    browserMode: value.browserMode === 'chrome' ? 'chrome' : 'embedded'
  }
}
