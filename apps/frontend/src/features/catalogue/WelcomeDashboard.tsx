import type { ReactElement } from 'react'

import { useCorpusMetaQuery } from '@/api/search'
import { sourceLabel } from '@/features/jobs/source-labels'

export const WelcomeDashboard = (): ReactElement | null => {
  const { data } = useCorpusMetaQuery()
  const meta = data?.data
  if (!meta) return null

  return (
    <section aria-label="Welcome to Jobber" className="mb-5 text-sm text-secondary">
      <details>
        <summary className="w-fit cursor-pointer rounded-sm py-2 text-secondary hover:text-primary">
          {meta.corpusSize.toLocaleString()} live postings across {meta.sourceCounts.length} sources
        </summary>
        <ul aria-label="Live posting counts by source" className="mt-2 grid gap-x-6 gap-y-2 rounded-md border border-subtle bg-surface p-4 sm:grid-cols-2">
          {meta.sourceCounts.map(({ source, count }) => (
            <li key={source} className="flex justify-between gap-4">
              <span>{sourceLabel(source)}</span>
              <span className="tabular-nums text-primary">{count.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  )
}
