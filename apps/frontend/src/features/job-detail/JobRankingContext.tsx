import type { ReactElement } from 'react'

import { useRankingContext } from '@/features/job-detail/ranking-context'
import { RankingEvidence } from '@/features/jobs/RankingEvidence'
import { matchPercent } from '@/features/jobs/ranking-score'

const CONTEXT_NOTICE =
  'These figures come from the Best-match search that led to this page, not from a new ranking. The percentage is an uncalibrated reranker score, not a probability, a prediction, or a guarantee.'

export const JobRankingContext = ({ postingId }: { postingId: string }): ReactElement | null => {
  const context = useRankingContext(postingId)
  if (!context) return null

  const percent = matchPercent(context.result.score)

  return (
    <section
      aria-labelledby="job-ranking-context"
      className="mt-8 rounded-md border border-subtle bg-surface-raised p-4 sm:p-5"
    >
      <h2
        id="job-ranking-context"
        className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-secondary"
      >
        Why this ranked
      </h2>

      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs tabular-nums text-secondary">
        <span>{`Rank ${context.rank}`}</span>
        <span aria-hidden="true">·</span>
        <span className="h-[3px] w-14 bg-surface-strong" aria-hidden="true">
          <span className="block h-full bg-accent" style={{ width: `${percent}%` }} />
        </span>
        <span>{`${percent}% match`}</span>
      </p>

      <RankingEvidence result={context.result} summary="Matched terms and sections" />

      <p className="mt-3 max-w-2xl text-xs leading-relaxed text-tertiary">
        {CONTEXT_NOTICE}{' '}
        <a className="text-accent underline underline-offset-4" href="#/ranking">
          What this number means
        </a>
      </p>
    </section>
  )
}
