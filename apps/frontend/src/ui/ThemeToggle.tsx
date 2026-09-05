import type { ReactElement } from 'react'

import { MoonIcon } from '@/ui/icons/MoonIcon'
import { SunIcon } from '@/ui/icons/SunIcon'
import { useTheme } from '@/ui/theme'

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
