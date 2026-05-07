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

let snapshot: ServiceSnapshot[] | undefined

export async function enableSystemProxy(host: string, port: number): Promise<void> {
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
  if (process.platform !== 'darwin' || !snapshot) return
  const previous = snapshot
  snapshot = undefined

  for (const config of previous) {
    await restoreServiceProxy(config.service, 'web', config.web)
    await restoreServiceProxy(config.service, 'secureWeb', config.secureWeb)
  }
}

export async function disableStealSystemProxy(host: string, port: number): Promise<void> {
  if (process.platform !== 'darwin') return
  const services = await listNetworkServices()
  for (const service of services) {
    await disableServiceProxyIfMatches(service, 'web', host, port)
    await disableServiceProxyIfMatches(service, 'secureWeb', host, port)
  }
  snapshot = undefined
}

export async function isCertificateTrusted(certificatePath: string): Promise<boolean> {
  if (process.platform !== 'darwin') return true
  if (!existsSync(certificatePath)) return false

  try {
    await runExecFile('security', ['verify-cert', '-c', certificatePath, '-p', 'ssl'])
    return true
  } catch {
    return false
  }
}

export async function installTrustedCertificate(certificatePath: string): Promise<void> {
  if (process.platform !== 'darwin' || !existsSync(certificatePath)) return
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
