import { mkdirSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { CapturedExchange } from '../shared/types'

export class SharedCaptureStore {
  private readonly emptySerialized = '[]'
  private writeQueue = Promise.resolve()

  constructor(private readonly filePath: string) {
    mkdirSync(dirname(filePath), { recursive: true })
  }

  async read(): Promise<{ captures: CapturedExchange[]; serialized: string }> {
    try {
      const serialized = await readFile(this.filePath, 'utf8')
      const parsed = JSON.parse(serialized) as CapturedExchange[]
      return {
        captures: Array.isArray(parsed) ? parsed : [],
        serialized
      }
    } catch {
      return {
        captures: [],
        serialized: this.emptySerialized
      }
    }
  }

  async replace(captures: CapturedExchange[]): Promise<string> {
    const serialized = JSON.stringify(captures, null, 2)
    await this.enqueueWrite(serialized)
    return serialized
  }

  async clear(): Promise<string> {
    await this.enqueueWrite(this.emptySerialized)
    return this.emptySerialized
  }

  async upsert(capture: CapturedExchange): Promise<string> {
    return this.update((captures) => {
      const index = captures.findIndex((item) => item.id === capture.id)
      if (index === -1) return [...captures, capture]
      return captures.map((item, itemIndex) => (itemIndex === index ? capture : item))
    })
  }

  async mergeMany(incoming: CapturedExchange[]): Promise<string> {
    return this.update((captures) => {
      const next = [...captures]
      for (const capture of incoming) {
        const index = next.findIndex((item) => item.id === capture.id)
        if (index === -1) next.push(capture)
        else next[index] = capture
      }
      return next
    })
  }

  private async update(mutator: (captures: CapturedExchange[]) => CapturedExchange[]): Promise<string> {
    const { captures } = await this.read()
    const nextCaptures = mutator(captures)
    const serialized = JSON.stringify(nextCaptures, null, 2)
    await this.enqueueWrite(serialized)
    return serialized
  }

  private async enqueueWrite(serialized: string): Promise<void> {
    this.writeQueue = this.writeQueue.then(() => writeFile(this.filePath, serialized))
    await this.writeQueue
  }
}
