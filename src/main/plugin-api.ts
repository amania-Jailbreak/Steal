import { dialog, ipcMain } from 'electron'
import type { StealPluginAPI, PluginDialogOptions } from '../shared/plugin-types'
import type { ProxyService } from './proxy-service'

export class PluginAPI implements StealPluginAPI {
  private proxyService: ProxyService

  constructor(proxyService: ProxyService) {
    this.proxyService = proxyService
  }

  getCaptures() {
    return this.proxyService.getCaptures()
  }

  getSelectedCapture() {
    return undefined
  }

  showMessage(message: string): void {
    dialog.showMessageBox({
      type: 'info',
      title: 'Plugin Message',
      message
    })
  }

  async showDialog(options: PluginDialogOptions): Promise<boolean> {
    const result = await dialog.showMessageBox({
      type: options.type || 'info',
      title: options.title || 'Plugin Dialog',
      message: options.message,
      buttons: options.buttons || ['OK', 'Cancel']
    })
    
    return result.response === 0
  }

  async fetch(url: string, options?: RequestInit): Promise<Response> {
    return fetch(url, options)
  }

  async readFile(path: string): Promise<string> {
    const { readFile } = await import('node:fs/promises')
    return readFile(path, 'utf-8')
  }

  async writeFile(path: string, content: string): Promise<void> {
    const { writeFile } = await import('node:fs/promises')
    return writeFile(path, content, 'utf-8')
  }
}
