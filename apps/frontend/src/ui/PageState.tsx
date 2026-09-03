import type { ReactElement, ReactNode } from 'react'

export type PageStateKind = 'loading' | 'empty' | 'error'

export type PageStateProps = {
  kind: PageStateKind
  title: string
  description?: string
  action?: ReactNode
  compact?: boolean
}

const ROLE_BY_KIND: Record<PageStateKind, 'status' | 'alert' | 'region'> = {
  loading: 'status',
  error: 'alert',
  empty: 'region',
}

export function PageState({ kind, title, description, action, compact }: PageStateProps): ReactElement {
  return (
    <div
      role={ROLE_BY_KIND[kind]}
      aria-live={kind === 'loading' ? 'polite' : undefined}
      aria-busy={kind === 'loading' ? true : undefined}
      aria-label={kind === 'empty' ? title : undefined}
      className={`font-mono ${compact ? 'mt-8 px-4 py-3 text-xs' : 'mt-16 py-16 text-center text-sm'} ${
        kind === 'error' ? 'border border-accent/50 bg-accent/5 text-accent-text' : 'text-secondary'
      }`}
    >
      <p>{title}</p>
      {description && <p className="mt-1 text-tertiary">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
