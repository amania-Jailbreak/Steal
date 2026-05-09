import { join } from 'node:path'
import { app } from 'electron'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { StealPlugin, PluginManager, StealPluginAPI } from '../shared/plugin-types'

export class PluginLoader implements PluginManager {
  private plugins: Map<string, StealPlugin> = new Map()
  private pluginsDir: string
  private configFile: string
  private api: StealPluginAPI

  constructor(api: StealPluginAPI) {
    this.pluginsDir = join(app.getPath('userData'), 'steal-plugins')
    this.configFile = join(this.pluginsDir, 'plugins.json')
    this.api = api
    
    if (!existsSync(this.pluginsDir)) {
      mkdirSync(this.pluginsDir, { recursive: true })
    }
  }

  async loadPlugin(path: string): Promise<StealPlugin> {
    try {
      const absolutePath = path.startsWith('/') ? path : join(this.pluginsDir, path)
      
      if (!existsSync(absolutePath)) {
        throw new Error(`Plugin file not found: ${absolutePath}`)
      }

      const pluginCode = readFileSync(absolutePath, 'utf-8')
      
      const pluginFactory = new Function('require', 'module', 'exports', pluginCode)
      const moduleExports = {}
      const module = { exports: moduleExports }
      
      pluginFactory(require, module, module.exports)
      
      const plugin = module.exports as StealPlugin
      
      if (!plugin.name || !plugin.version) {
        throw new Error('Plugin must have name and version properties')
      }

      if (this.plugins.has(plugin.name)) {
        throw new Error(`Plugin ${plugin.name} is already loaded`)
      }

      const savedConfig = this.loadConfig()
      plugin.enabled = savedConfig[plugin.name]?.enabled ?? true
      
      this.plugins.set(plugin.name, plugin)
      
      if (plugin.enabled && plugin.onLoad) {
        await plugin.onLoad(this.api)
      }
      
      return plugin
    } catch (error) {
      throw new Error(`Failed to load plugin from ${path}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async unloadPlugin(name: string): Promise<void> {
    const plugin = this.plugins.get(name)
    if (!plugin) {
      throw new Error(`Plugin ${name} not found`)
    }

    if (plugin.onUnload) {
      await plugin.onUnload()
    }

    this.plugins.delete(name)
  }

  getPlugins(): StealPlugin[] {
    return Array.from(this.plugins.values())
  }

  getPlugin(name: string): StealPlugin | undefined {
    return this.plugins.get(name)
  }

  enablePlugin(name: string): void {
    const plugin = this.plugins.get(name)
    if (!plugin) {
      throw new Error(`Plugin ${name} not found`)
    }

    plugin.enabled = true
    this.saveConfig()
  }

  disablePlugin(name: string): void {
    const plugin = this.plugins.get(name)
    if (!plugin) {
      throw new Error(`Plugin ${name} not found`)
    }

    plugin.enabled = false
    this.saveConfig()
  }

  async loadAllPlugins(): Promise<void> {
    if (!existsSync(this.pluginsDir)) {
      return
    }

    const files = readdirSync(this.pluginsDir)
    const jsFiles = files.filter(file => file.endsWith('.js'))

    for (const file of jsFiles) {
      try {
        await this.loadPlugin(file)
      } catch (error) {
        console.error(`Failed to load plugin ${file}:`, error)
      }
    }
  }

  private loadConfig(): Record<string, { enabled: boolean }> {
    if (!existsSync(this.configFile)) {
      return {}
    }

    try {
      const content = readFileSync(this.configFile, 'utf-8')
      return JSON.parse(content)
    } catch {
      return {}
    }
  }

  private saveConfig(): void {
    const config: Record<string, { enabled: boolean }> = {}
    
    for (const [name, plugin] of this.plugins) {
      config[name] = { enabled: plugin.enabled ?? true }
    }

    writeFileSync(this.configFile, JSON.stringify(config, null, 2))
  }
}
