import type { ReactElement, ReactNode } from 'react'

export type PillProps = {
  pressed: boolean
  children: ReactNode
  onClick(): void
}

export const Pill = ({ pressed, children, onClick }: PillProps): ReactElement => {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`min-h-9 rounded-full border px-3 font-mono text-xs transition-colors ${
        pressed
          ? 'border-accent bg-accent-soft font-semibold text-accent'
          : 'border-subtle bg-surface-raised text-secondary hover:border-strong hover:text-primary'
      }`}
    >
      {children}
    </button>
  )
}
