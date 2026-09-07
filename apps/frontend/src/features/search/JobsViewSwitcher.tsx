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
  const disabledReason = bestEnabled ? null : 'Enter a query or attach a CV to enable Best matches.'

  return (
    <section aria-label="Jobs view" className="mt-5">
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
        <span className="group relative inline-flex">
          <button
            type="button"
            aria-pressed={view === 'best'}
            aria-disabled={disabledReason ? 'true' : undefined}
            aria-describedby={disabledReason ? 'best-matches-view-disabled-reason' : undefined}
            onClick={() => {
              if (bestEnabled) onViewChange('best')
            }}
            className={`min-h-10 rounded-sm px-4 font-mono text-xs font-semibold transition-colors ${
              view === 'best'
                ? 'bg-accent text-accent-ink'
                : 'text-secondary hover:bg-surface-raised hover:text-primary'
            } ${disabledReason ? 'cursor-not-allowed opacity-45' : ''}`}
          >
            Best matches
          </button>
          {disabledReason && (
            <span
              id="best-matches-view-disabled-reason"
              role="tooltip"
              className="pointer-events-none absolute top-full right-0 z-10 mt-2 w-64 rounded-md border border-strong bg-surface-raised px-3 py-2 text-left font-mono text-[11px] leading-relaxed text-secondary opacity-0 shadow-elevated transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none"
            >
              {disabledReason}
            </span>
          )}
        </span>
      </div>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-secondary">
        {description}
      </p>
    </section>
  )
}
