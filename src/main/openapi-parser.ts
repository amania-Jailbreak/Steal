import * as yaml from 'js-yaml'
import type { OpenAPISpec, OpenAPIEndpoint, OpenAPITag, OpenAPIParameter, OpenAPIRequestBody } from '../shared/openapi-types'

export function parseOpenAPISpec(content: string, filename: string): OpenAPISpec {
  let spec: any
  
  try {
    spec = JSON.parse(content)
  } catch {
    try {
      spec = yaml.load(content)
    } catch {
      throw new Error('Failed to parse OpenAPI spec as JSON or YAML')
    }
  }
  
  if (!spec.openapi && !spec.swagger) {
    throw new Error('Not a valid OpenAPI specification')
  }
  
  const isOpenAPI3 = spec.openapi && spec.openapi.startsWith('3')
  
  const id = `openapi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const name = spec.info?.title || filename.replace(/\.(json|yaml|yml)$/i, '')
  const version = spec.info?.version || 'unknown'
  const description = spec.info?.description
  
  const baseUrl = extractBaseUrl(spec, isOpenAPI3)
  const tags = extractTags(spec)
  const endpoints = extractEndpoints(spec, tags)
  
  const tagMap = new Map(tags.map(t => [t.name, { ...t, endpointCount: 0 }]))
  for (const endpoint of endpoints) {
    if (endpoint.tag && tagMap.has(endpoint.tag)) {
      tagMap.get(endpoint.tag)!.endpointCount++
    }
  }
  
  return {
    id,
    name,
    version,
    description,
    baseUrl,
    tags: Array.from(tagMap.values()),
    endpoints,
    importedAt: new Date().toISOString()
  }
}

function extractBaseUrl(spec: any, isOpenAPI3: boolean): string | undefined {
  if (isOpenAPI3 && spec.servers && spec.servers.length > 0) {
    return spec.servers[0].url
  }
  
  if (!isOpenAPI3 && spec.host) {
    const scheme = spec.schemes?.[0] || 'https'
    const basePath = spec.basePath || ''
    return `${scheme}://${spec.host}${basePath}`
  }
  
  return undefined
}

function extractTags(spec: any): OpenAPITag[] {
  const tags: OpenAPITag[] = []
  
  if (spec.tags && Array.isArray(spec.tags)) {
    for (const tag of spec.tags) {
      tags.push({
        name: tag.name,
        description: tag.description,
        endpointCount: 0
      })
    }
  }
  
  return tags
}

function extractEndpoints(spec: any, definedTags: OpenAPITag[]): OpenAPIEndpoint[] {
  const endpoints: OpenAPIEndpoint[] = []
  const paths = spec.paths || {}
  
  for (const [path, methods] of Object.entries(paths)) {
    if (typeof methods !== 'object' || methods === null) continue
    
    for (const [method, operation] of Object.entries(methods)) {
      if (!['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(method.toLowerCase())) {
        continue
      }
      
      if (typeof operation !== 'object' || operation === null) continue
      
      const op = operation as any
      const tag = op.tags?.[0]
      const pathPattern = pathToRegex(path)
      const parameters = extractParameters(op)
      const requestBody = extractRequestBody(op)
      
      endpoints.push({
        path,
        pathPattern,
        method: method.toUpperCase(),
        tag,
        summary: op.summary,
        description: op.description,
        operationId: op.operationId,
        deprecated: op.deprecated || false,
        parameters,
        requestBody
      })
    }
  }
  
  return endpoints
}

function pathToRegex(path: string): string {
  return path
    .replace(/\{([^}]+)\}/g, '[^/]*')
    .replace(/\//g, '\\/')
}

function extractParameters(op: any): OpenAPIParameter[] | undefined {
  const params = op.parameters
  if (!Array.isArray(params) || params.length === 0) return undefined
  const result: OpenAPIParameter[] = []
  for (const p of params) {
    if (!p.name || !p.in) continue
    result.push({
      name: p.name,
      in: p.in,
      description: p.description,
      required: p.required || false,
      schema: p.schema ? { type: p.schema.type, format: p.schema.format, enum: p.schema.enum, default: p.schema.default, example: p.schema.example } : undefined
    })
  }
  return result.length > 0 ? result : undefined
}

function extractRequestBody(op: any): OpenAPIRequestBody | undefined {
  const rb = op.requestBody
  if (!rb) return undefined
  const content = rb.content
  let contentType: string | undefined
  let schema: Record<string, any> | undefined
  let example: any
  if (content) {
    const ct = Object.keys(content)[0]
    if (ct) {
      contentType = ct
      schema = content[ct].schema
      example = content[ct].example ?? content[ct].examples?.[Object.keys(content[ct].examples || {})[0]]?.value
    }
  }
  return {
    description: rb.description,
    required: rb.required || false,
    contentType,
    schema,
    example
  }
}

export function validateOpenAPISpec(content: string): { valid: boolean; error?: string } {
  try {
    let spec: any
    
    try {
      spec = JSON.parse(content)
    } catch {
      try {
        spec = yaml.load(content)
      } catch {
        return { valid: false, error: 'Failed to parse as JSON or YAML' }
      }
    }
    
    if (!spec.openapi && !spec.swagger) {
      return { valid: false, error: 'Not an OpenAPI specification (missing openapi or swagger field)' }
    }
    
    if (!spec.info || !spec.info.title) {
      return { valid: false, error: 'Missing required field: info.title' }
    }
    
    if (!spec.paths || Object.keys(spec.paths).length === 0) {
      return { valid: false, error: 'No paths defined in specification' }
    }
    
    return { valid: true }
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
