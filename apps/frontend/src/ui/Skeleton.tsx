import type { ReactElement } from 'react'

export type SkeletonProps = {
  className?: string
  label?: string
}

export function Skeleton({ className, label }: SkeletonProps): ReactElement {
  if (!label) {
    return <span aria-hidden="true" className={`ui-skeleton block ${className ?? ''}`} />
  }

  return (
    <span className="inline-block">
      <span aria-hidden="true" className={`ui-skeleton block ${className ?? ''}`} />
      <span role="status" aria-live="polite" className="sr-only">
        {label}
      </span>
    </span>
  )
}
