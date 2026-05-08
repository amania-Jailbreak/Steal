import { execFile, type ExecFileOptionsWithStringEncoding } from 'node:child_process'
import { existsSync } from 'node:fs'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const defaultExecOptions = { encoding: 'utf8', timeout: 8_000 } satisfies ExecFileOptionsWithStringEncoding

type ProxyKind = 'web' | 'secureWeb'

interface ServiceProxyConfig {
  enabled: boolean
  server: string
  port: string
}

interface ServiceSnapshot {
  service: string
  web: ServiceProxyConfig
  secureWeb: ServiceProxyConfig
}

interface WindowsProxySnapshot {
  proxyEnable?: string
  proxyServer?: string
  proxyOverride?: string
  autoDetect?: string
  autoConfigURL?: string
}

const windowsInternetSettingsKey = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'
let snapshot: ServiceSnapshot[] | undefined
let windowsSnapshot: WindowsProxySnapshot | undefined

export async function enableSystemProxy(host: string, port: number): Promise<void> {
  if (process.platform === 'win32') {
    await enableWindowsSystemProxy(host, port)
    return
  }
  if (process.platform !== 'darwin') return
  const services = await listNetworkServices()
  if (!snapshot) {
    snapshot = await Promise.all(services.map(async (service) => ({
      service,
      web: await getProxyConfig(service, 'web'),
      secureWeb: await getProxyConfig(service, 'secureWeb')
    })))
  }

  for (const service of services) {
    await runNetworksetup(['-setwebproxy', service, host, String(port)])
    await runNetworksetup(['-setsecurewebproxy', service, host, String(port)])
    await runNetworksetup(['-setwebproxystate', service, 'on'])
    await runNetworksetup(['-setsecurewebproxystate', service, 'on'])
  }
}

export async function restoreSystemProxy(): Promise<void> {
  if (process.platform === 'win32') {
    await restoreWindowsSystemProxy()
    return
  }
  if (process.platform !== 'darwin' || !snapshot) return
  const previous = snapshot
  snapshot = undefined

  for (const config of previous) {
    await restoreServiceProxy(config.service, 'web', config.web)
    await restoreServiceProxy(config.service, 'secureWeb', config.secureWeb)
  }
}

export async function disableStealSystemProxy(host: string, port: number): Promise<void> {
  if (process.platform === 'win32') {
    await disableWindowsSystemProxyIfMatches(host, port)
    return
  }
  if (process.platform !== 'darwin') return
  const services = await listNetworkServices()
  for (const service of services) {
    await disableServiceProxyIfMatches(service, 'web', host, port)
    await disableServiceProxyIfMatches(service, 'secureWeb', host, port)
  }
  snapshot = undefined
}

async function enableWindowsSystemProxy(host: string, port: number): Promise<void> {
  if (!windowsSnapshot) windowsSnapshot = await getWindowsProxySnapshot()
  const proxyServer = `http=${host}:${port};https=${host}:${port}`
  await regAdd('ProxyEnable', 'REG_DWORD', '1')
  await regAdd('ProxyServer', 'REG_SZ', proxyServer)
  await regAdd('ProxyOverride', 'REG_SZ', '<local>')
  await regAdd('AutoDetect', 'REG_DWORD', '0')
  await regDelete('AutoConfigURL')
  await notifyWindowsInternetSettingsChanged()
}

async function restoreWindowsSystemProxy(): Promise<void> {
  if (!windowsSnapshot) return
  const previous = windowsSnapshot
  windowsSnapshot = undefined

  await restoreWindowsValue('ProxyEnable', 'REG_DWORD', previous.proxyEnable)
  await restoreWindowsValue('ProxyServer', 'REG_SZ', previous.proxyServer)
  await restoreWindowsValue('ProxyOverride', 'REG_SZ', previous.proxyOverride)
  await restoreWindowsValue('AutoDetect', 'REG_DWORD', previous.autoDetect)
  await restoreWindowsValue('AutoConfigURL', 'REG_SZ', previous.autoConfigURL)
  await notifyWindowsInternetSettingsChanged()
}

async function disableWindowsSystemProxyIfMatches(host: string, port: number): Promise<void> {
  const current = await getWindowsProxySnapshot()
  if (current.proxyServer?.includes(`${host}:${port}`)) {
    await regAdd('ProxyEnable', 'REG_DWORD', '0')
    await notifyWindowsInternetSettingsChanged()
  }
  windowsSnapshot = undefined
}

export async function isCertificateTrusted(certificatePath: string): Promise<boolean> {
  if (!existsSync(certificatePath)) return false
  if (process.platform === 'win32') return isWindowsCertificateTrusted(certificatePath)
  if (process.platform !== 'darwin') return true

  try {
    await runExecFile('security', ['verify-cert', '-c', certificatePath, '-p', 'ssl'])
    return true
  } catch {
    return false
  }
}

export async function installTrustedCertificate(certificatePath: string): Promise<void> {
  if (!existsSync(certificatePath)) return
  if (process.platform === 'win32') {
    await installWindowsTrustedCertificate(certificatePath)
    return
  }
  if (process.platform !== 'darwin') return
  const command = [
    'security',
    'add-trusted-cert',
    '-d',
    '-r',
    'trustRoot',
    '-p',
    'ssl',
    '-p',
    'basic',
    '-k',
    '/Library/Keychains/System.keychain',
    shellQuote(certificatePath)
  ].join(' ')

  try {
    await runExecFile('osascript', [
      '-e',
      `do shell script ${appleScriptQuote(command)} with administrator privileges`
    ], 120_000)
  } catch (error) {
    await installTrustedCertificateInTerminal(command)
  }
}

async function listNetworkServices(): Promise<string[]> {
  const { stdout } = await runExecFile('networksetup', ['-listallnetworkservices'])
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('An asterisk') && !line.startsWith('*'))
}

async function getProxyConfig(service: string, kind: ProxyKind): Promise<ServiceProxyConfig> {
  const flag = kind === 'web' ? '-getwebproxy' : '-getsecurewebproxy'
  const { stdout } = await runExecFile('networksetup', [flag, service])
  const values = Object.fromEntries(
    stdout
      .split('\n')
      .map((line) => line.split(':'))
      .filter((parts) => parts.length >= 2)
      .map(([key, ...rest]) => [key.trim(), rest.join(':').trim()])
  )

  return {
    enabled: values.Enabled === 'Yes',
    server: values.Server || '',
    port: values.Port || ''
  }
}

async function restoreServiceProxy(service: string, kind: ProxyKind, config: ServiceProxyConfig): Promise<void> {
  const setFlag = kind === 'web' ? '-setwebproxy' : '-setsecurewebproxy'
  const stateFlag = kind === 'web' ? '-setwebproxystate' : '-setsecurewebproxystate'

  if (config.server && config.port) {
    await runNetworksetup([setFlag, service, config.server, config.port])
  }
  await runNetworksetup([stateFlag, service, config.enabled ? 'on' : 'off'])
}

async function disableServiceProxyIfMatches(service: string, kind: ProxyKind, host: string, port: number): Promise<void> {
  const stateFlag = kind === 'web' ? '-setwebproxystate' : '-setsecurewebproxystate'
  const config = await getProxyConfig(service, kind)
  if (config.server === host && config.port === String(port)) {
    await runNetworksetup([stateFlag, service, 'off'])
  }
}

async function runNetworksetup(args: string[]): Promise<void> {
  try {
    await runExecFile('networksetup', args)
  } catch {
    await runExecFile('osascript', [
      '-e',
      `do shell script ${appleScriptQuote(['networksetup', ...args].map(shellQuote).join(' '))} with administrator privileges`
    ], 15_000)
  }
}

async function getWindowsProxySnapshot(): Promise<WindowsProxySnapshot> {
  const [proxyEnable, proxyServer, proxyOverride, autoDetect, autoConfigURL] = await Promise.all([
    regQuery('ProxyEnable'),
    regQuery('ProxyServer'),
    regQuery('ProxyOverride'),
    regQuery('AutoDetect'),
    regQuery('AutoConfigURL')
  ])
  return { proxyEnable, proxyServer, proxyOverride, autoDetect, autoConfigURL }
}

async function restoreWindowsValue(name: string, type: 'REG_DWORD' | 'REG_SZ', value: string | undefined): Promise<void> {
  if (value === undefined) {
    await regDelete(name)
    return
  }
  await regAdd(name, type, value)
}

async function regQuery(name: string): Promise<string | undefined> {
  try {
    const { stdout } = await runExecFile('reg', ['query', windowsInternetSettingsKey, '/v', name])
    const line = stdout.split('\n').find((item) => item.includes(name))
    if (!line) return undefined
    const match = line.trim().match(new RegExp(`^${name}\\s+REG_\\w+\\s+(.+)$`))
    if (!match) return undefined
    return match[1].trim()
  } catch {
    return undefined
  }
}

async function regAdd(name: string, type: 'REG_DWORD' | 'REG_SZ', value: string): Promise<void> {
  await runExecFile('reg', ['add', windowsInternetSettingsKey, '/v', name, '/t', type, '/d', value, '/f'])
}

async function regDelete(name: string): Promise<void> {
  try {
    await runExecFile('reg', ['delete', windowsInternetSettingsKey, '/v', name, '/f'])
  } catch {
    // Missing values are fine when restoring an absent setting.
  }
}

async function notifyWindowsInternetSettingsChanged(): Promise<void> {
  await runExecFile('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    `
      $signature = @"
      [DllImport("wininet.dll", SetLastError = true)]
      public static extern bool InternetSetOption(IntPtr hInternet, int dwOption, IntPtr lpBuffer, int dwBufferLength);
"@
      $type = Add-Type -MemberDefinition $signature -Name WinInetSettings -Namespace Steal -PassThru
      $type::InternetSetOption([IntPtr]::Zero, 39, [IntPtr]::Zero, 0) | Out-Null
      $type::InternetSetOption([IntPtr]::Zero, 37, [IntPtr]::Zero, 0) | Out-Null
    `
  ], 8_000).catch(() => undefined)
}

async function isWindowsCertificateTrusted(certificatePath: string): Promise<boolean> {
  const thumbprint = await getWindowsCertificateThumbprint(certificatePath)
  if (!thumbprint) return false

  return await windowsStoreContainsCertificate('Root', thumbprint) ||
    await windowsStoreContainsCertificate('Root', thumbprint, true) ||
    await windowsStoreContainsNodeMitmProxyCa('Root') ||
    await windowsStoreContainsNodeMitmProxyCa('Root', true)
}

async function installWindowsTrustedCertificate(certificatePath: string): Promise<void> {
  await runExecFile('certutil', ['-user', '-addstore', 'Root', certificatePath], 30_000)
}

async function getWindowsCertificateThumbprint(certificatePath: string): Promise<string | undefined> {
  try {
    const { stdout } = await runExecFile('certutil', ['-hashfile', certificatePath, 'SHA1'])
    const line = stdout
      .split('\n')
      .map((item) => item.trim())
      .find((item) => /^[a-fA-F0-9 ]{40,}$/.test(item))
    return line?.replace(/\s+/g, '').toUpperCase()
  } catch {
    return undefined
  }
}

async function windowsStoreContainsCertificate(store: string, thumbprint: string, currentUser = false): Promise<boolean> {
  const output = await readWindowsCertificateStore(store, currentUser)
  return normalizeCertificateOutput(output).includes(thumbprint.toUpperCase())
}

async function windowsStoreContainsNodeMitmProxyCa(store: string, currentUser = false): Promise<boolean> {
  const output = await readWindowsCertificateStore(store, currentUser)
  return /CN=NodeMITMProxyCA/i.test(output)
}

async function readWindowsCertificateStore(store: string, currentUser = false): Promise<string> {
  try {
    const args = currentUser ? ['-user', '-store', store] : ['-store', store]
    const { stdout } = await runExecFile('certutil', args, 20_000)
    return stdout
  } catch {
    return ''
  }
}

function normalizeCertificateOutput(output: string): string {
  return output.replace(/[^a-fA-F0-9]/g, '').toUpperCase()
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`
}

function appleScriptQuote(value: string): string {
  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
}

async function installTrustedCertificateInTerminal(command: string): Promise<void> {
  const terminalCommand = [
    'echo "Installing Steal HTTPS certificate into the System keychain."',
    `sudo ${command}`,
    'echo',
    'echo "Done. You can close this Terminal window."',
    'read -n 1 -s -r -p "Press any key to close..."',
    'exit'
  ].join('; ')

  await runExecFile('osascript', [
    '-e',
    'tell application "Terminal"',
    '-e',
    'activate',
    '-e',
    `do script ${appleScriptQuote(terminalCommand)}`,
    '-e',
    'end tell'
  ])
}

async function runExecFile(file: string, args: string[], timeout = 8_000): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync(file, args, { ...defaultExecOptions, timeout })
}
