import type { MouseEvent, ReactElement, ReactNode } from 'react'

import { isPlainPrimaryClick, navigateFromJobsToJob } from '@/routing/hash-router'
import { formatRoute } from '@/routing/route-codec'

export const JobLink = ({
  postingId,
  className,
  children,
}: {
  postingId: string
  className?: string
  children: ReactNode
}): ReactElement {
  const onClick = (event: MouseEvent<HTMLAnchorElement>): void => {
    if (!isPlainPrimaryClick(event.nativeEvent)) return
    event.preventDefault()
    navigateFromJobsToJob(postingId)
  }

  return (
    <a
      href={formatRoute({ name: 'job', postingId })}
      onClick={onClick}
      className={className ?? 'rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]'}
    >
      {children}
    </a>
  )
}
