# Steal Plugins

Steal supports plugins to extend its functionality. Plugins can add custom filters, request processors, exporters, and UI components.

## Installing Plugins

1. Place your plugin `.js` files in the `~/Library/Application Support/steal/steal-plugins/` directory (macOS)
2. Or load plugins programmatically via the API

## Plugin Structure

```javascript
module.exports = {
  name: 'My Plugin',
  version: '1.0.0',
  description: 'Plugin description',
  author: 'Your Name',
  
  // Lifecycle hooks
  onLoad: (api) => {
    console.log('Plugin loaded')
  },
  onUnload: () => {
    console.log('Plugin unloaded')
  },
  
  // Custom filters
  filters: {
    'Filter Name': (capture) => {
      return true // or false
    }
  },
  
  // Request/Response processors
  processors: {
    onRequest: (request) => {
      // Modify request
      return request
    },
    onResponse: (response) => {
      // Modify response
      return response
    }
  },
  
  // Custom exporters
  exporters: {
    'Export Format': (captures) => {
      return 'formatted output'
    }
  }
}
```

## Plugin API

Plugins have access to the following API:

### Data Access
- `getCaptures()` - Get all captured exchanges
- `getSelectedCapture()` - Get the currently selected capture

### UI
- `showMessage(message)` - Show a message dialog
- `showDialog(options)` - Show a custom dialog

### HTTP
- `fetch(url, options)` - Make HTTP requests

### File System
- `readFile(path)` - Read a file
- `writeFile(path, content)` - Write to a file

## Example: Request Rewriter

```javascript
module.exports = {
  name: 'Request Rewriter',
  version: '1.0.0',
  
  processors: {
    onRequest: (request) => {
      // Add custom headers
      request.headers['X-Custom-Header'] = 'value'
      
      // Rewrite URLs
      if (request.url.includes('api.example.com')) {
        request.url = request.url.replace('api.example.com', 'api.staging.example.com')
      }
      
      return request
    }
  }
}
```

## Example: Custom Filter

```javascript
module.exports = {
  name: 'JSON Filter',
  version: '1.0.0',
  
  filters: {
    'JSON Only': (capture) => {
      const contentType = capture.responseHeaders['content-type'] || ''
      return contentType.includes('application/json')
    }
  }
}
```

## Example: Custom Exporter

```javascript
module.exports = {
  name: 'Markdown Exporter',
  version: '1.0.0',
  
  exporters: {
    'Markdown': (captures) => {
      return captures
        .map(c => `## ${c.method} ${c.url}\n\n${c.responseBody}`)
        .join('\n\n---\n\n')
    }
  }
}
```

## Security

Plugins run with full Node.js access. Only install plugins from trusted sources.

## Debugging

Check the DevTools console for plugin logs and errors.
