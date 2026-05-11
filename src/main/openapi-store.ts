import { join } from 'node:path'
import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { parseOpenAPISpec } from './openapi-parser'
import type { OpenAPISpec, OpenAPIImportResult } from '../shared/openapi-types'

export class OpenAPIStore {
  private specs: Map<string, OpenAPISpec> = new Map()
  private dataDir: string
  private specsFile: string

  constructor() {
    this.dataDir = join(app.getPath('userData'), 'steal-data')
    this.specsFile = join(this.dataDir, 'openapi-specs.json')
    
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true })
    }
    
    this.load()
  }

  async importSpec(content: string, filename: string): Promise<OpenAPIImportResult> {
    try {
      const spec = parseOpenAPISpec(content, filename)
      this.specs.set(spec.id, spec)
      this.save()
      return { success: true, spec }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to parse OpenAPI spec' 
      }
    }
  }

  listSpecs(): OpenAPISpec[] {
    return Array.from(this.specs.values())
  }

  getSpec(id: string): OpenAPISpec | undefined {
    return this.specs.get(id)
  }

  deleteSpec(id: string): boolean {
    const deleted = this.specs.delete(id)
    if (deleted) {
      this.save()
    }
    return deleted
  }

  private load(): void {
    if (!existsSync(this.specsFile)) {
      return
    }

    try {
      const content = readFileSync(this.specsFile, 'utf-8')
      const data = JSON.parse(content)
      
      if (Array.isArray(data)) {
        for (const spec of data) {
          this.specs.set(spec.id, spec)
        }
      }
    } catch (error) {
      console.error('Failed to load OpenAPI specs:', error)
    }
  }

  private save(): void {
    try {
      const data = Array.from(this.specs.values())
      writeFileSync(this.specsFile, JSON.stringify(data, null, 2))
    } catch (error) {
      console.error('Failed to save OpenAPI specs:', error)
    }
  }
}
