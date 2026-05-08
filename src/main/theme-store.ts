import { mkdirSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { AppTheme } from '../shared/types'

export const defaultTheme: AppTheme = {
  name: 'Steal Light',
  colors: {
    text: '#18202f',
    textStrong: '#172033',
    textMuted: '#667386',
    appBackground: '#f7f8fb',
    surface: '#ffffff',
    surfaceSubtle: '#fbfcfe',
    surfaceHover: '#f4f7fb',
    border: '#dfe4ec',
    borderStrong: '#9aa8ba',
    primary: '#2457c5',
    primaryHover: '#1d489f',
    primarySoft: '#eef4ff',
    primaryBorder: '#b9c8eb',
    success: '#17684a',
    successSoft: '#eefaf4',
    warning: '#8a4d05',
    warningSoft: '#fff7e6',
    danger: '#991b1b',
    dangerSoft: '#fff1f2',
    codeBackground: '#111827',
    codeText: '#d6deeb',
    overlay: 'rgba(15, 23, 42, 0.28)'
  },
  methods: {
    default: { text: '#233044', background: '#e8edf5' },
    get: { text: '#17684a', background: '#eefaf4' },
    post: { text: '#8a4d05', background: '#fff7e6' },
    put: { text: '#8a4d05', background: '#fff7e6' },
    patch: { text: '#8a4d05', background: '#fff7e6' },
    delete: { text: '#991b1b', background: '#fff1f2' },
    head: { text: '#2457c5', background: '#eef4ff' },
    options: { text: '#2457c5', background: '#eef4ff' }
  },
  background: {
    mode: 'solid',
    opacity: 1,
    imagePath: '',
    imageOpacity: 0.45,
    imageBrightness: 0.85
  }
}

export const themePresets: AppTheme[] = [
  defaultTheme,
  makeTheme('Steal_Dark', {
    text: '#d7dde8',
    textStrong: '#f4f7fb',
    textMuted: '#93a0b4',
    appBackground: '#111722',
    surface: '#171f2c',
    surfaceSubtle: '#131b27',
    surfaceHover: '#202a39',
    border: '#2d394a',
    borderStrong: '#607089',
    primary: '#6ea2ff',
    primaryHover: '#8bb6ff',
    primarySoft: '#1b3157',
    primaryBorder: '#385f9f',
    success: '#6bd69b',
    successSoft: '#173b2a',
    warning: '#f6c56b',
    warningSoft: '#3d2d13',
    danger: '#ff7a7a',
    dangerSoft: '#451e25',
    codeBackground: '#0a0f18',
    codeText: '#dce7f7',
    overlay: 'rgba(0, 0, 0, 0.44)'
  }, {
    default: { text: '#d9e4f2', background: '#263244' },
    get: { text: '#6bd69b', background: '#173b2a' },
    post: { text: '#f6c56b', background: '#3d2d13' },
    put: { text: '#f6c56b', background: '#3d2d13' },
    patch: { text: '#f6c56b', background: '#3d2d13' },
    delete: { text: '#ff7a7a', background: '#451e25' },
    head: { text: '#8bb6ff', background: '#1b3157' },
    options: { text: '#8bb6ff', background: '#1b3157' }
  }),
  makeTheme('Sakura', {
    text: '#342530',
    textStrong: '#231821',
    textMuted: '#7b6270',
    appBackground: '#fff7fa',
    surface: '#ffffff',
    surfaceSubtle: '#fff1f6',
    surfaceHover: '#ffe8f0',
    border: '#efd2de',
    borderStrong: '#c995ab',
    primary: '#c94f7c',
    primaryHover: '#a83d66',
    primarySoft: '#ffe4ee',
    primaryBorder: '#f0a9c2',
    success: '#477d62',
    successSoft: '#edf8f1',
    warning: '#9a6b1c',
    warningSoft: '#fff5dc',
    danger: '#b7355f',
    dangerSoft: '#ffe7ee',
    codeBackground: '#2a1825',
    codeText: '#ffeaf2',
    overlay: 'rgba(80, 28, 52, 0.24)'
  }, {
    get: { text: '#477d62', background: '#edf8f1' },
    post: { text: '#c94f7c', background: '#ffe4ee' },
    put: { text: '#a83d66', background: '#ffe4ee' },
    patch: { text: '#a83d66', background: '#ffe4ee' },
    delete: { text: '#b7355f', background: '#ffe7ee' }
  }),
  makeTheme('Sakura_Dark', {
    text: '#f1dce7',
    textStrong: '#fff6fa',
    textMuted: '#c69aac',
    appBackground: '#1b1118',
    surface: '#241721',
    surfaceSubtle: '#1f141d',
    surfaceHover: '#30202b',
    border: '#4a2d3c',
    borderStrong: '#9a6279',
    primary: '#ff8ab3',
    primaryHover: '#ffacc8',
    primarySoft: '#4a2032',
    primaryBorder: '#8d4561',
    success: '#8bd9a8',
    successSoft: '#1c3a2b',
    warning: '#ffd17a',
    warningSoft: '#402d16',
    danger: '#ff7f9f',
    dangerSoft: '#4a1d2b',
    codeBackground: '#120b10',
    codeText: '#f9ddea',
    overlay: 'rgba(0, 0, 0, 0.48)'
  }, {
    get: { text: '#8bd9a8', background: '#1c3a2b' },
    post: { text: '#ff8ab3', background: '#4a2032' },
    put: { text: '#ffacc8', background: '#4a2032' },
    patch: { text: '#ffacc8', background: '#4a2032' },
    delete: { text: '#ff7f9f', background: '#4a1d2b' },
    head: { text: '#ffacc8', background: '#4a2032' },
    options: { text: '#ffacc8', background: '#4a2032' }
  }),
  makeTheme('Midnight', {
    text: '#d9e4f2',
    textStrong: '#f8fbff',
    textMuted: '#91a5bd',
    appBackground: '#0b1220',
    surface: '#101a2b',
    surfaceSubtle: '#0d1626',
    surfaceHover: '#17243a',
    border: '#263854',
    borderStrong: '#5b759b',
    primary: '#4cc9f0',
    primaryHover: '#75dbf6',
    primarySoft: '#12344b',
    primaryBorder: '#2f718f',
    success: '#7ee7b1',
    successSoft: '#123729',
    warning: '#f8d66d',
    warningSoft: '#392f15',
    danger: '#ff6b88',
    dangerSoft: '#421b28',
    codeBackground: '#070c14',
    codeText: '#d9e9ff',
    overlay: 'rgba(0, 0, 0, 0.5)'
  }, {
    get: { text: '#7ee7b1', background: '#123729' },
    post: { text: '#f8d66d', background: '#392f15' },
    put: { text: '#f8d66d', background: '#392f15' },
    patch: { text: '#f8d66d', background: '#392f15' },
    delete: { text: '#ff6b88', background: '#421b28' },
    head: { text: '#4cc9f0', background: '#12344b' },
    options: { text: '#4cc9f0', background: '#12344b' }
  }),
  makeTheme('Forest', {
    text: '#1b2a22',
    textStrong: '#102017',
    textMuted: '#5b6f62',
    appBackground: '#f3f8f1',
    surface: '#ffffff',
    surfaceSubtle: '#eef6ed',
    surfaceHover: '#e4efe2',
    border: '#ccdcca',
    borderStrong: '#8fa58d',
    primary: '#2f7d58',
    primaryHover: '#256346',
    primarySoft: '#e3f4ea',
    primaryBorder: '#a6cfb6',
    success: '#1d7a4d',
    successSoft: '#e5f6ec',
    warning: '#8b6b18',
    warningSoft: '#fff7d8',
    danger: '#a13c3c',
    dangerSoft: '#fdeaea',
    codeBackground: '#132017',
    codeText: '#dbf2df',
    overlay: 'rgba(20, 45, 28, 0.28)'
  }, {
    get: { text: '#1d7a4d', background: '#e5f6ec' },
    post: { text: '#2f7d58', background: '#e3f4ea' },
    put: { text: '#2f7d58', background: '#e3f4ea' },
    patch: { text: '#2f7d58', background: '#e3f4ea' },
    delete: { text: '#a13c3c', background: '#fdeaea' }
  }),
  makeTheme('Amber', {
    text: '#2d261f',
    textStrong: '#1f1711',
    textMuted: '#74675a',
    appBackground: '#fbf7ef',
    surface: '#ffffff',
    surfaceSubtle: '#fff7e8',
    surfaceHover: '#ffefd1',
    border: '#ead8bb',
    borderStrong: '#b8955f',
    primary: '#b76e00',
    primaryHover: '#925800',
    primarySoft: '#fff0cf',
    primaryBorder: '#e4bd78',
    success: '#527a35',
    successSoft: '#edf7e5',
    warning: '#a06100',
    warningSoft: '#fff4d7',
    danger: '#a43e2f',
    dangerSoft: '#fdebe7',
    codeBackground: '#24190e',
    codeText: '#ffe7c2',
    overlay: 'rgba(70, 42, 8, 0.28)'
  }, {
    get: { text: '#527a35', background: '#edf7e5' },
    post: { text: '#b76e00', background: '#fff0cf' },
    put: { text: '#925800', background: '#fff0cf' },
    patch: { text: '#925800', background: '#fff0cf' },
    delete: { text: '#a43e2f', background: '#fdebe7' }
  })
]

const colorPattern = /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|[a-zA-Z]+)$/

export class ThemeStore {
  constructor(private readonly filePath: string) {
    mkdirSync(dirname(filePath), { recursive: true })
  }

  get path(): string {
    return this.filePath
  }

  async get(): Promise<AppTheme> {
    try {
      const raw = await readFile(this.filePath, 'utf8')
      return normalizeTheme(JSON.parse(raw) as Partial<AppTheme>)
    } catch {
      await this.set(defaultTheme)
      return defaultTheme
    }
  }

  async update(theme: AppTheme): Promise<AppTheme> {
    const next = normalizeTheme(theme)
    await this.set(next)
    return next
  }

  async reset(): Promise<AppTheme> {
    await this.set(defaultTheme)
    return defaultTheme
  }

  presets(): AppTheme[] {
    return themePresets.map((theme) => normalizeTheme(theme))
  }

  private async set(theme: AppTheme): Promise<void> {
    await writeFile(this.filePath, JSON.stringify(theme, null, 2))
  }
}

function makeTheme(name: string, colors: AppTheme['colors'], methods: Partial<AppTheme['methods']> = {}): AppTheme {
  return { name, colors, methods: { ...defaultTheme.methods, ...methods }, background: defaultTheme.background }
}

function normalizeTheme(value: Partial<AppTheme>): AppTheme {
  const colors = value.colors || {}
  const methods = value.methods || {}
  const background = value.background || {}
  return {
    name: typeof value.name === 'string' && value.name.trim() ? value.name.trim() : defaultTheme.name,
    colors: Object.fromEntries(
      Object.entries(defaultTheme.colors).map(([key, fallback]) => {
        const candidate = colors[key as keyof AppTheme['colors']]
        return [key, typeof candidate === 'string' && colorPattern.test(candidate.trim()) ? candidate.trim() : fallback]
      })
    ) as AppTheme['colors'],
    methods: Object.fromEntries(
      Object.entries(defaultTheme.methods).map(([key, fallback]) => {
        const candidate = methods[key]
        return [key, {
          text: normalizeColor(candidate?.text, fallback.text),
          background: normalizeColor(candidate?.background, fallback.background)
        }]
      })
    ),
    background: {
      mode: ['solid', 'transparent', 'image'].includes(background.mode || '') ? background.mode! : defaultTheme.background.mode,
      opacity: normalizeNumber(background.opacity, defaultTheme.background.opacity, 0, 1),
      imagePath: typeof background.imagePath === 'string' ? background.imagePath : defaultTheme.background.imagePath,
      imageOpacity: normalizeNumber(background.imageOpacity, defaultTheme.background.imageOpacity, 0, 1),
      imageBrightness: normalizeNumber(background.imageBrightness, defaultTheme.background.imageBrightness, 0.2, 1.6)
    }
  }
}

function normalizeColor(value: string | undefined, fallback: string): string {
  return typeof value === 'string' && colorPattern.test(value.trim()) ? value.trim() : fallback
}

function normalizeNumber(value: number | undefined, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
}
