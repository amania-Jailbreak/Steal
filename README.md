# Steal

Browser-style Electron API capture and replay tool.

## Development

```bash
npm install
npm run dev
```

The app starts a local proxy on `127.0.0.1:8899`. The built-in browser panel uses that proxy automatically.

## Capturing External Clients

Configure the target app or browser to use:

- HTTP proxy: `127.0.0.1:8899`
- HTTPS proxy: `127.0.0.1:8899`

For HTTPS body capture, trust the generated local CA certificate. Open the certificate folder from the app sidebar, then add the generated CA certificate to macOS Keychain and mark it trusted for SSL.

Certificate pinning, some HTTP/2 flows, and non-HTTP protocols are outside the MVP scope.

## Scripts

```bash
npm run typecheck
npm run build
npm run mcp
npm audit --audit-level=high
```

## MCP Server

Steal also ships with a local MCP server over stdio.

```bash
npm run mcp
```

That server exposes Steal settings, workspaces, saved collections, saved APIs, and a live in-memory capture session for the MCP process itself.

- `get_proxy_status`, `start_proxy`, `stop_proxy`
- `list_captures`, `get_capture`, `clear_captures`
- `list_collections`, `list_saved_apis`, `get_saved_api`
- `list_workspaces`, `load_workspace`
- `replay_request`

If you want the MCP server to read/write a different data directory, set `STEAL_DATA_DIR` before launch.
