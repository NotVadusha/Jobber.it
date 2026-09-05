import type { ReactElement } from 'react'

export const SavedBadge = ({ children }: { children: string }): ReactElement => {
  return (
    <span className="rounded-full border border-strong px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-secondary">
      {children}
    </span>
  )
}
