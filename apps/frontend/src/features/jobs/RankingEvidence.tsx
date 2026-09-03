import type { ReactElement } from 'react'

import { hasEvidence, type RankedPosting } from '@/features/jobs/ranking-score'

export function RankingEvidence({
  result,
  summary,
}: {
  result: RankedPosting
  summary: string
}): ReactElement | null {
  if (!hasEvidence(result)) return null
  const evidence = result.evidence!

  return (
    <details className="mt-3 rounded-sm border border-subtle bg-surface-raised px-3 py-2">
      <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.12em] text-secondary">
        {summary}
      </summary>
      <dl className="mt-2 flex flex-col gap-2 text-xs text-tertiary">
        {(evidence.literalHits?.length ?? 0) > 0 && (
          <div className="flex flex-wrap items-baseline gap-2">
            <dt className="font-mono text-[10px] uppercase tracking-[0.12em]">
              Literal matches
            </dt>
            {evidence.literalHits!.map((hit) => (
              <dd key={hit.term} className="font-mono text-secondary">
                {hit.term} ({hit.fields.join(', ')})
              </dd>
            ))}
          </div>
        )}
        {(evidence.retrievedSections?.length ?? 0) > 0 && (
          <div className="flex flex-wrap items-baseline gap-2">
            <dt className="font-mono text-[10px] uppercase tracking-[0.12em]">
              Retrieved sections
            </dt>
            <dd className="font-mono text-secondary">
              {evidence.retrievedSections!.join(', ')}
            </dd>
          </div>
        )}
      </dl>
    </details>
  )
}
