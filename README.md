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
npm audit --audit-level=high
```
