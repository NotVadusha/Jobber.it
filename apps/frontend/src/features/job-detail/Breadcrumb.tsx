import type { ReactElement } from 'react'

import { isPlainPrimaryClick, returnToJobs } from '@/routing/hash-router'
import { jobsReturnContext } from '@/routing/navigation-context'

export const Breadcrumb = ({ title }: { title: string | null }): ReactElement => {
  const origin = jobsReturnContext()
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-tertiary">
        <li>
          <a
            href={origin?.hash ?? '#/jobs'}
            onClick={(event) => {
              if (!isPlainPrimaryClick(event.nativeEvent)) return
              event.preventDefault()
              returnToJobs()
            }}
            className="rounded-sm underline-offset-4 hover:text-primary hover:underline"
          >
            Jobs
          </a>
        </li>
        <li aria-hidden="true">/</li>
        <li aria-current="page" className="min-w-0 truncate text-secondary">
          {title ?? 'Posting'}
        </li>
      </ol>
    </nav>
  )
}
