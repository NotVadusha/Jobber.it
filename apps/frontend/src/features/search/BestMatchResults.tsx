import { useState, type ReactElement } from 'react'

import type { BestMatchData } from '@/api/search'
import { BestMatchCard } from '@/features/search/BestMatchCard'
import {
  REVEAL_STEP,
  UNCALIBRATED_SCORE_NOTICE,
  revealLabel,
} from '@/features/search/best-match-state'
import { PageState } from '@/ui/PageState'

export const BestMatchResults = ({
  snapshot,
  onBrowseAllPostings,
}: {
  snapshot: BestMatchData
  onBrowseAllPostings(): void
}): ReactElement => {
  const [revealed, setRevealed] = useState(REVEAL_STEP)
  const total = snapshot.results.length

  if (total === 0) {
    return (
      <PageState
        kind="empty"
        title="Nothing cleared your filters"
        description="No posting satisfied every hard constraint for this query. Drop a constraint, or search the full catalogue by exact text."
        action={
          <button type="button" onClick={onBrowseAllPostings} className="min-h-10 rounded-sm bg-accent px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-ink">
            Search all postings by exact text
          </button>
        }
      />
    )
  }

  const visible = snapshot.results.slice(0, revealed)
  const exhausted = revealed >= total

  return (
    <>
      <p className="mt-8 max-w-2xl text-xs leading-relaxed text-tertiary">
        {UNCALIBRATED_SCORE_NOTICE}
      </p>

      <ol className="mt-4 flex flex-col gap-3">
        {visible.map((result, index) => (
          <BestMatchCard key={result.id} result={result} rank={index + 1} />
        ))}
      </ol>

      {exhausted ? (
        <div className="mt-6 rounded-md border border-subtle bg-surface p-4 sm:p-5">
          <p className="text-sm leading-relaxed text-secondary">
            That is every posting the ranking retained for this query. All postings searches
            the full catalogue by exact text with the same hard filters.
          </p>
          <button
            type="button"
            onClick={onBrowseAllPostings}
            className="mt-3 min-h-10 rounded-sm border border-strong px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-primary transition-colors hover:border-accent hover:text-accent"
          >
            Search all postings by exact text
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setRevealed((current) => current + REVEAL_STEP)}
          className="mt-6 min-h-10 w-full rounded-sm border border-strong px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-primary transition-colors hover:border-accent hover:text-accent"
        >
          {revealLabel(revealed, total)}
        </button>
      )}
    </>
  )
}
