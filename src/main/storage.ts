import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { CapturedExchange, SavedApi, SavedCollection } from '../shared/types'

export class SavedApiStore {
  private readonly collectionsIndexPath: string

  constructor(private readonly collectionsDir: string) {
    this.collectionsIndexPath = join(collectionsDir, 'collections.json')
  }

  async ensureReady(): Promise<void> {
    await mkdir(this.collectionsDir, { recursive: true })
  }

  async list(): Promise<SavedApi[]> {
    await this.ensureReady()
    const files = await readdir(this.collectionsDir)
    const saved = await Promise.all(
      files
        .filter((file) => file.endsWith('.json') && file !== 'collections.json')
        .map(async (file) => {
          const raw = await readFile(join(this.collectionsDir, file), 'utf8')
          return JSON.parse(raw) as SavedApi
        })
    )
    return saved.sort((a, b) => b.savedAt.localeCompare(a.savedAt))
  }

  async listCollections(): Promise<SavedCollection[]> {
    await this.ensureReady()
    const [collections, savedApis] = await Promise.all([this.readCollections(), this.list()])
    const counts = new Map<string, number>()
    for (const api of savedApis) {
      if (api.collectionId) counts.set(api.collectionId, (counts.get(api.collectionId) || 0) + 1)
    }
    return collections
      .map((collection) => ({ ...collection, itemCount: counts.get(collection.id) || 0 }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  async save(exchange: CapturedExchange, name: string, tags: string[], collectionName: string): Promise<SavedApi> {
    await this.ensureReady()
    const collection = await this.ensureCollection(collectionName)
    const saved: SavedApi = {
      id: crypto.randomUUID(),
      name: name.trim() || `${exchange.method} ${new URL(exchange.url).pathname}`,
      tags,
      savedAt: new Date().toISOString(),
      collectionId: collection.id,
      collectionName: collection.name,
      exchange: {
        ...exchange,
        savedName: name.trim(),
        tags
      }
    }
    await writeFile(join(this.collectionsDir, `${saved.id}.json`), JSON.stringify(saved, null, 2))
    return saved
  }

  async importMany(savedApis: SavedApi[]): Promise<SavedApi[]> {
    await this.ensureReady()
    const imported = await Promise.all(
      savedApis.map(async (api) => {
        const collection = await this.ensureCollection(api.collectionName || 'Default')
        const item = {
          ...api,
          id: api.id || crypto.randomUUID(),
          collectionId: api.collectionId || collection.id,
          collectionName: api.collectionName || collection.name
        }
        await writeFile(join(this.collectionsDir, `${item.id}.json`), JSON.stringify(item, null, 2))
        return item
      })
    )
    return imported
  }

  private async ensureCollection(name: string): Promise<SavedCollection> {
    const collections = await this.readCollections()
    const normalizedName = name.trim() || 'Default'
    const existing = collections.find((collection) => collection.name.toLowerCase() === normalizedName.toLowerCase())
    if (existing) {
      const updated = { ...existing, updatedAt: new Date().toISOString() }
      await this.writeCollections(collections.map((collection) => (collection.id === existing.id ? updated : collection)))
      return updated
    }

    const now = new Date().toISOString()
    const created: SavedCollection = {
      id: crypto.randomUUID(),
      name: normalizedName,
      createdAt: now,
      updatedAt: now,
      itemCount: 0
    }
    await this.writeCollections([...collections, created])
    return created
  }

  private async readCollections(): Promise<SavedCollection[]> {
    await this.ensureReady()
    try {
      const raw = await readFile(this.collectionsIndexPath, 'utf8')
      return JSON.parse(raw) as SavedCollection[]
    } catch {
      return []
    }
  }

  private async writeCollections(collections: SavedCollection[]): Promise<void> {
    await writeFile(this.collectionsIndexPath, JSON.stringify(collections, null, 2))
  }
}
