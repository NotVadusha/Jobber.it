import type { ReactElement } from 'react'

import type { BestMatchData } from '@/api/search'
import { HighlightedText } from '@/features/jobs/HighlightedText'
import { JobLink } from '@/features/jobs/JobLink'
import { PostingFacts } from '@/features/jobs/PostingFacts'
import { PostingStack } from '@/features/jobs/PostingStack'
import { RankingEvidence } from '@/features/jobs/RankingEvidence'
import { evidenceTerms, matchPercent } from '@/features/jobs/ranking-score'
import { SaveJobButton } from '@/features/saved/SaveJobButton'

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
            <JobLink postingId={result.id}>
              <HighlightedText text={result.title} terms={terms} />
            </JobLink>
          </h3>
          <p className="flex shrink-0 items-center gap-2">
            <span className="h-[3px] w-14 bg-surface-strong" aria-hidden="true">
              <span className="block h-full bg-accent" style={{ width: `${percent}%` }} />
            </span>
            <span className="font-mono text-xs tabular-nums text-secondary">
              {percent}% match
            </span>
          </p>
          <SaveJobButton
            target={{
              id: result.id,
              title: result.title,
              company: result.company,
              source: result.source,
            }}
          />
        </div>

        <PostingFacts posting={result} terms={terms} />
        <PostingStack stack={result.stack ?? []} terms={terms} />

        <RankingEvidence result={result} summary="Why this ranked" />
      </article>
    </li>
  )
}
