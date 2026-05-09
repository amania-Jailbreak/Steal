/**
 * Request Rewriter Plugin
 * 
 * This plugin allows you to rewrite requests before they are sent.
 * Example: Add custom headers, modify URLs, etc.
 */

module.exports = {
  name: 'Request Rewriter',
  version: '1.0.0',
  description: 'Rewrite requests with custom headers and URL modifications',
  author: 'Steal',
  
  processors: {
    onRequest: (request) => {
      // Example: Add a custom header to all requests
      const modifiedRequest = {
        ...request,
        headers: {
          ...request.headers,
          'X-Custom-Header': 'Steal-Plugin',
          'X-Request-Time': new Date().toISOString()
        }
      }
      
      // Example: Rewrite specific URLs
      if (request.url.includes('api.example.com')) {
        modifiedRequest.url = request.url.replace('api.example.com', 'api.staging.example.com')
      }
      
      // Example: Add authentication header
      if (request.url.includes('/api/')) {
        modifiedRequest.headers['Authorization'] = 'Bearer your-token-here'
      }
      
      return modifiedRequest
    },
    
    onResponse: (response) => {
      // Example: Log response times
      console.log(`Response time: ${response.durationMs}ms`)
      return response
    }
  },
  
  filters: {
    'Has Custom Header': (capture) => {
      return capture.requestHeaders['x-custom-header'] !== undefined
    },
    
    'Modified Requests': (capture) => {
      return capture.url.includes('staging.example.com')
    }
  },
  
  exporters: {
    'Custom Log': (captures) => {
      const lines = captures.map(c => {
        const time = new Date(c.startedAt).toISOString()
        return `[${time}] ${c.method} ${c.url} - ${c.responseStatusCode} (${c.durationMs}ms)`
      })
      return `Request Log\n============\n\n${lines.join('\n')}`
    }
  },
  
  onLoad: (api) => {
    console.log('Request Rewriter plugin loaded')
    api.showMessage('Request Rewriter plugin loaded successfully!')
  },
  
  onUnload: () => {
    console.log('Request Rewriter plugin unloaded')
  }
}
