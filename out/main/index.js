import { app, dialog, BrowserWindow, session, ipcMain, shell, clipboard, Tray, Menu, nativeImage } from "electron";
import { execFile } from "node:child_process";
import { dirname, join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { mkdirSync, existsSync, readFileSync, readdirSync, writeFileSync, watch } from "node:fs";
import { P as ProxyService, S as SavedApiStore, a as SettingsStore, W as WorkspaceStore, M as McpBridgeServer, r as resolveStealBridgeFilePath, b as replayRequest } from "./chunks/mcp-bridge-DmR7Ft71.js";
import { promisify } from "node:util";
import "node:events";
import "node:net";
import "http-mitm-proxy";
import "node:zlib";
import "node:crypto";
import "node:http";
import "node:os";
import __cjs_mod__ from "node:module";
const __filename = import.meta.filename;
const __dirname = import.meta.dirname;
const require2 = __cjs_mod__.createRequire(import.meta.url);
const defaultTheme = {
  name: "Steal Light",
  colors: {
    text: "#18202f",
    textStrong: "#172033",
    textMuted: "#667386",
    appBackground: "#f7f8fb",
    surface: "#ffffff",
    surfaceSubtle: "#fbfcfe",
    surfaceHover: "#f4f7fb",
    border: "#dfe4ec",
    borderStrong: "#9aa8ba",
    primary: "#2457c5",
    primaryHover: "#1d489f",
    primarySoft: "#eef4ff",
    primaryBorder: "#b9c8eb",
    success: "#17684a",
    successSoft: "#eefaf4",
    warning: "#8a4d05",
    warningSoft: "#fff7e6",
    danger: "#991b1b",
    dangerSoft: "#fff1f2",
    codeBackground: "#111827",
    codeText: "#d6deeb",
    overlay: "rgba(15, 23, 42, 0.28)"
  },
  methods: {
    default: { text: "#233044", background: "#e8edf5" },
    get: { text: "#17684a", background: "#eefaf4" },
    post: { text: "#8a4d05", background: "#fff7e6" },
    put: { text: "#8a4d05", background: "#fff7e6" },
    patch: { text: "#8a4d05", background: "#fff7e6" },
    delete: { text: "#991b1b", background: "#fff1f2" },
    head: { text: "#2457c5", background: "#eef4ff" },
    options: { text: "#2457c5", background: "#eef4ff" }
  }
};
const themePresets = [
  defaultTheme,
  makeTheme("Steal_Dark", {
    text: "#d7dde8",
    textStrong: "#f4f7fb",
    textMuted: "#93a0b4",
    appBackground: "#111722",
    surface: "#171f2c",
    surfaceSubtle: "#131b27",
    surfaceHover: "#202a39",
    border: "#2d394a",
    borderStrong: "#607089",
    primary: "#6ea2ff",
    primaryHover: "#8bb6ff",
    primarySoft: "#1b3157",
    primaryBorder: "#385f9f",
    success: "#6bd69b",
    successSoft: "#173b2a",
    warning: "#f6c56b",
    warningSoft: "#3d2d13",
    danger: "#ff7a7a",
    dangerSoft: "#451e25",
    codeBackground: "#0a0f18",
    codeText: "#dce7f7",
    overlay: "rgba(0, 0, 0, 0.44)"
  }, {
    default: { text: "#d9e4f2", background: "#263244" },
    get: { text: "#6bd69b", background: "#173b2a" },
    post: { text: "#f6c56b", background: "#3d2d13" },
    put: { text: "#f6c56b", background: "#3d2d13" },
    patch: { text: "#f6c56b", background: "#3d2d13" },
    delete: { text: "#ff7a7a", background: "#451e25" },
    head: { text: "#8bb6ff", background: "#1b3157" },
    options: { text: "#8bb6ff", background: "#1b3157" }
  }),
  makeTheme("Sakura", {
    text: "#342530",
    textStrong: "#231821",
    textMuted: "#7b6270",
    appBackground: "#fff7fa",
    surface: "#ffffff",
    surfaceSubtle: "#fff1f6",
    surfaceHover: "#ffe8f0",
    border: "#efd2de",
    borderStrong: "#c995ab",
    primary: "#c94f7c",
    primaryHover: "#a83d66",
    primarySoft: "#ffe4ee",
    primaryBorder: "#f0a9c2",
    success: "#477d62",
    successSoft: "#edf8f1",
    warning: "#9a6b1c",
    warningSoft: "#fff5dc",
    danger: "#b7355f",
    dangerSoft: "#ffe7ee",
    codeBackground: "#2a1825",
    codeText: "#ffeaf2",
    overlay: "rgba(80, 28, 52, 0.24)"
  }, {
    get: { text: "#477d62", background: "#edf8f1" },
    post: { text: "#c94f7c", background: "#ffe4ee" },
    put: { text: "#a83d66", background: "#ffe4ee" },
    patch: { text: "#a83d66", background: "#ffe4ee" },
    delete: { text: "#b7355f", background: "#ffe7ee" }
  }),
  makeTheme("Sakura_Dark", {
    text: "#f1dce7",
    textStrong: "#fff6fa",
    textMuted: "#c69aac",
    appBackground: "#1b1118",
    surface: "#241721",
    surfaceSubtle: "#1f141d",
    surfaceHover: "#30202b",
    border: "#4a2d3c",
    borderStrong: "#9a6279",
    primary: "#ff8ab3",
    primaryHover: "#ffacc8",
    primarySoft: "#4a2032",
    primaryBorder: "#8d4561",
    success: "#8bd9a8",
    successSoft: "#1c3a2b",
    warning: "#ffd17a",
    warningSoft: "#402d16",
    danger: "#ff7f9f",
    dangerSoft: "#4a1d2b",
    codeBackground: "#120b10",
    codeText: "#f9ddea",
    overlay: "rgba(0, 0, 0, 0.48)"
  }, {
    get: { text: "#8bd9a8", background: "#1c3a2b" },
    post: { text: "#ff8ab3", background: "#4a2032" },
    put: { text: "#ffacc8", background: "#4a2032" },
    patch: { text: "#ffacc8", background: "#4a2032" },
    delete: { text: "#ff7f9f", background: "#4a1d2b" },
    head: { text: "#ffacc8", background: "#4a2032" },
    options: { text: "#ffacc8", background: "#4a2032" }
  }),
  makeTheme("Midnight", {
    text: "#d9e4f2",
    textStrong: "#f8fbff",
    textMuted: "#91a5bd",
    appBackground: "#0b1220",
    surface: "#101a2b",
    surfaceSubtle: "#0d1626",
    surfaceHover: "#17243a",
    border: "#263854",
    borderStrong: "#5b759b",
    primary: "#4cc9f0",
    primaryHover: "#75dbf6",
    primarySoft: "#12344b",
    primaryBorder: "#2f718f",
    success: "#7ee7b1",
    successSoft: "#123729",
    warning: "#f8d66d",
    warningSoft: "#392f15",
    danger: "#ff6b88",
    dangerSoft: "#421b28",
    codeBackground: "#070c14",
    codeText: "#d9e9ff",
    overlay: "rgba(0, 0, 0, 0.5)"
  }, {
    get: { text: "#7ee7b1", background: "#123729" },
    post: { text: "#f8d66d", background: "#392f15" },
    put: { text: "#f8d66d", background: "#392f15" },
    patch: { text: "#f8d66d", background: "#392f15" },
    delete: { text: "#ff6b88", background: "#421b28" },
    head: { text: "#4cc9f0", background: "#12344b" },
    options: { text: "#4cc9f0", background: "#12344b" }
  }),
  makeTheme("Forest", {
    text: "#1b2a22",
    textStrong: "#102017",
    textMuted: "#5b6f62",
    appBackground: "#f3f8f1",
    surface: "#ffffff",
    surfaceSubtle: "#eef6ed",
    surfaceHover: "#e4efe2",
    border: "#ccdcca",
    borderStrong: "#8fa58d",
    primary: "#2f7d58",
    primaryHover: "#256346",
    primarySoft: "#e3f4ea",
    primaryBorder: "#a6cfb6",
    success: "#1d7a4d",
    successSoft: "#e5f6ec",
    warning: "#8b6b18",
    warningSoft: "#fff7d8",
    danger: "#a13c3c",
    dangerSoft: "#fdeaea",
    codeBackground: "#132017",
    codeText: "#dbf2df",
    overlay: "rgba(20, 45, 28, 0.28)"
  }, {
    get: { text: "#1d7a4d", background: "#e5f6ec" },
    post: { text: "#2f7d58", background: "#e3f4ea" },
    put: { text: "#2f7d58", background: "#e3f4ea" },
    patch: { text: "#2f7d58", background: "#e3f4ea" },
    delete: { text: "#a13c3c", background: "#fdeaea" }
  }),
  makeTheme("Amber", {
    text: "#2d261f",
    textStrong: "#1f1711",
    textMuted: "#74675a",
    appBackground: "#fbf7ef",
    surface: "#ffffff",
    surfaceSubtle: "#fff7e8",
    surfaceHover: "#ffefd1",
    border: "#ead8bb",
    borderStrong: "#b8955f",
    primary: "#b76e00",
    primaryHover: "#925800",
    primarySoft: "#fff0cf",
    primaryBorder: "#e4bd78",
    success: "#527a35",
    successSoft: "#edf7e5",
    warning: "#a06100",
    warningSoft: "#fff4d7",
    danger: "#a43e2f",
    dangerSoft: "#fdebe7",
    codeBackground: "#24190e",
    codeText: "#ffe7c2",
    overlay: "rgba(70, 42, 8, 0.28)"
  }, {
    get: { text: "#527a35", background: "#edf7e5" },
    post: { text: "#b76e00", background: "#fff0cf" },
    put: { text: "#925800", background: "#fff0cf" },
    patch: { text: "#925800", background: "#fff0cf" },
    delete: { text: "#a43e2f", background: "#fdebe7" }
  })
];
const colorPattern = /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|[a-zA-Z]+)$/;
class ThemeStore {
  constructor(filePath) {
    this.filePath = filePath;
    mkdirSync(dirname(filePath), { recursive: true });
  }
  filePath;
  get path() {
    return this.filePath;
  }
  async get() {
    try {
      const raw = await readFile(this.filePath, "utf8");
      return normalizeTheme(JSON.parse(raw));
    } catch {
      await this.set(defaultTheme);
      return defaultTheme;
    }
  }
  async update(theme) {
    const next = normalizeTheme(theme);
    await this.set(next);
    return next;
  }
  async reset() {
    await this.set(defaultTheme);
    return defaultTheme;
  }
  presets() {
    return themePresets.map((theme) => normalizeTheme(theme));
  }
  async set(theme) {
    await writeFile(this.filePath, JSON.stringify(theme, null, 2));
  }
}
function makeTheme(name, colors, methods = {}) {
  return { name, colors, methods: { ...defaultTheme.methods, ...methods } };
}
function normalizeTheme(value) {
  const colors = value.colors || {};
  const methods = value.methods || {};
  return {
    name: typeof value.name === "string" && value.name.trim() ? value.name.trim() : defaultTheme.name,
    colors: Object.fromEntries(
      Object.entries(defaultTheme.colors).map(([key, fallback]) => {
        const candidate = colors[key];
        return [key, typeof candidate === "string" && colorPattern.test(candidate.trim()) ? candidate.trim() : fallback];
      })
    ),
    methods: Object.fromEntries(
      Object.entries(defaultTheme.methods).map(([key, fallback]) => {
        const candidate = methods[key];
        return [key, {
          text: normalizeColor(candidate?.text, fallback.text),
          background: normalizeColor(candidate?.background, fallback.background)
        }];
      })
    )
  };
}
function normalizeColor(value, fallback) {
  return typeof value === "string" && colorPattern.test(value.trim()) ? value.trim() : fallback;
}
function capturesToHar(captures) {
  return {
    log: {
      version: "1.2",
      creator: {
        name: "Steal",
        version: "0.1.0"
      },
      entries: captures.slice().reverse().map(captureToHarEntry)
    }
  };
}
function capturesFromHar(value) {
  const entries = readHarEntries(value);
  return entries.map(harEntryToCapture);
}
function captureToHarEntry(capture) {
  const requestMimeType = headerToString(capture.requestHeaders["content-type"]);
  const responseMimeType = headerToString(capture.responseHeaders["content-type"]);
  return {
    startedDateTime: capture.startedAt,
    time: capture.durationMs,
    request: {
      method: capture.method,
      url: capture.url,
      httpVersion: "HTTP/1.1",
      cookies: [],
      headers: headersToHar(capture.requestHeaders),
      queryString: queryToHar(capture.url),
      postData: bodyToHarPostData(capture.requestBody, capture.requestBodyBase64, requestMimeType),
      headersSize: -1,
      bodySize: capture.requestSize
    },
    response: {
      status: capture.responseStatusCode,
      statusText: capture.responseStatusMessage,
      httpVersion: "HTTP/1.1",
      cookies: [],
      headers: headersToHar(capture.responseHeaders),
      content: bodyToHarContent(capture.responseBody, capture.responseBodyBase64, responseMimeType, capture.responseSize),
      redirectURL: headerToString(capture.responseHeaders.location),
      headersSize: -1,
      bodySize: capture.responseSize
    },
    cache: {},
    timings: {
      send: 0,
      wait: capture.durationMs,
      receive: 0
    }
  };
}
function harEntryToCapture(entry) {
  const requestHeaders = harHeadersToMap(entry.request?.headers);
  const responseHeaders = harHeadersToMap(entry.response?.headers);
  const url = entry.request?.url || "http://unknown.local/";
  const parsedUrl = safeUrl(url);
  const requestBody = harBodyToCaptureBody(entry.request?.postData?.text, entry.request?.postData?.encoding, entry.request?.postData?.mimeType);
  const responseBody = harBodyToCaptureBody(entry.response?.content?.text, entry.response?.content?.encoding, entry.response?.content?.mimeType);
  return {
    id: crypto.randomUUID(),
    method: entry.request?.method || "GET",
    url,
    protocol: parsedUrl.protocol === "https:" ? "https" : "http",
    host: parsedUrl.host,
    path: `${parsedUrl.pathname}${parsedUrl.search}`,
    source: "proxy",
    startedAt: entry.startedDateTime || (/* @__PURE__ */ new Date()).toISOString(),
    durationMs: Number.isFinite(entry.time) ? Math.max(0, entry.time) : 0,
    requestHeaders,
    requestBody: requestBody.text,
    requestBodyBase64: requestBody.base64,
    requestSize: entry.request?.bodySize && entry.request.bodySize > 0 ? entry.request.bodySize : byteLength(requestBody),
    responseStatusCode: entry.response?.status || 0,
    responseStatusMessage: entry.response?.statusText || "",
    responseHeaders,
    responseBody: responseBody.text,
    responseBodyBase64: responseBody.base64,
    responseSize: entry.response?.bodySize && entry.response.bodySize > 0 ? entry.response.bodySize : byteLength(responseBody)
  };
}
function readHarEntries(value) {
  if (!value || typeof value !== "object") throw new Error("Invalid HAR file.");
  const root = value;
  if (!Array.isArray(root.log?.entries)) throw new Error("HAR log.entries was not found.");
  return root.log.entries;
}
function bodyToHarPostData(text, base64, mimeType) {
  if (!text && !base64) return void 0;
  return {
    mimeType: mimeType || "application/octet-stream",
    text: base64 || text,
    encoding: base64 ? "base64" : void 0
  };
}
function bodyToHarContent(text, base64, mimeType, size) {
  return {
    size,
    mimeType: mimeType || "application/octet-stream",
    text: base64 || text,
    encoding: base64 ? "base64" : void 0
  };
}
function harBodyToCaptureBody(text, encoding, mimeType) {
  if (!text) return { text: "" };
  if (encoding !== "base64") return { text };
  const buffer = Buffer.from(text, "base64");
  if (isTextMime(mimeType || "")) return { text: buffer.toString("utf8") };
  return {
    text: `[binary body: ${buffer.byteLength} bytes]`,
    base64: text
  };
}
function byteLength(body) {
  if (body.base64) return Buffer.from(body.base64, "base64").byteLength;
  return Buffer.byteLength(body.text);
}
function headersToHar(headers) {
  return Object.entries(headers || {}).flatMap(([name, value]) => {
    if (Array.isArray(value)) return value.map((item) => ({ name, value: item }));
    if (value === void 0) return [];
    return [{ name, value }];
  });
}
function harHeadersToMap(headers) {
  const output = {};
  for (const header of headers || []) {
    if (!header?.name) continue;
    const key = header.name.toLowerCase();
    if (output[key] === void 0) {
      output[key] = String(header.value ?? "");
    } else if (Array.isArray(output[key])) {
      output[key].push(String(header.value ?? ""));
    } else {
      output[key] = [String(output[key]), String(header.value ?? "")];
    }
  }
  return output;
}
function queryToHar(url) {
  return Array.from(safeUrl(url).searchParams.entries()).map(([name, value]) => ({ name, value }));
}
function safeUrl(url) {
  try {
    return new URL(url);
  } catch {
    return new URL("http://unknown.local/");
  }
}
function headerToString(value) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}
function isTextMime(mimeType) {
  const normalized = mimeType.toLowerCase();
  return normalized.startsWith("text/") || normalized.includes("json") || normalized.includes("xml") || normalized.includes("javascript") || normalized.includes("x-www-form-urlencoded");
}
const execFileAsync = promisify(execFile);
const defaultExecOptions = { encoding: "utf8", timeout: 8e3 };
const windowsInternetSettingsKey = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings";
let snapshot;
let windowsSnapshot;
async function enableSystemProxy(host, port) {
  if (process.platform === "win32") {
    await enableWindowsSystemProxy(host, port);
    return;
  }
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
  if (process.platform === "win32") {
    await restoreWindowsSystemProxy();
    return;
  }
  if (process.platform !== "darwin" || !snapshot) return;
  const previous = snapshot;
  snapshot = void 0;
  for (const config of previous) {
    await restoreServiceProxy(config.service, "web", config.web);
    await restoreServiceProxy(config.service, "secureWeb", config.secureWeb);
  }
}
async function disableStealSystemProxy(host, port) {
  if (process.platform === "win32") {
    await disableWindowsSystemProxyIfMatches(host, port);
    return;
  }
  if (process.platform !== "darwin") return;
  const services = await listNetworkServices();
  for (const service of services) {
    await disableServiceProxyIfMatches(service, "web", host, port);
    await disableServiceProxyIfMatches(service, "secureWeb", host, port);
  }
  snapshot = void 0;
}
async function enableWindowsSystemProxy(host, port) {
  if (!windowsSnapshot) windowsSnapshot = await getWindowsProxySnapshot();
  const proxyServer = `http=${host}:${port};https=${host}:${port}`;
  await regAdd("ProxyEnable", "REG_DWORD", "1");
  await regAdd("ProxyServer", "REG_SZ", proxyServer);
  await regAdd("ProxyOverride", "REG_SZ", "<local>");
  await regAdd("AutoDetect", "REG_DWORD", "0");
  await regDelete("AutoConfigURL");
  await notifyWindowsInternetSettingsChanged();
}
async function restoreWindowsSystemProxy() {
  if (!windowsSnapshot) return;
  const previous = windowsSnapshot;
  windowsSnapshot = void 0;
  await restoreWindowsValue("ProxyEnable", "REG_DWORD", previous.proxyEnable);
  await restoreWindowsValue("ProxyServer", "REG_SZ", previous.proxyServer);
  await restoreWindowsValue("ProxyOverride", "REG_SZ", previous.proxyOverride);
  await restoreWindowsValue("AutoDetect", "REG_DWORD", previous.autoDetect);
  await restoreWindowsValue("AutoConfigURL", "REG_SZ", previous.autoConfigURL);
  await notifyWindowsInternetSettingsChanged();
}
async function disableWindowsSystemProxyIfMatches(host, port) {
  const current = await getWindowsProxySnapshot();
  if (current.proxyServer?.includes(`${host}:${port}`)) {
    await regAdd("ProxyEnable", "REG_DWORD", "0");
    await notifyWindowsInternetSettingsChanged();
  }
  windowsSnapshot = void 0;
}
async function isCertificateTrusted(certificatePath) {
  if (!existsSync(certificatePath)) return false;
  if (process.platform === "win32") return isWindowsCertificateTrusted(certificatePath);
  if (process.platform !== "darwin") return true;
  try {
    await runExecFile("security", ["verify-cert", "-c", certificatePath, "-p", "ssl"]);
    return true;
  } catch {
    return false;
  }
}
async function installTrustedCertificate(certificatePath) {
  if (!existsSync(certificatePath)) return;
  if (process.platform === "win32") {
    await installWindowsTrustedCertificate(certificatePath);
    return;
  }
  if (process.platform !== "darwin") return;
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
async function getWindowsProxySnapshot() {
  const [proxyEnable, proxyServer, proxyOverride, autoDetect, autoConfigURL] = await Promise.all([
    regQuery("ProxyEnable"),
    regQuery("ProxyServer"),
    regQuery("ProxyOverride"),
    regQuery("AutoDetect"),
    regQuery("AutoConfigURL")
  ]);
  return { proxyEnable, proxyServer, proxyOverride, autoDetect, autoConfigURL };
}
async function restoreWindowsValue(name, type, value) {
  if (value === void 0) {
    await regDelete(name);
    return;
  }
  await regAdd(name, type, value);
}
async function regQuery(name) {
  try {
    const { stdout } = await runExecFile("reg", ["query", windowsInternetSettingsKey, "/v", name]);
    const line = stdout.split("\n").find((item) => item.includes(name));
    if (!line) return void 0;
    const match = line.trim().match(new RegExp(`^${name}\\s+REG_\\w+\\s+(.+)$`));
    if (!match) return void 0;
    return match[1].trim();
  } catch {
    return void 0;
  }
}
async function regAdd(name, type, value) {
  await runExecFile("reg", ["add", windowsInternetSettingsKey, "/v", name, "/t", type, "/d", value, "/f"]);
}
async function regDelete(name) {
  try {
    await runExecFile("reg", ["delete", windowsInternetSettingsKey, "/v", name, "/f"]);
  } catch {
  }
}
async function notifyWindowsInternetSettingsChanged() {
  await runExecFile("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    `
      $signature = @"
      [DllImport("wininet.dll", SetLastError = true)]
      public static extern bool InternetSetOption(IntPtr hInternet, int dwOption, IntPtr lpBuffer, int dwBufferLength);
"@
      $type = Add-Type -MemberDefinition $signature -Name WinInetSettings -Namespace Steal -PassThru
      $type::InternetSetOption([IntPtr]::Zero, 39, [IntPtr]::Zero, 0) | Out-Null
      $type::InternetSetOption([IntPtr]::Zero, 37, [IntPtr]::Zero, 0) | Out-Null
    `
  ], 8e3).catch(() => void 0);
}
async function isWindowsCertificateTrusted(certificatePath) {
  const thumbprint = await getWindowsCertificateThumbprint(certificatePath);
  if (!thumbprint) return false;
  return await windowsStoreContainsCertificate("Root", thumbprint) || await windowsStoreContainsCertificate("Root", thumbprint, true) || await windowsStoreContainsNodeMitmProxyCa("Root") || await windowsStoreContainsNodeMitmProxyCa("Root", true);
}
async function installWindowsTrustedCertificate(certificatePath) {
  await runExecFile("certutil", ["-user", "-addstore", "Root", certificatePath], 3e4);
}
async function getWindowsCertificateThumbprint(certificatePath) {
  try {
    const { stdout } = await runExecFile("certutil", ["-hashfile", certificatePath, "SHA1"]);
    const line = stdout.split("\n").map((item) => item.trim()).find((item) => /^[a-fA-F0-9 ]{40,}$/.test(item));
    return line?.replace(/\s+/g, "").toUpperCase();
  } catch {
    return void 0;
  }
}
async function windowsStoreContainsCertificate(store, thumbprint, currentUser = false) {
  const output = await readWindowsCertificateStore(store, currentUser);
  return normalizeCertificateOutput(output).includes(thumbprint.toUpperCase());
}
async function windowsStoreContainsNodeMitmProxyCa(store, currentUser = false) {
  const output = await readWindowsCertificateStore(store, currentUser);
  return /CN=NodeMITMProxyCA/i.test(output);
}
async function readWindowsCertificateStore(store, currentUser = false) {
  try {
    const args = currentUser ? ["-user", "-store", store] : ["-store", store];
    const { stdout } = await runExecFile("certutil", args, 2e4);
    return stdout;
  } catch {
    return "";
  }
}
function normalizeCertificateOutput(output) {
  return output.replace(/[^a-fA-F0-9]/g, "").toUpperCase();
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
class PluginLoader {
  plugins = /* @__PURE__ */ new Map();
  pluginsDir;
  configFile;
  api;
  constructor(api) {
    this.pluginsDir = join(app.getPath("userData"), "steal-plugins");
    this.configFile = join(this.pluginsDir, "plugins.json");
    this.api = api;
    if (!existsSync(this.pluginsDir)) {
      mkdirSync(this.pluginsDir, { recursive: true });
    }
  }
  async loadPlugin(path) {
    try {
      const absolutePath = path.startsWith("/") ? path : join(this.pluginsDir, path);
      if (!existsSync(absolutePath)) {
        throw new Error(`Plugin file not found: ${absolutePath}`);
      }
      const pluginCode = readFileSync(absolutePath, "utf-8");
      const pluginFactory = new Function("require", "module", "exports", pluginCode);
      const moduleExports = {};
      const module = { exports: moduleExports };
      pluginFactory(require2, module, module.exports);
      const plugin = module.exports;
      if (!plugin.name || !plugin.version) {
        throw new Error("Plugin must have name and version properties");
      }
      if (this.plugins.has(plugin.name)) {
        throw new Error(`Plugin ${plugin.name} is already loaded`);
      }
      const savedConfig = this.loadConfig();
      plugin.enabled = savedConfig[plugin.name]?.enabled ?? true;
      this.plugins.set(plugin.name, plugin);
      if (plugin.enabled && plugin.onLoad) {
        await plugin.onLoad(this.api);
      }
      return plugin;
    } catch (error) {
      throw new Error(`Failed to load plugin from ${path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  async unloadPlugin(name) {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin ${name} not found`);
    }
    if (plugin.onUnload) {
      await plugin.onUnload();
    }
    this.plugins.delete(name);
  }
  getPlugins() {
    return Array.from(this.plugins.values());
  }
  getPlugin(name) {
    return this.plugins.get(name);
  }
  enablePlugin(name) {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin ${name} not found`);
    }
    plugin.enabled = true;
    this.saveConfig();
  }
  disablePlugin(name) {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin ${name} not found`);
    }
    plugin.enabled = false;
    this.saveConfig();
  }
  async loadAllPlugins() {
    if (!existsSync(this.pluginsDir)) {
      return;
    }
    const files = readdirSync(this.pluginsDir);
    const jsFiles = files.filter((file) => file.endsWith(".js"));
    for (const file of jsFiles) {
      try {
        await this.loadPlugin(file);
      } catch (error) {
        console.error(`Failed to load plugin ${file}:`, error);
      }
    }
  }
  loadConfig() {
    if (!existsSync(this.configFile)) {
      return {};
    }
    try {
      const content = readFileSync(this.configFile, "utf-8");
      return JSON.parse(content);
    } catch {
      return {};
    }
  }
  saveConfig() {
    const config = {};
    for (const [name, plugin] of this.plugins) {
      config[name] = { enabled: plugin.enabled ?? true };
    }
    writeFileSync(this.configFile, JSON.stringify(config, null, 2));
  }
}
class PluginAPI {
  proxyService;
  constructor(proxyService2) {
    this.proxyService = proxyService2;
  }
  getCaptures() {
    return this.proxyService.getCaptures();
  }
  getSelectedCapture() {
    return void 0;
  }
  showMessage(message) {
    dialog.showMessageBox({
      type: "info",
      title: "Plugin Message",
      message
    });
  }
  async showDialog(options) {
    const result = await dialog.showMessageBox({
      type: options.type || "info",
      title: options.title || "Plugin Dialog",
      message: options.message,
      buttons: options.buttons || ["OK", "Cancel"]
    });
    return result.response === 0;
  }
  async fetch(url, options) {
    return fetch(url, options);
  }
  async readFile(path) {
    const { readFile: readFile2 } = await import("node:fs/promises");
    return readFile2(path, "utf-8");
  }
  async writeFile(path, content) {
    const { writeFile: writeFile2 } = await import("node:fs/promises");
    return writeFile2(path, content, "utf-8");
  }
}
let mainWindow;
let proxyService;
let savedApiStore;
let settingsStore;
let themeStore;
let workspaceStore;
let pluginLoader;
let certificatePromptInFlight = false;
let tray;
let trayProxyTransitioning = false;
let quitCleanupStarted = false;
let quitCleanupComplete = false;
let themeHotReloadEnabled = false;
let themeWatcher;
let themeReloadTimer;
let sharedCaptureSyncTimer;
let mcpBridgeServer;
const isDev = !!process.env.ELECTRON_RENDERER_URL;
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1120,
    minHeight: 720,
    title: "Steal",
    backgroundColor: "#f7f8fb",
    frame: process.platform === "darwin" ? void 0 : false,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : void 0,
    trafficLightPosition: process.platform === "darwin" ? { x: 16, y: 13 } : void 0,
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
  mainWindow.webContents.on("console-message", (_event, details) => {
    console.log(`renderer[${details.level}] ${details.message} (${details.sourceId}:${details.lineNumber})`);
  });
  mainWindow.on("closed", () => {
    mainWindow = void 0;
  });
}
app.whenReady().then(async () => {
  const dataDir = join(app.getPath("userData"), "steal-data");
  mkdirSync(dataDir, { recursive: true });
  proxyService = new ProxyService(dataDir);
  await proxyService.hydrateSharedCaptures();
  savedApiStore = new SavedApiStore(join(dataDir, "collections"));
  settingsStore = new SettingsStore(join(dataDir, "settings.json"));
  themeStore = new ThemeStore(join(dataDir, "theme.json"));
  workspaceStore = new WorkspaceStore(join(dataDir, "workspaces"));
  const settings = await settingsStore.get();
  const pluginAPI = new PluginAPI(proxyService);
  pluginLoader = new PluginLoader(pluginAPI);
  await pluginLoader.loadAllPlugins();
  mcpBridgeServer = new McpBridgeServer(resolveStealBridgeFilePath(dataDir));
  registerMcpBridge();
  await mcpBridgeServer.start();
  registerIpc();
  wireProxyEvents();
  startSharedCaptureSync();
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
app.on("before-quit", (event) => {
  if (quitCleanupComplete) return;
  event.preventDefault();
  if (quitCleanupStarted) return;
  quitCleanupStarted = true;
  void cleanupBeforeQuit().finally(() => {
    quitCleanupComplete = true;
    app.quit();
  });
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
  proxyService.on("captures", (captures) => {
    mainWindow?.webContents.send("captures:changed", captures);
  });
  proxyService.on("status", (status) => {
    mainWindow?.webContents.send("proxy:changed", status);
    updateTray(status);
  });
}
function startSharedCaptureSync() {
  clearInterval(sharedCaptureSyncTimer);
  sharedCaptureSyncTimer = setInterval(() => {
    void proxyService.syncSharedCaptures().catch((error) => {
      console.error("Failed to sync shared captures", error);
    });
  }, 1200);
}
function registerIpc() {
  ipcMain.handle("settings:get", () => settingsStore.get());
  ipcMain.handle("settings:update", (_event, patch) => settingsStore.update(patch));
  ipcMain.handle("theme:get", () => themeStore.get());
  ipcMain.handle("theme:presets", () => themeStore.presets());
  ipcMain.handle("theme:update", (_event, theme) => themeStore.update(theme));
  ipcMain.handle("theme:reset", () => themeStore.reset());
  ipcMain.handle("theme:open-file", async () => {
    await themeStore.get();
    await shell.openPath(themeStore.path);
  });
  ipcMain.handle("theme:hot-reload:get", () => themeHotReloadEnabled);
  ipcMain.handle("theme:hot-reload:set", async (_event, enabled) => {
    await setThemeHotReload(enabled);
    return themeHotReloadEnabled;
  });
  ipcMain.handle("clipboard:write-text", (_event, text) => {
    clipboard.writeText(text);
  });
  ipcMain.handle("workspaces:state", () => workspaceStore.getState());
  ipcMain.handle("workspaces:load", (_event, workspaceId) => workspaceStore.load(workspaceId));
  ipcMain.handle("workspaces:save", (_event, payload) => {
    return workspaceStore.save(payload);
  });
  ipcMain.handle("workspaces:delete", (_event, workspaceId) => workspaceStore.delete(workspaceId));
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
  ipcMain.handle("captures:pause", (_event, paused) => proxyService.setCapturePaused(paused));
  ipcMain.handle("captures:clear", () => {
    proxyService.clearCaptures();
  });
  ipcMain.handle("captures:export-har", async (_event, captures) => {
    const exportCaptures = Array.isArray(captures) ? captures : proxyService.getCaptures();
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: "Export captures as HAR",
      defaultPath: "steal-captures.har",
      filters: [{ name: "HAR", extensions: ["har", "json"] }]
    });
    if (canceled || !filePath) return void 0;
    await writeFile(filePath, JSON.stringify(capturesToHar(exportCaptures), null, 2));
    return filePath;
  });
  ipcMain.handle("captures:import-har", async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: "Import HAR",
      properties: ["openFile"],
      filters: [{ name: "HAR", extensions: ["har", "json"] }]
    });
    if (canceled || filePaths.length === 0) return [];
    const raw = await readFile(filePaths[0], "utf8");
    const captures = capturesFromHar(JSON.parse(raw));
    return captures;
  });
  ipcMain.handle("saved:list", () => savedApiStore.list());
  ipcMain.handle("collections:list", () => savedApiStore.listCollections());
  ipcMain.handle("collections:update-settings", (_event, payload) => {
    return savedApiStore.updateCollectionSettings(payload.collectionId, payload.settings);
  });
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
  ipcMain.handle("cert:status", () => getCertificateStatus());
  ipcMain.handle("cert:install", async () => {
    const status = proxyService.getStatus();
    if (!existsSync(status.caCertPath)) throw new Error("Start the proxy once to generate the Steal CA certificate.");
    await installTrustedCertificate(status.caCertPath);
    return getCertificateStatus();
  });
  ipcMain.handle("app:platform", () => process.platform);
  ipcMain.handle("window:minimize", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });
  ipcMain.handle("window:toggle-maximize", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return false;
    if (window.isMaximized()) window.unmaximize();
    else window.maximize();
    return window.isMaximized();
  });
  ipcMain.handle("window:close", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });
  ipcMain.handle("browser:launch-chrome", (_event, url) => launchChromeBrowser(url));
  ipcMain.handle("plugins:list", () => {
    return pluginLoader.getPlugins().map((p) => ({
      name: p.name,
      version: p.version,
      description: p.description,
      author: p.author,
      enabled: p.enabled ?? true
    }));
  });
  ipcMain.handle("plugins:enable", (_event, name) => {
    pluginLoader.enablePlugin(name);
  });
  ipcMain.handle("plugins:disable", (_event, name) => {
    pluginLoader.disablePlugin(name);
  });
  ipcMain.handle("plugins:load", async (_event, path) => {
    const plugin = await pluginLoader.loadPlugin(path);
    return {
      name: plugin.name,
      version: plugin.version,
      description: plugin.description,
      author: plugin.author,
      enabled: plugin.enabled ?? true
    };
  });
  ipcMain.handle("plugins:get-filters", () => {
    const filters = [];
    for (const plugin of pluginLoader.getPlugins()) {
      if (!plugin.enabled || !plugin.filters) continue;
      for (const filterName of Object.keys(plugin.filters)) {
        filters.push({ name: filterName, pluginName: plugin.name });
      }
    }
    return filters;
  });
  ipcMain.handle("plugins:get-exporters", () => {
    const exporters = [];
    for (const plugin of pluginLoader.getPlugins()) {
      if (!plugin.enabled || !plugin.exporters) continue;
      for (const exporterName of Object.keys(plugin.exporters)) {
        exporters.push({ name: exporterName, pluginName: plugin.name });
      }
    }
    return exporters;
  });
  ipcMain.handle("plugins:run-filter", (_event, pluginName, filterName, captures) => {
    const plugin = pluginLoader.getPlugin(pluginName);
    if (!plugin || !plugin.enabled || !plugin.filters) return captures;
    const filter = plugin.filters[filterName];
    if (!filter) return captures;
    return captures.filter(filter);
  });
  ipcMain.handle("plugins:run-export", async (_event, pluginName, exporterName, captures) => {
    const plugin = pluginLoader.getPlugin(pluginName);
    if (!plugin || !plugin.enabled || !plugin.exporters) throw new Error("Plugin or exporter not found");
    const exporter = plugin.exporters[exporterName];
    if (!exporter) throw new Error("Exporter not found");
    const result = exporter(captures);
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: `Export with ${exporterName}`,
      defaultPath: `export-${Date.now()}`,
      filters: [{ name: "File", extensions: ["txt", "md", "json"] }]
    });
    if (canceled || !filePath) return void 0;
    await writeFile(filePath, typeof result === "string" ? result : result);
    return filePath;
  });
  ipcMain.handle("plugins:process-request", (_event, request) => {
    let processed = request;
    for (const plugin of pluginLoader.getPlugins()) {
      if (!plugin.enabled || !plugin.processors?.onRequest) continue;
      processed = plugin.processors.onRequest(processed);
    }
    return processed;
  });
}
function registerMcpBridge() {
  if (!mcpBridgeServer) return;
  mcpBridgeServer.register("getProxyStatus", () => proxyService.getStatus());
  mcpBridgeServer.register("startProxy", () => startProxyWithSystemSetup());
  mcpBridgeServer.register("stopProxy", () => stopProxyWithSystemRestore());
  mcpBridgeServer.register("setCapturePaused", (params) => proxyService.setCapturePaused(Boolean(params?.paused)));
  mcpBridgeServer.register("clearCaptures", () => {
    proxyService.clearCaptures();
    return { cleared: true };
  });
  mcpBridgeServer.register("listCaptures", () => proxyService.getCaptures());
  mcpBridgeServer.register("getCapture", (params) => {
    const id = String(params?.id || "");
    const capture = proxyService.findCapture(id);
    if (!capture) throw new Error(`Capture not found: ${id}`);
    return capture;
  });
  mcpBridgeServer.register("getSettings", () => settingsStore.get());
  mcpBridgeServer.register("updateSettings", (params) => settingsStore.update(params || {}));
  mcpBridgeServer.register("listWorkspaces", () => workspaceStore.getState());
  mcpBridgeServer.register("loadWorkspace", (params) => {
    const workspaceId = String(params?.workspaceId || "");
    return workspaceStore.load(workspaceId);
  });
  mcpBridgeServer.register("listCollections", () => savedApiStore.listCollections());
  mcpBridgeServer.register("listSavedApis", () => savedApiStore.list());
  mcpBridgeServer.register("getSavedApi", async (params) => {
    const id = String(params?.id || "");
    const api = (await savedApiStore.list()).find((item) => item.id === id);
    if (!api) throw new Error(`Saved API not found: ${id}`);
    return api;
  });
  mcpBridgeServer.register("saveCaptureToCollection", async (params) => {
    const payload = params || {};
    const exchangeId = String(payload.exchangeId || "");
    const capture = proxyService.findCapture(exchangeId);
    if (!capture) throw new Error(`Capture not found: ${exchangeId}`);
    return savedApiStore.save(capture, payload.name || "", payload.tags || [], payload.collectionName?.trim() || "Default");
  });
}
async function setThemeHotReload(enabled) {
  themeHotReloadEnabled = enabled;
  themeWatcher?.close();
  themeWatcher = void 0;
  if (!enabled) return;
  await themeStore.get();
  themeWatcher = watch(themeStore.path, { persistent: false }, () => {
    if (themeReloadTimer) clearTimeout(themeReloadTimer);
    themeReloadTimer = setTimeout(() => {
      void themeStore.get().then((theme) => {
        mainWindow?.webContents.send("theme:changed", theme);
      }).catch((error) => {
        console.error("Failed to hot reload theme", error);
      });
    }, 120);
  });
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
  await removeSystemProxyFromSystem();
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
async function removeSystemProxyFromSystem() {
  const status = proxyService.getStatus();
  try {
    await restoreSystemProxy();
  } catch (error) {
    console.error("Failed to restore system proxy", error);
  }
  try {
    await disableStealSystemProxy(status.host, status.port);
  } catch (error) {
    console.error("Failed to disable Steal system proxy", error);
  }
}
async function cleanupBeforeQuit() {
  clearInterval(sharedCaptureSyncTimer);
  await mcpBridgeServer?.stop().catch(() => void 0);
  if (!proxyService) {
    await restoreSystemProxy().catch(() => void 0);
    return;
  }
  await stopProxyWithSystemRestore();
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
  if (!["darwin", "win32"].includes(process.platform) || certificatePromptInFlight || !existsSync(status.caCertPath)) return;
  if (await isCertificateTrusted(status.caCertPath)) return;
  certificatePromptInFlight = true;
  const installDetail = process.platform === "win32" ? "The certificate is not trusted yet. Install it into the current Windows user Trusted Root store?" : "The certificate is not trusted yet. Install it into the macOS System keychain using administrator privileges?";
  try {
    const result = await dialog.showMessageBox(mainWindow, {
      type: "warning",
      buttons: ["Install", "Cancel"],
      defaultId: 0,
      cancelId: 1,
      title: "Install Steal HTTPS Certificate",
      message: "HTTPS capture needs the Steal local CA certificate.",
      detail: installDetail
    });
    if (result.response !== 0) return;
    await installTrustedCertificate(status.caCertPath);
  } finally {
    certificatePromptInFlight = false;
  }
}
async function getCertificateStatus() {
  const status = proxyService.getStatus();
  const exists = existsSync(status.caCertPath);
  return {
    caCertPath: status.caCertPath,
    exists,
    trusted: exists ? await isCertificateTrusted(status.caCertPath) : false
  };
}
async function replay(request) {
  return replayRequest(request);
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
