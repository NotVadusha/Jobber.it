import type { ReactElement } from 'react'

import type { PostgresSearchResponse } from '@/api/search'
import { HighlightedText } from '@/features/jobs/HighlightedText'
import { PostingFacts } from '@/features/jobs/PostingFacts'
import { PostingStack } from '@/features/jobs/PostingStack'

type CataloguePosting = PostgresSearchResponse['data'][number]

export const CataloguePostingCard = ({
  posting,
  resultNumber,
  terms,
}: {
  posting: CataloguePosting
  resultNumber: number
  terms: readonly string[]
}): ReactElement => {
  const titleId = `catalogue-posting-${resultNumber}`

  return (
    <li
      aria-labelledby={titleId}
      className="rise grid grid-cols-[2rem_minmax(0,1fr)] gap-3 rounded-md border border-subtle bg-surface p-4 transition-[border-color,box-shadow,transform] hover:-translate-y-px hover:border-strong hover:shadow-elevated motion-reduce:transform-none sm:grid-cols-[2.5rem_minmax(0,1fr)] sm:gap-4 sm:p-5"
    >
      <span className="pt-0.5 font-mono text-xs tabular-nums text-tertiary">
        {String(resultNumber).padStart(2, '0')}
      </span>
      <article className="min-w-0">
        <h3 id={titleId} className="text-base font-semibold leading-snug text-primary sm:text-lg">
          <HighlightedText text={posting.title} terms={terms} />
        </h3>

        <PostingFacts posting={posting} terms={terms} />
        <PostingStack stack={posting.stack ?? []} terms={terms} />
      </article>
    </li>
  )
}
