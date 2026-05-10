import { mkdirSync } from 'node:fs'
import { readFile, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { WorkspaceRecord, WorkspaceSnapshot, WorkspaceState } from '../shared/types'

type WorkspaceIndex = {
  lastWorkspaceId?: string
  lastSessionWorkspaceId?: string
  workspaces: WorkspaceRecord[]
}

const LAST_SESSION_WORKSPACE_ID = '__last_session__'
const LAST_SESSION_WORKSPACE_NAME = 'Previous Session'

export class WorkspaceStore {
  private readonly indexPath: string
  private readonly workspaceDir: string

  constructor(private readonly dataDir: string) {
    mkdirSync(dataDir, { recursive: true })
    this.indexPath = join(dataDir, 'workspaces.json')
    this.workspaceDir = join(dataDir, 'workspace-files')
    mkdirSync(dirname(this.indexPath), { recursive: true })
    mkdirSync(this.workspaceDir, { recursive: true })
  }

  async getState(): Promise<WorkspaceState> {
    const index = await this.readIndex()
    return {
      workspaces: index.workspaces
        .filter((workspace) => workspace.id !== LAST_SESSION_WORKSPACE_ID)
        .sort((left, right) => (right.lastOpenedAt || right.updatedAt).localeCompare(left.lastOpenedAt || left.updatedAt)),
      lastWorkspaceId: index.lastWorkspaceId,
      lastSessionWorkspaceId: index.lastSessionWorkspaceId
    }
  }

  async load(workspaceId: string): Promise<WorkspaceSnapshot> {
    const filePath = join(this.workspaceDir, `${workspaceId}.json`)
    const raw = await readFile(filePath, 'utf8')
    const snapshot = JSON.parse(raw) as WorkspaceSnapshot
    const nextSnapshot = {
      ...snapshot,
      lastOpenedAt: new Date().toISOString()
    }
    await this.writeSnapshot(nextSnapshot)
    await this.touchIndex(nextSnapshot)
    return nextSnapshot
  }

  async save(payload: { workspaceId?: string; name: string; tabs: WorkspaceSnapshot['tabs']; activeCaptureTabId: string }): Promise<WorkspaceSnapshot> {
    const index = await this.readIndex()
    const existing = payload.workspaceId ? index.workspaces.find((workspace) => workspace.id === payload.workspaceId) : undefined
    const now = new Date().toISOString()
    const snapshot: WorkspaceSnapshot = {
      id: existing?.id || crypto.randomUUID(),
      name: payload.name.trim() || existing?.name || 'Workspace',
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      lastOpenedAt: now,
      tabs: payload.tabs,
      activeCaptureTabId: payload.activeCaptureTabId
    }
    await this.writeSnapshot(snapshot)
    await this.touchIndex(snapshot)
    return snapshot
  }

  async saveLastSession(payload: { tabs: WorkspaceSnapshot['tabs']; activeCaptureTabId: string }): Promise<WorkspaceSnapshot> {
    const index = await this.readIndex()
    const existing = index.workspaces.find((workspace) => workspace.id === LAST_SESSION_WORKSPACE_ID)
    const now = new Date().toISOString()
    const snapshot: WorkspaceSnapshot = {
      id: LAST_SESSION_WORKSPACE_ID,
      name: LAST_SESSION_WORKSPACE_NAME,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      lastOpenedAt: now,
      tabs: payload.tabs,
      activeCaptureTabId: payload.activeCaptureTabId
    }
    await this.writeSnapshot(snapshot)
    await this.touchIndex(snapshot, { sessionOnly: true })
    return snapshot
  }

  async delete(workspaceId: string): Promise<WorkspaceState> {
    const index = await this.readIndex()
    const nextIndex: WorkspaceIndex = {
      lastWorkspaceId: index.lastWorkspaceId === workspaceId ? undefined : index.lastWorkspaceId,
      lastSessionWorkspaceId: index.lastSessionWorkspaceId === workspaceId ? undefined : index.lastSessionWorkspaceId,
      workspaces: index.workspaces.filter((workspace) => workspace.id !== workspaceId)
    }
    await writeFile(this.indexPath, JSON.stringify(nextIndex, null, 2))
    await unlink(join(this.workspaceDir, `${workspaceId}.json`)).catch(() => undefined)
    return this.getState()
  }

  private async readIndex(): Promise<WorkspaceIndex> {
    try {
      const raw = await readFile(this.indexPath, 'utf8')
      const parsed = JSON.parse(raw) as Partial<WorkspaceIndex>
      return {
        lastWorkspaceId: parsed.lastWorkspaceId,
        lastSessionWorkspaceId: parsed.lastSessionWorkspaceId,
        workspaces: Array.isArray(parsed.workspaces) ? parsed.workspaces : []
      }
    } catch {
      const emptyIndex: WorkspaceIndex = { workspaces: [] }
      await writeFile(this.indexPath, JSON.stringify(emptyIndex, null, 2))
      return emptyIndex
    }
  }

  private async touchIndex(snapshot: WorkspaceSnapshot, options?: { sessionOnly?: boolean }): Promise<void> {
    const index = await this.readIndex()
    const nextRecord: WorkspaceRecord = {
      id: snapshot.id,
      name: snapshot.name,
      createdAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt,
      lastOpenedAt: snapshot.lastOpenedAt
    }
    const nextWorkspaces = [
      nextRecord,
      ...index.workspaces.filter((workspace) => workspace.id !== snapshot.id)
    ]
    await writeFile(this.indexPath, JSON.stringify({
      lastWorkspaceId: options?.sessionOnly ? index.lastWorkspaceId : snapshot.id,
      lastSessionWorkspaceId: snapshot.id === LAST_SESSION_WORKSPACE_ID ? snapshot.id : index.lastSessionWorkspaceId,
      workspaces: nextWorkspaces
    } satisfies WorkspaceIndex, null, 2))
  }

  private async writeSnapshot(snapshot: WorkspaceSnapshot): Promise<void> {
    await writeFile(join(this.workspaceDir, `${snapshot.id}.json`), JSON.stringify(snapshot, null, 2))
  }
}
