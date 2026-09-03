import type { ReactElement } from 'react'

import { useCorpusMetaQuery } from '@/api/search'
import { sourceLabel } from '@/features/jobs/source-labels'
import { PageState } from '@/ui/PageState'
import { Skeleton } from '@/ui/Skeleton'

const FEATURES = [
  {
    number: '01',
    title: 'Hard filters stay hard',
    body: 'Salary, seniority, workplace, recency, and source stay structured constraints instead of becoming embedding noise.',
  },
  {
    number: '02',
    title: 'Use a profile for Best matches',
    body: 'A CV can add background context to semantic matching without placing its content in a shared link.',
  },
  {
    number: '03',
    title: 'Apply at the original source',
    body: 'Jobber aggregates public postings; applications and employer conversations remain on the canonical source.',
  },
] as const

export function WelcomeDashboard(): ReactElement {
  const metaQuery = useCorpusMetaQuery()
  const meta = metaQuery.data?.data

  return (
    <section aria-labelledby="welcome-title" className="mb-8">
      <h2 id="welcome-title" className="sr-only">Welcome to Jobber</h2>
      <div className="grid gap-5 md:grid-cols-[1.1fr_1fr]">
        <div className="overflow-hidden rounded-md border border-subtle bg-surface shadow-elevated">
          <div className="flex items-center gap-2 border-b border-subtle bg-surface-raised px-4 py-3 font-mono text-[11px] text-tertiary">
            <span aria-hidden="true" className="size-2 rounded-full bg-accent" />
            <span aria-hidden="true" className="size-2 rounded-full bg-strong" />
            <span aria-hidden="true" className="size-2 rounded-full bg-strong" />
            <span className="ml-1">jobber — live corpus</span>
          </div>
          <div className="p-5 font-mono text-xs leading-7">
            {metaQuery.isPending && (
              <div className="space-y-3">
                <Skeleton label="Loading live corpus counts" className="h-4 w-40" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            )}
            {metaQuery.isError && (
              <PageState
                compact
                kind="error"
                title="Corpus counts are unavailable"
                description="Postings can still be browsed below."
                action={(
                  <button
                    type="button"
                    onClick={() => void metaQuery.refetch()}
                    className="min-h-9 rounded-sm border border-subtle px-3 font-mono text-xs text-secondary hover:border-accent hover:text-accent"
                  >
                    Retry counts
                  </button>
                )}
              />
            )}
            {meta && (
              <>
                <p className="text-accent">
                  {meta.corpusSize.toLocaleString()} live postings
                </p>
                <ul
                  aria-label="Live posting counts by source"
                  className="mt-3 border-t border-dashed border-subtle pt-3 text-secondary"
                >
                  {meta.sourceCounts.map(({ source, count }) => (
                    <li key={source} className="flex justify-between gap-4">
                      <span>{sourceLabel(source)}</span>
                      <span className="tabular-nums text-primary">{count.toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col justify-center gap-3">
          {FEATURES.map(({ number, title, body }) => (
            <article key={number} className="flex gap-3 rounded-md border border-subtle bg-surface p-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-sm border border-accent bg-accent-soft font-mono text-[11px] text-accent">
                {number}
              </span>
              <div>
                <h3 className="text-sm font-semibold text-primary">{title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-secondary">{body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
