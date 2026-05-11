import type { CapturedExchange } from './types'

export interface OpenAPISpec {
  id: string
  name: string
  version: string
  description?: string
  baseUrl?: string
  tags: OpenAPITag[]
  endpoints: OpenAPIEndpoint[]
  importedAt: string
}

export interface OpenAPITag {
  name: string
  description?: string
  endpointCount: number
}

export interface OpenAPIEndpoint {
  path: string
  pathPattern: string
  method: string
  tag?: string
  summary?: string
  description?: string
  operationId?: string
  deprecated?: boolean
  parameters?: OpenAPIParameter[]
  requestBody?: OpenAPIRequestBody
}

export interface OpenAPIParameter {
  name: string
  in: 'path' | 'query' | 'header' | 'cookie'
  description?: string
  required?: boolean
  schema?: { type?: string; format?: string; enum?: string[]; default?: string; example?: string }
}

export interface OpenAPIRequestBody {
  description?: string
  required?: boolean
  contentType?: string
  schema?: Record<string, any>
  example?: any
}

export interface OpenAPIMatch {
  specId: string
  specName: string
  endpoint: OpenAPIEndpoint
}

export interface OpenAPIImportResult {
  success: boolean
  spec?: OpenAPISpec
  error?: string
}

export interface OpenAPIFilter {
  selectedTags: string[]
  selectedSpecs: string[]
}

export function matchEndpointToCapture(capture: CapturedExchange, specs: OpenAPISpec[]): OpenAPIMatch | undefined {
  for (const spec of specs) {
    for (const endpoint of spec.endpoints) {
      if (capture.method.toUpperCase() === endpoint.method.toUpperCase()) {
        try {
          const pattern = new RegExp(endpoint.pathPattern)
          if (pattern.test(capture.path)) {
            return {
              specId: spec.id,
              specName: spec.name,
              endpoint
            }
          }
        } catch {
          continue
        }
      }
    }
  }
  return undefined
}

export function getTagsFromCaptures(captures: CapturedExchange[], specs: OpenAPISpec[]): Map<string, number> {
  const tagCounts = new Map<string, number>()
  
  for (const capture of captures) {
    const match = matchEndpointToCapture(capture, specs)
    if (match?.endpoint.tag) {
      const count = tagCounts.get(match.endpoint.tag) || 0
      tagCounts.set(match.endpoint.tag, count + 1)
    }
  }
  
  return tagCounts
}
