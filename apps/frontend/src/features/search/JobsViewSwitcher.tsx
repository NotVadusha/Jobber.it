import type { ReactElement } from 'react'

import type { JobsView } from '@/routing/jobs-model'

export const JobsViewSwitcher = ({
  view,
  bestEnabled,
  onViewChange,
}: {
  view: JobsView
  bestEnabled: boolean
  onViewChange(view: JobsView): void
}): ReactElement => {
  const description = view === 'all'
    ? 'Every live posting matching your exact text and filters. Sorted by date or disclosed salary.'
    : 'Semantic matches ordered only by relevance. Filters apply when you run the search.'

  return (
    <section aria-label="Jobs view" className="mt-8">
      <div className="inline-flex rounded-md border border-subtle bg-surface p-1">
        <button
          type="button"
          aria-pressed={view === 'all'}
          onClick={() => onViewChange('all')}
          className={`min-h-10 rounded-sm px-4 font-mono text-xs font-semibold transition-colors ${
            view === 'all'
              ? 'bg-accent text-accent-ink'
              : 'text-secondary hover:bg-surface-raised hover:text-primary'
          }`}
        >
          All postings
        </button>
        <button
          type="button"
          aria-pressed={view === 'best'}
          disabled={!bestEnabled}
          title={bestEnabled ? undefined : 'Enter a query or attach a CV first'}
          onClick={() => onViewChange('best')}
          className={`min-h-10 rounded-sm px-4 font-mono text-xs font-semibold transition-colors ${
            view === 'best'
              ? 'bg-accent text-accent-ink'
              : 'text-secondary hover:bg-surface-raised hover:text-primary'
          } disabled:cursor-not-allowed disabled:opacity-45`}
        >
          Best matches
        </button>
      </div>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-secondary">
        {description}
      </p>
    </section>
  )
}
