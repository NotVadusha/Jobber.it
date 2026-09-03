import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'

import { MoonIcon } from '@/ui/icons/MoonIcon'
import { SunIcon } from '@/ui/icons/SunIcon'

export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'jobber.theme.v1'
export const LIGHT_THEME_QUERY = '(prefers-color-scheme: light)'

type ThemeState = {
  theme: Theme
  source: 'stored' | 'system'
}

type ThemeContextValue = {
  theme: Theme
  toggleTheme(): void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function decodeTheme(value: unknown): Theme | null {
  return value === 'light' || value === 'dark' ? value : null
}

export function resolveTheme(stored: unknown, prefersLight: boolean): ThemeState {
  const saved = decodeTheme(stored)
  return saved
    ? { theme: saved, source: 'stored' }
    : { theme: prefersLight ? 'light' : 'dark', source: 'system' }
}

function readDocumentTheme(): ThemeState {
  const root = document.documentElement
  const theme = decodeTheme(root.dataset.theme) ?? 'dark'
  const source = root.dataset.themeSource === 'stored' ? 'stored' : 'system'
  return { theme, source }
}

function applyTheme(state: ThemeState): void {
  document.documentElement.dataset.theme = state.theme
  document.documentElement.dataset.themeSource = state.source
}

function persistTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // The current document still honors the choice when storage is unavailable.
  }
}

export function ThemeProvider({ children }: { children: ReactNode }): ReactElement {
  const [state, setState] = useState<ThemeState>(readDocumentTheme)

  useEffect(() => {
    applyTheme(state)
  }, [state])

  useEffect(() => {
    if (state.source !== 'system') return
    if (typeof window.matchMedia !== 'function') return

    const media = window.matchMedia(LIGHT_THEME_QUERY)
    const onChange = (event: MediaQueryListEvent) => {
      setState({ theme: event.matches ? 'light' : 'dark', source: 'system' })
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [state.source])

  const toggleTheme = useCallback(() => {
    setState((current) => {
      const theme = current.theme === 'dark' ? 'light' : 'dark'
      persistTheme(theme)
      return { theme, source: 'stored' }
    })
  }, [])

  const value = useMemo(
    () => ({ theme: state.theme, toggleTheme }),
    [state.theme, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used inside ThemeProvider')
  return value
}

export function ThemeToggle(): ReactElement {
  const { theme, toggleTheme } = useTheme()
  const target = theme === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      className="grid size-9 place-items-center rounded-sm border border-transparent text-secondary transition-colors hover:border-strong hover:bg-surface-raised hover:text-primary"
      aria-label={`Switch to ${target} theme`}
      title={`Switch to ${target} theme`}
      onClick={toggleTheme}
    >
      {target === 'light' ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}
