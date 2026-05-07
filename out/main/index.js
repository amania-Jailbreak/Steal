import { app, BrowserWindow, session, ipcMain, dialog, shell, Tray, Menu, nativeImage } from "electron";
import { execFile } from "node:child_process";
import { join, dirname } from "node:path";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { mkdirSync, existsSync } from "node:fs";
import { EventEmitter } from "node:events";
import { Proxy } from "http-mitm-proxy";
import { brotliDecompressSync, gunzipSync, inflateSync, inflateRawSync } from "node:zlib";
import { promisify } from "node:util";
import __cjs_mod__ from "node:module";
const __filename = import.meta.filename;
const __dirname = import.meta.dirname;
const require2 = __cjs_mod__.createRequire(import.meta.url);
function decodeBodyText(buffer, headers) {
  if (buffer.byteLength === 0) return "";
  const contentType = headerToString$1(headers["content-type"]).toLowerCase();
  const contentEncoding = headerToString$1(headers["content-encoding"]).toLowerCase();
  if (!isTextLikeContent(contentType)) return `[binary body: ${buffer.byteLength} bytes]`;
  const decoded = decodeContentEncoding(buffer, contentEncoding);
  return decodeText(decoded, contentType);
}
function isTextLikeContent(contentType) {
  return contentType.includes("application/json") || contentType.includes("text/") || contentType.includes("application/xml") || contentType.includes("application/javascript") || contentType.includes("application/x-www-form-urlencoded") || contentType.includes("graphql");
}
function decodeContentEncoding(buffer, contentEncoding) {
  return contentEncoding.split(",").map((encoding) => encoding.trim()).filter(Boolean).reverse().reduce((current, encoding) => {
    try {
      if (encoding === "br") return brotliDecompressSync(current);
      if (encoding === "gzip" || encoding === "x-gzip") return gunzipSync(current);
      if (encoding === "deflate") {
        try {
          return inflateSync(current);
        } catch {
          return inflateRawSync(current);
        }
      }
    } catch {
      return current;
    }
    return current;
  }, buffer);
}
function decodeText(buffer, contentType) {
  const charset = extractCharset(contentType);
  if (charset) {
    try {
      return new TextDecoder(charset, { fatal: false }).decode(buffer);
    } catch {
      return buffer.toString("utf8");
    }
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    for (const candidate of ["shift_jis", "euc-jp", "iso-2022-jp"]) {
      try {
        return new TextDecoder(candidate, { fatal: false }).decode(buffer);
      } catch {
        continue;
      }
    }
  }
  return buffer.toString("utf8");
}
function extractCharset(contentType) {
  const match = /charset\s*=\s*"?([^";\s]+)"?/i.exec(contentType);
  if (!match) return void 0;
  const charset = match[1].toLowerCase();
  if (charset === "shift-jis" || charset === "sjis" || charset === "windows-31j") return "shift_jis";
  if (charset === "eucjp") return "euc-jp";
  if (charset === "jis" || charset === "iso2022jp") return "iso-2022-jp";
  return charset;
}
function headerToString$1(value) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}
const execFileAsync$1 = promisify(execFile);
const cache = /* @__PURE__ */ new Map();
const cacheTtlMs = 3e3;
async function findClientProcess(clientPort, proxyPort) {
  if (process.platform !== "darwin" || !clientPort) return {};
  const key = `${clientPort}:${proxyPort}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  try {
    const { stdout } = await execFileAsync$1("lsof", ["-nP", `-iTCP:${proxyPort}`, "-sTCP:ESTABLISHED"]);
    const value = parseLsof(stdout, clientPort, proxyPort);
    cache.set(key, { value, expiresAt: Date.now() + cacheTtlMs });
    return value;
  } catch {
    return {};
  }
}
function parseLsof(stdout, clientPort, proxyPort) {
  const candidates = [];
  for (const line of stdout.split("\n").slice(1)) {
    const name = line.match(/\s+(.+?\(ESTABLISHED\))$/)?.[1] || "";
    if (!name.includes(`:${clientPort}`) || !name.includes(`:${proxyPort}`)) continue;
    const columns = line.trim().split(/\s+/);
    const pid = Number(columns[1]);
    const info = {
      name: columns[0],
      pid: Number.isFinite(pid) ? pid : void 0
    };
    if (name.includes(`:${clientPort}->`) && name.includes(`:${proxyPort}`)) return info;
    candidates.push(info);
  }
  return candidates.find((candidate) => candidate.pid !== process.pid) || candidates[0] || {};
}
const browserSourceHeader = "x-steal-source";
let proxyConsoleFilterInstalled = false;
class ProxyService extends EventEmitter {
  constructor(appDataDir, host = "127.0.0.1", port = 8899) {
    super();
    this.appDataDir = appDataDir;
    this.host = host;
    this.port = port;
    const sslCaDir = join(appDataDir, "certificates");
    mkdirSync(sslCaDir, { recursive: true });
    this.status = {
      running: false,
      host,
      port,
      caCertPath: join(sslCaDir, "certs", "ca.pem"),
      sslCaDir
    };
  }
  appDataDir;
  host;
  port;
  proxy;
  captures = [];
  status;
  getStatus() {
    return { ...this.status };
  }
  getCaptures() {
    return [...this.captures].reverse();
  }
  findCapture(id) {
    return this.captures.find((capture) => capture.id === id);
  }
  clearCaptures() {
    this.captures = [];
  }
  async start() {
    if (this.proxy) return this.getStatus();
    const proxy = new Proxy();
    this.proxy = proxy;
    installProxyConsoleFilter();
    suppressNoisyProxyLogs(proxy);
    this.status = { ...this.status, running: false, error: void 0 };
    this.emit("status", this.getStatus());
    proxy.onError((_ctx, error, kind) => {
      if (isBenignProxyError(kind, error)) return;
      this.status = { ...this.status, error: error.message };
      this.emit("status", this.getStatus());
    });
    proxy.onRequest((ctx, callback) => {
      const startedAtMs = Date.now();
      const requestChunks = [];
      const responseChunks = [];
      const request = ctx.clientToProxyRequest;
      const host = headerToString(request.headers.host);
      const protocol = ctx.isSSL ? "https" : "http";
      const path = request.url || "/";
      const url = path.startsWith("http://") || path.startsWith("https://") ? path : `${protocol}://${host}${path}`;
      const source = headerToString(request.headers[browserSourceHeader]) === "browser" ? "browser" : "proxy";
      const clientPort = request.socket.remotePort || 0;
      const sourceAppLookup = source === "browser" ? Promise.resolve({ name: "Browser", pid: void 0 }) : findClientProcess(clientPort, this.port);
      delete request.headers[browserSourceHeader];
      ctx.stealSourceAppLookup = sourceAppLookup;
      ctx.stealCapture = {
        id: crypto.randomUUID(),
        method: request.method || "GET",
        url,
        protocol,
        host,
        path,
        source,
        sourceAppName: source === "browser" ? "Browser" : void 0,
        sourceProcessId: void 0,
        startedAt: new Date(startedAtMs).toISOString(),
        durationMs: 0,
        requestHeaders: normalizeHeaders(request.headers),
        requestBody: "",
        requestSize: 0,
        responseStatusCode: 0,
        responseStatusMessage: "",
        responseHeaders: {},
        responseBody: "",
        responseSize: 0
      };
      void sourceAppLookup.then((sourceApp) => {
        const capture = ctx.stealCapture;
        capture.sourceAppName = sourceApp.name || capture.sourceAppName;
        capture.sourceProcessId = sourceApp.pid;
      }).finally(callback);
      ctx.onRequestData((_ctx, chunk, done) => {
        requestChunks.push(Buffer.from(chunk));
        done(null, chunk);
      });
      ctx.onResponse((_ctx, done) => {
        const response = ctx.serverToProxyResponse;
        const capture = ctx.stealCapture;
        capture.responseStatusCode = response.statusCode || 0;
        capture.responseStatusMessage = response.statusMessage || "";
        capture.responseHeaders = normalizeHeaders(response.headers);
        done();
      });
      ctx.onResponseData((_ctx, chunk, done) => {
        responseChunks.push(Buffer.from(chunk));
        done(null, chunk);
      });
      ctx.onResponseEnd((_ctx, done) => {
        void (async () => {
          const capture = ctx.stealCapture;
          const sourceApp = await ctx.stealSourceAppLookup;
          const requestBody = Buffer.concat(requestChunks);
          const responseBody = Buffer.concat(responseChunks);
          capture.sourceAppName = sourceApp.name || capture.sourceAppName;
          capture.sourceProcessId = sourceApp.pid;
          capture.durationMs = Date.now() - startedAtMs;
          capture.requestSize = requestBody.byteLength;
          capture.responseSize = responseBody.byteLength;
          capture.requestBody = decodeBodyText(requestBody, capture.requestHeaders);
          capture.responseBody = decodeBodyText(responseBody, capture.responseHeaders);
          this.captures.push(capture);
          this.emit("capture", capture);
          done();
        })().catch((error) => done(error));
      });
    });
    await new Promise((resolve, reject) => {
      proxy.listen({ host: this.host, port: this.port, sslCaDir: this.status.sslCaDir }, (error) => {
        if (error) {
          this.proxy = void 0;
          this.status = { ...this.status, running: false, error: error.message };
          this.emit("status", this.getStatus());
          reject(error);
          return;
        }
        this.status = { ...this.status, running: true, error: void 0 };
        this.emit("status", this.getStatus());
        resolve();
      });
    });
    return this.getStatus();
  }
  async stop() {
    if (!this.proxy) return this.getStatus();
    const proxy = this.proxy;
    this.proxy = void 0;
    await withTimeout(new Promise((resolve) => proxy.close(() => resolve())), 4e3).catch(() => void 0);
    this.status = { ...this.status, running: false, error: void 0 };
    this.emit("status", this.getStatus());
    return this.getStatus();
  }
}
function normalizeHeaders(headers) {
  return Object.fromEntries(Object.entries(headers || {}).map(([key, value]) => [key.toLowerCase(), value]));
}
function headerToString(value) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}
function suppressNoisyProxyLogs(proxy) {
  const mutableProxy = proxy;
  const originalOnError = mutableProxy._onError.bind(proxy);
  mutableProxy._onError = (kind, ctx, error) => {
    if (isBenignProxyError(kind, error)) return;
    originalOnError(kind, ctx, error);
  };
}
function isBenignProxyError(kind, error) {
  const code = error.code;
  if (kind === "HTTPS_CLIENT_ERROR" && (code === "ECONNRESET" || error.message === "socket hang up")) return true;
  if (code === "ECONNRESET" || code === "EPIPE") return true;
  return false;
}
function installProxyConsoleFilter() {
  if (proxyConsoleFilterInstalled) return;
  proxyConsoleFilterInstalled = true;
  const originalDebug = console.debug.bind(console);
  console.debug = (...args) => {
    const message = args.map(String).join(" ");
    if (/^(starting server for|https server started for|creating SNI context for|https server started on)/.test(message)) return;
    originalDebug(...args);
  };
}
function withTimeout(promise, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms.`)), timeoutMs);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}
const defaultSettings = {
  autoStartProxy: true,
  systemProxyEnabled: true,
  autoShowBrowser: true,
  browserMode: "embedded"
};
class SettingsStore {
  constructor(filePath) {
    this.filePath = filePath;
    mkdirSync(dirname(filePath), { recursive: true });
  }
  filePath;
  async get() {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw);
      return normalizeSettings(parsed);
    } catch {
      await this.set(defaultSettings);
      return defaultSettings;
    }
  }
  async update(patch) {
    const next = normalizeSettings({ ...await this.get(), ...patch });
    await this.set(next);
    return next;
  }
  async set(settings) {
    await writeFile(this.filePath, JSON.stringify(settings, null, 2));
  }
}
function normalizeSettings(value) {
  return {
    autoStartProxy: typeof value.autoStartProxy === "boolean" ? value.autoStartProxy : defaultSettings.autoStartProxy,
    systemProxyEnabled: typeof value.systemProxyEnabled === "boolean" ? value.systemProxyEnabled : defaultSettings.systemProxyEnabled,
    autoShowBrowser: typeof value.autoShowBrowser === "boolean" ? value.autoShowBrowser : defaultSettings.autoShowBrowser,
    browserMode: value.browserMode === "chrome" ? "chrome" : "embedded"
  };
}
class SavedApiStore {
  constructor(collectionsDir) {
    this.collectionsDir = collectionsDir;
    this.collectionsIndexPath = join(collectionsDir, "collections.json");
  }
  collectionsDir;
  collectionsIndexPath;
  async ensureReady() {
    await mkdir(this.collectionsDir, { recursive: true });
  }
  async list() {
    await this.ensureReady();
    const files = await readdir(this.collectionsDir);
    const saved = await Promise.all(
      files.filter((file) => file.endsWith(".json") && file !== "collections.json").map(async (file) => {
        const raw = await readFile(join(this.collectionsDir, file), "utf8");
        return JSON.parse(raw);
      })
    );
    return saved.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }
  async listCollections() {
    await this.ensureReady();
    const [collections, savedApis] = await Promise.all([this.readCollections(), this.list()]);
    const counts = /* @__PURE__ */ new Map();
    for (const api of savedApis) {
      if (api.collectionId) counts.set(api.collectionId, (counts.get(api.collectionId) || 0) + 1);
    }
    return collections.map((collection) => ({ ...collection, itemCount: counts.get(collection.id) || 0 })).sort((a, b) => a.name.localeCompare(b.name));
  }
  async save(exchange, name, tags, collectionName) {
    await this.ensureReady();
    const collection = await this.ensureCollection(collectionName);
    const saved = {
      id: crypto.randomUUID(),
      name: name.trim() || `${exchange.method} ${new URL(exchange.url).pathname}`,
      tags,
      savedAt: (/* @__PURE__ */ new Date()).toISOString(),
      collectionId: collection.id,
      collectionName: collection.name,
      exchange: {
        ...exchange,
        savedName: name.trim(),
        tags
      }
    };
    await writeFile(join(this.collectionsDir, `${saved.id}.json`), JSON.stringify(saved, null, 2));
    return saved;
  }
  async importMany(savedApis) {
    await this.ensureReady();
    const imported = await Promise.all(
      savedApis.map(async (api) => {
        const collection = await this.ensureCollection(api.collectionName || "Default");
        const item = {
          ...api,
          id: api.id || crypto.randomUUID(),
          collectionId: api.collectionId || collection.id,
          collectionName: api.collectionName || collection.name
        };
        await writeFile(join(this.collectionsDir, `${item.id}.json`), JSON.stringify(item, null, 2));
        return item;
      })
    );
    return imported;
  }
  async ensureCollection(name) {
    const collections = await this.readCollections();
    const normalizedName = name.trim() || "Default";
    const existing = collections.find((collection) => collection.name.toLowerCase() === normalizedName.toLowerCase());
    if (existing) {
      const updated = { ...existing, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
      await this.writeCollections(collections.map((collection) => collection.id === existing.id ? updated : collection));
      return updated;
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const created = {
      id: crypto.randomUUID(),
      name: normalizedName,
      createdAt: now,
      updatedAt: now,
      itemCount: 0
    };
    await this.writeCollections([...collections, created]);
    return created;
  }
  async readCollections() {
    await this.ensureReady();
    try {
      const raw = await readFile(this.collectionsIndexPath, "utf8");
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
  async writeCollections(collections) {
    await writeFile(this.collectionsIndexPath, JSON.stringify(collections, null, 2));
  }
}
const execFileAsync = promisify(execFile);
const defaultExecOptions = { encoding: "utf8", timeout: 8e3 };
let snapshot;
async function enableSystemProxy(host, port) {
  if (process.platform !== "darwin") return;
  const services = await listNetworkServices();
  if (!snapshot) {
    snapshot = await Promise.all(services.map(async (service) => ({
      service,
      web: await getProxyConfig(service, "web"),
      secureWeb: await getProxyConfig(service, "secureWeb")
    })));
  }
  for (const service of services) {
    await runNetworksetup(["-setwebproxy", service, host, String(port)]);
    await runNetworksetup(["-setsecurewebproxy", service, host, String(port)]);
    await runNetworksetup(["-setwebproxystate", service, "on"]);
    await runNetworksetup(["-setsecurewebproxystate", service, "on"]);
  }
}
async function restoreSystemProxy() {
  if (process.platform !== "darwin" || !snapshot) return;
  const previous = snapshot;
  snapshot = void 0;
  for (const config of previous) {
    await restoreServiceProxy(config.service, "web", config.web);
    await restoreServiceProxy(config.service, "secureWeb", config.secureWeb);
  }
}
async function disableStealSystemProxy(host, port) {
  if (process.platform !== "darwin") return;
  const services = await listNetworkServices();
  for (const service of services) {
    await disableServiceProxyIfMatches(service, "web", host, port);
    await disableServiceProxyIfMatches(service, "secureWeb", host, port);
  }
  snapshot = void 0;
}
async function isCertificateTrusted(certificatePath) {
  if (process.platform !== "darwin") return true;
  if (!existsSync(certificatePath)) return false;
  try {
    await runExecFile("security", ["verify-cert", "-c", certificatePath, "-p", "ssl"]);
    return true;
  } catch {
    return false;
  }
}
async function installTrustedCertificate(certificatePath) {
  if (process.platform !== "darwin" || !existsSync(certificatePath)) return;
  const command = [
    "security",
    "add-trusted-cert",
    "-d",
    "-r",
    "trustRoot",
    "-p",
    "ssl",
    "-p",
    "basic",
    "-k",
    "/Library/Keychains/System.keychain",
    shellQuote(certificatePath)
  ].join(" ");
  try {
    await runExecFile("osascript", [
      "-e",
      `do shell script ${appleScriptQuote(command)} with administrator privileges`
    ], 12e4);
  } catch (error) {
    await installTrustedCertificateInTerminal(command);
  }
}
async function listNetworkServices() {
  const { stdout } = await runExecFile("networksetup", ["-listallnetworkservices"]);
  return stdout.split("\n").map((line) => line.trim()).filter((line) => line && !line.startsWith("An asterisk") && !line.startsWith("*"));
}
async function getProxyConfig(service, kind) {
  const flag = kind === "web" ? "-getwebproxy" : "-getsecurewebproxy";
  const { stdout } = await runExecFile("networksetup", [flag, service]);
  const values = Object.fromEntries(
    stdout.split("\n").map((line) => line.split(":")).filter((parts) => parts.length >= 2).map(([key, ...rest]) => [key.trim(), rest.join(":").trim()])
  );
  return {
    enabled: values.Enabled === "Yes",
    server: values.Server || "",
    port: values.Port || ""
  };
}
async function restoreServiceProxy(service, kind, config) {
  const setFlag = kind === "web" ? "-setwebproxy" : "-setsecurewebproxy";
  const stateFlag = kind === "web" ? "-setwebproxystate" : "-setsecurewebproxystate";
  if (config.server && config.port) {
    await runNetworksetup([setFlag, service, config.server, config.port]);
  }
  await runNetworksetup([stateFlag, service, config.enabled ? "on" : "off"]);
}
async function disableServiceProxyIfMatches(service, kind, host, port) {
  const stateFlag = kind === "web" ? "-setwebproxystate" : "-setsecurewebproxystate";
  const config = await getProxyConfig(service, kind);
  if (config.server === host && config.port === String(port)) {
    await runNetworksetup([stateFlag, service, "off"]);
  }
}
async function runNetworksetup(args) {
  try {
    await runExecFile("networksetup", args);
  } catch {
    await runExecFile("osascript", [
      "-e",
      `do shell script ${appleScriptQuote(["networksetup", ...args].map(shellQuote).join(" "))} with administrator privileges`
    ], 15e3);
  }
}
function shellQuote(value) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
function appleScriptQuote(value) {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}
async function installTrustedCertificateInTerminal(command) {
  const terminalCommand = [
    'echo "Installing Steal HTTPS certificate into the System keychain."',
    `sudo ${command}`,
    "echo",
    'echo "Done. You can close this Terminal window."',
    'read -n 1 -s -r -p "Press any key to close..."',
    "exit"
  ].join("; ");
  await runExecFile("osascript", [
    "-e",
    'tell application "Terminal"',
    "-e",
    "activate",
    "-e",
    `do script ${appleScriptQuote(terminalCommand)}`,
    "-e",
    "end tell"
  ]);
}
async function runExecFile(file, args, timeout = 8e3) {
  return execFileAsync(file, args, { ...defaultExecOptions, timeout });
}
let mainWindow;
let proxyService;
let savedApiStore;
let settingsStore;
let certificatePromptInFlight = false;
let tray;
let trayProxyTransitioning = false;
const isDev = !!process.env.ELECTRON_RENDERER_URL;
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1120,
    minHeight: 720,
    title: "Steal",
    backgroundColor: "#f7f8fb",
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true
    }
  });
  if (isDev) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    console.error("Renderer failed to load", { errorCode, errorDescription, validatedURL });
  });
  mainWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    console.log(`renderer[${level}] ${message} (${sourceId}:${line})`);
  });
  mainWindow.on("closed", () => {
    mainWindow = void 0;
  });
}
app.whenReady().then(async () => {
  const dataDir = join(app.getPath("userData"), "steal-data");
  mkdirSync(dataDir, { recursive: true });
  proxyService = new ProxyService(dataDir);
  savedApiStore = new SavedApiStore(join(dataDir, "collections"));
  settingsStore = new SettingsStore(join(dataDir, "settings.json"));
  const settings = await settingsStore.get();
  registerIpc();
  wireProxyEvents();
  await configureCaptureSession();
  createWindow();
  createTray();
  if (settings.autoStartProxy) await startProxyWithSystemSetup().catch(() => void 0);
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("before-quit", () => {
  restoreSystemProxy().catch(() => void 0);
  proxyService?.stop().catch(() => void 0);
});
app.on("certificate-error", (event, webContents, _url, _error, _certificate, callback) => {
  if (webContents.getType() === "webview") {
    event.preventDefault();
    callback(true);
    return;
  }
  callback(false);
});
async function configureCaptureSession() {
  const captureSession = session.fromPartition("persist:capture-browser");
  await captureSession.setProxy({
    proxyRules: "http=127.0.0.1:8899;https=127.0.0.1:8899",
    proxyBypassRules: "<local>"
  });
  captureSession.webRequest.onBeforeSendHeaders((details, callback) => {
    callback({
      requestHeaders: {
        ...details.requestHeaders,
        "x-steal-source": "browser"
      }
    });
  });
}
function wireProxyEvents() {
  proxyService.on("capture", (exchange) => {
    mainWindow?.webContents.send("captures:new", exchange);
  });
  proxyService.on("status", (status) => {
    mainWindow?.webContents.send("proxy:changed", status);
    updateTray(status);
  });
}
function registerIpc() {
  ipcMain.handle("settings:get", () => settingsStore.get());
  ipcMain.handle("settings:update", (_event, patch) => settingsStore.update(patch));
  ipcMain.handle("proxy:status", () => proxyService.getStatus());
  ipcMain.handle("proxy:start", () => startProxyWithSystemSetup());
  ipcMain.handle("proxy:stop", () => stopProxyWithSystemRestore());
  ipcMain.handle("system-proxy:enable", async () => {
    const status = proxyService.getStatus();
    if (status.running) await enableSystemProxy(status.host, status.port);
  });
  ipcMain.handle("system-proxy:disable", () => {
    const status = proxyService.getStatus();
    return disableStealSystemProxy(status.host, status.port);
  });
  ipcMain.handle("captures:list", () => proxyService.getCaptures());
  ipcMain.handle("captures:clear", () => {
    proxyService.clearCaptures();
  });
  ipcMain.handle("saved:list", () => savedApiStore.list());
  ipcMain.handle("collections:list", () => savedApiStore.listCollections());
  ipcMain.handle("saved:save", async (_event, payload) => {
    const exchange = proxyService.findCapture(payload.exchangeId);
    if (!exchange) throw new Error("Capture not found.");
    return savedApiStore.save(exchange, payload.name, payload.tags, payload.collectionName);
  });
  ipcMain.handle("saved:export", async () => {
    const saved = await savedApiStore.list();
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: "Export saved APIs",
      defaultPath: "steal-apis.json",
      filters: [{ name: "JSON", extensions: ["json"] }]
    });
    if (canceled || !filePath) return void 0;
    await writeFile(filePath, JSON.stringify(saved, null, 2));
    return filePath;
  });
  ipcMain.handle("saved:import", async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: "Import saved APIs",
      properties: ["openFile"],
      filters: [{ name: "JSON", extensions: ["json"] }]
    });
    if (canceled || filePaths.length === 0) return savedApiStore.list();
    const raw = await readFile(filePaths[0], "utf8");
    const parsed = JSON.parse(raw);
    await savedApiStore.importMany(Array.isArray(parsed) ? parsed : [parsed]);
    return savedApiStore.list();
  });
  ipcMain.handle("replay:send", (_event, request) => replay(request));
  ipcMain.handle("cert:open-folder", async () => {
    const status = proxyService.getStatus();
    if (existsSync(status.sslCaDir)) await shell.openPath(status.sslCaDir);
  });
  ipcMain.handle("browser:launch-chrome", (_event, url) => launchChromeBrowser(url));
}
async function startProxyWithSystemSetup() {
  const status = await proxyService.start();
  updateTray(status);
  const settings = await settingsStore.get();
  if (settings.systemProxyEnabled) {
    await enableSystemProxy(status.host, status.port).catch((error) => {
      console.error("Failed to configure system proxy", error);
    });
  }
  await promptForCertificateInstallIfNeeded(status).catch((error) => {
    console.error("Failed to install certificate", error);
  });
  const nextStatus = proxyService.getStatus();
  updateTray(nextStatus);
  return nextStatus;
}
async function stopProxyWithSystemRestore() {
  try {
    await restoreSystemProxy();
  } catch (error) {
    console.error("Failed to restore system proxy", error);
  }
  try {
    const status = await proxyService.stop();
    updateTray(status);
    return status;
  } catch (error) {
    console.error("Failed to stop proxy", error);
    const status = { ...proxyService.getStatus(), running: false, error: error instanceof Error ? error.message : String(error) };
    updateTray(status);
    return status;
  }
}
function createTray() {
  tray = new Tray(createTrayIcon());
  tray.setToolTip("Steal");
  tray.on("click", () => showMainWindow());
  updateTray(proxyService.getStatus());
}
function updateTray(status = proxyService.getStatus()) {
  if (!tray) return;
  tray.setToolTip(`Steal - ${status.running ? "Proxy running" : "Proxy stopped"}`);
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: status.running ? "Stop Proxy" : "Start Proxy",
      enabled: !trayProxyTransitioning,
      click: () => {
        void toggleProxyFromTray();
      }
    },
    { type: "separator" },
    {
      label: mainWindow?.isVisible() ? "Hide Window" : "Show Window",
      click: () => {
        if (mainWindow?.isVisible()) mainWindow.hide();
        else showMainWindow();
        updateTray();
      }
    },
    {
      label: "Open Certificate Folder",
      click: async () => {
        const current = proxyService.getStatus();
        if (existsSync(current.sslCaDir)) await shell.openPath(current.sslCaDir);
      }
    },
    { type: "separator" },
    {
      label: "Quit Steal",
      click: () => app.quit()
    }
  ]));
}
async function toggleProxyFromTray() {
  if (trayProxyTransitioning) return;
  trayProxyTransitioning = true;
  updateTray();
  try {
    if (proxyService.getStatus().running) await stopProxyWithSystemRestore();
    else await startProxyWithSystemSetup();
  } finally {
    trayProxyTransitioning = false;
    updateTray();
  }
}
function showMainWindow() {
  if (!mainWindow) {
    createWindow();
  }
  mainWindow?.show();
  mainWindow?.focus();
}
function createTrayIcon() {
  const svg = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">
      <rect x="2" y="3" width="14" height="12" rx="3" fill="#2457c5"/>
      <path d="M5 9h8M9 5v8" stroke="white" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `.trim());
  const image = nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${svg}`);
  if (process.platform === "darwin") image.setTemplateImage(true);
  return image;
}
async function promptForCertificateInstallIfNeeded(status) {
  if (process.platform !== "darwin" || certificatePromptInFlight || !existsSync(status.caCertPath)) return;
  if (await isCertificateTrusted(status.caCertPath)) return;
  certificatePromptInFlight = true;
  try {
    const result = await dialog.showMessageBox(mainWindow, {
      type: "warning",
      buttons: ["Install", "Cancel"],
      defaultId: 0,
      cancelId: 1,
      title: "Install Steal HTTPS Certificate",
      message: "HTTPS capture needs the Steal local CA certificate.",
      detail: "The certificate is not trusted yet. Install it into the macOS System keychain using administrator privileges?"
    });
    if (result.response !== 0) return;
    await installTrustedCertificate(status.caCertPath);
  } finally {
    certificatePromptInFlight = false;
  }
}
async function replay(request) {
  const startedAt = performance.now();
  const headers = Object.fromEntries(Object.entries(request.headers).filter(([, value]) => value.trim() !== ""));
  const response = await fetch(request.url, {
    method: request.method,
    headers,
    body: ["GET", "HEAD"].includes(request.method.toUpperCase()) ? void 0 : request.body
  });
  const responseBuffer = Buffer.from(await response.arrayBuffer());
  const responseHeaders = Object.fromEntries(response.headers.entries());
  const body = decodeBodyText(responseBuffer, responseHeaders);
  return {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
    body,
    durationMs: Math.round(performance.now() - startedAt),
    size: responseBuffer.byteLength
  };
}
async function launchChromeBrowser(url) {
  const profileDir = join(app.getPath("userData"), "steal-chrome-profile");
  mkdirSync(profileDir, { recursive: true });
  const targetUrl = /^https?:\/\//i.test(url) ? url : "https://www.google.com";
  const args = [
    "--new-window",
    `--user-data-dir=${profileDir}`,
    `--proxy-server=http=${proxyService.getStatus().host}:${proxyService.getStatus().port};https=${proxyService.getStatus().host}:${proxyService.getStatus().port}`,
    "--remote-debugging-port=9222",
    "--disable-quic",
    targetUrl
  ];
  if (process.platform === "darwin") {
    await new Promise((resolve, reject) => {
      execFile("open", ["-na", "Google Chrome", "--args", ...args], (error) => error ? reject(error) : resolve());
    });
    return;
  }
  if (process.platform === "win32") {
    await new Promise((resolve, reject) => {
      execFile("cmd", ["/c", "start", "chrome", ...args], (error) => error ? reject(error) : resolve());
    });
    return;
  }
  await new Promise((resolve, reject) => {
    execFile("google-chrome", args, (error) => error ? reject(error) : resolve());
  });
}
