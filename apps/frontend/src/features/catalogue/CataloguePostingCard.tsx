import type { ReactElement } from 'react'

import type { PostgresSearchResponse } from '@/api/search'
import { HighlightedText } from '@/features/catalogue/HighlightedText'
import { formatCompensation, useCompensationPeriod } from '@/features/jobs/compensation'
import { SENIORITY_LABELS, WORKPLACE_LABELS } from '@/features/jobs/posting-labels'
import { sourceLabel } from '@/features/jobs/source-labels'
import { formatPostingDate } from '@/lib/format'

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
  const { period } = useCompensationPeriod()
  const compensation = formatCompensation(
    posting.salaryMin,
    posting.salaryMax,
    period,
  )
  const postingDate = formatPostingDate(posting.postedAt, posting.firstSeenAt)
  const remotePolicy = posting.remotePolicy ?? 'unknown'
  const seniorityValue = posting.seniority ?? 'unknown'
  const yearsRequired = posting.yearsRequired ?? null
  const stack = posting.stack ?? []
  const workplace = remotePolicy === 'unknown' ? null : WORKPLACE_LABELS[remotePolicy]
  const seniority = seniorityValue === 'unknown' ? null : SENIORITY_LABELS[seniorityValue]
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

        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-tertiary">
          <span className="font-semibold text-secondary">
            <HighlightedText text={posting.company} terms={terms} />
          </span>
          {posting.location && <><span aria-hidden="true">·</span><span>{posting.location}</span></>}
          {workplace && (
            <>
              <span aria-hidden="true">·</span>
              <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] ${
                remotePolicy === 'remote'
                  ? 'border-strong text-positive'
                  : remotePolicy === 'hybrid'
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-strong text-secondary'
              }`}>
                {workplace}
              </span>
            </>
          )}
          {seniority && <><span aria-hidden="true">·</span><span>{seniority}</span></>}
          <span aria-hidden="true">·</span>
          <span>
            {yearsRequired === null
              ? 'Experience not listed'
              : `${yearsRequired}+ ${yearsRequired === 1 ? 'year' : 'years'}`}
          </span>
          <span aria-hidden="true">·</span>
          <span className={compensation ? 'text-secondary' : undefined}>
            {compensation ?? 'Salary undisclosed'}
          </span>
          <span aria-hidden="true">·</span>
          <span>via {sourceLabel(posting.source)}</span>
          {postingDate && (
            <>
              <span aria-hidden="true">·</span>
              <time dateTime={postingDate.dateTime}>{postingDate.label}</time>
            </>
          )}
        </div>

        {stack.length > 0 && (
          <ul aria-label="Technologies" className="mt-3 flex flex-wrap gap-1.5">
            {stack.map((technology, index) => (
              <li
                key={`${technology}:${index}`}
                className="rounded-sm border border-subtle bg-surface-raised px-2 py-1 font-mono text-[11px] text-secondary"
              >
                <HighlightedText text={technology} terms={terms} />
              </li>
            ))}
          </ul>
        )}
      </article>
    </li>
  )
}
