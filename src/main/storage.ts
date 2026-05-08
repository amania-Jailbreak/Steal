import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { CapturedExchange, CollectionSettings, SavedApi, SavedCollection } from '../shared/types'

export const defaultCollectionSettings: CollectionSettings = {
  variables: {},
  headers: {},
  cookies: {},
  userAgent: {
    enabled: false,
    preset: 'none',
    value: ''
  }
}

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

  async updateCollectionSettings(collectionId: string, settings: CollectionSettings): Promise<SavedCollection[]> {
    const collections = await this.readCollections()
    const nextCollections = collections.map((collection) => (
      collection.id === collectionId
        ? { ...collection, settings: normalizeCollectionSettings(settings), updatedAt: new Date().toISOString() }
        : collection
    ))
    await this.writeCollections(nextCollections)
    return this.listCollections()
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
      itemCount: 0,
      settings: defaultCollectionSettings
    }
    await this.writeCollections([...collections, created])
    return created
  }

  private async readCollections(): Promise<SavedCollection[]> {
    await this.ensureReady()
    try {
      const raw = await readFile(this.collectionsIndexPath, 'utf8')
      const parsed = JSON.parse(raw) as Array<Partial<SavedCollection>>
      return parsed.map(normalizeCollection)
    } catch {
      return []
    }
  }

  private async writeCollections(collections: SavedCollection[]): Promise<void> {
    await writeFile(this.collectionsIndexPath, JSON.stringify(collections, null, 2))
  }
}

function normalizeCollection(collection: Partial<SavedCollection>): SavedCollection {
  const now = new Date().toISOString()
  return {
    id: collection.id || crypto.randomUUID(),
    name: collection.name || 'Default',
    createdAt: collection.createdAt || now,
    updatedAt: collection.updatedAt || collection.createdAt || now,
    itemCount: collection.itemCount || 0,
    settings: normalizeCollectionSettings(collection.settings)
  }
}

function normalizeCollectionSettings(settings: Partial<CollectionSettings> | undefined): CollectionSettings {
  return {
    variables: normalizeStringMap(settings?.variables),
    headers: normalizeStringMap(settings?.headers),
    cookies: normalizeStringMap(settings?.cookies),
    userAgent: {
      enabled: Boolean(settings?.userAgent?.enabled),
      preset: settings?.userAgent?.preset || defaultCollectionSettings.userAgent.preset,
      value: settings?.userAgent?.value || ''
    }
  }
}

function normalizeStringMap(value: Record<string, string> | undefined): Record<string, string> {
  if (!value || typeof value !== 'object') return {}
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, item]) => key.trim() && typeof item === 'string')
      .map(([key, item]) => [key.trim(), item])
  )
}
