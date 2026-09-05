import type { ReactElement, ReactNode } from 'react'

export const Label = ({ children }: { children: ReactNode }): ReactElement => {
  return (
    <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-tertiary">
      {children}
    </span>
  )
}
