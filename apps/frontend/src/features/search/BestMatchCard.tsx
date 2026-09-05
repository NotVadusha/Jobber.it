import type { ReactElement } from 'react'

import type { BestMatchData } from '@/api/search'
import { HighlightedText } from '@/features/jobs/HighlightedText'
import { PostingFacts } from '@/features/jobs/PostingFacts'
import { PostingStack } from '@/features/jobs/PostingStack'
import {
  evidenceTerms,
  hasEvidence,
  matchPercent,
} from '@/features/search/best-match-state'

type BestMatchResult = BestMatchData['results'][number]

export const BestMatchCard = ({
  result,
  rank,
}: {
  result: BestMatchResult
  rank: number
}): ReactElement => {
  const terms = evidenceTerms(result)
  const percent = matchPercent(result.score)
  const titleId = `best-match-${result.id}`

  return (
    <li
      aria-labelledby={titleId}
      className="rise grid grid-cols-[2rem_minmax(0,1fr)] gap-3 rounded-md border border-subtle bg-surface p-4 transition-[border-color,box-shadow] hover:border-strong hover:shadow-elevated sm:grid-cols-[2.5rem_minmax(0,1fr)] sm:gap-4 sm:p-5"
    >
      <span className="pt-0.5 font-mono text-xs tabular-nums text-tertiary">
        {String(rank).padStart(2, '0')}
      </span>

      <article className="min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3
            id={titleId}
            className="min-w-0 text-base font-semibold leading-snug text-primary sm:text-lg"
          >
            <HighlightedText text={result.title} terms={terms} />
          </h3>
          <p className="flex shrink-0 items-center gap-2">
            <span className="h-[3px] w-14 bg-surface-strong" aria-hidden="true">
              <span className="block h-full bg-accent" style={{ width: `${percent}%` }} />
            </span>
            <span className="font-mono text-xs tabular-nums text-secondary">
              {percent}% match
            </span>
          </p>
        </div>

        <PostingFacts posting={result} terms={terms} />
        <PostingStack stack={result.stack ?? []} terms={terms} />

        {hasEvidence(result) && (
          <details className="mt-3 rounded-sm border border-subtle bg-surface-raised px-3 py-2">
            <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.12em] text-secondary">
              Why this ranked
            </summary>
            <dl className="mt-2 flex flex-col gap-2 text-xs text-tertiary">
              {(result.evidence!.literalHits?.length ?? 0) > 0 && (
                <div className="flex flex-wrap items-baseline gap-2">
                  <dt className="font-mono text-[10px] uppercase tracking-[0.12em]">
                    Literal matches
                  </dt>
                  {result.evidence!.literalHits!.map((hit) => (
                    <dd key={hit.term} className="font-mono text-secondary">
                      {hit.term} ({hit.fields.join(', ')})
                    </dd>
                  ))}
                </div>
              )}
              {(result.evidence!.retrievedSections?.length ?? 0) > 0 && (
                <div className="flex flex-wrap items-baseline gap-2">
                  <dt className="font-mono text-[10px] uppercase tracking-[0.12em]">
                    Retrieved sections
                  </dt>
                  <dd className="font-mono text-secondary">
                    {result.evidence!.retrievedSections!.join(', ')}
                  </dd>
                </div>
              )}
            </dl>
          </details>
        )}
      </article>
    </li>
  )
}
