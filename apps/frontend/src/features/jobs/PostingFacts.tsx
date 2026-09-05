import type { ReactElement } from 'react'

import type { components } from '@/api/schema'
import type { KeysToCamelCase } from '@/api/camelize-response'
import { HighlightedText } from '@/features/jobs/HighlightedText'
import { formatCompensation, useCompensationPeriod } from '@/features/jobs/compensation'
import { SENIORITY_LABELS, WORKPLACE_LABELS } from '@/features/jobs/posting-labels'
import { sourceLabel } from '@/features/jobs/source-labels'
import { formatPostingDate } from '@/lib/format'

type PostingSummary = KeysToCamelCase<components['schemas']['PostingSummary']>

const Dot = (): ReactElement => {
  return <span aria-hidden="true">·</span>
}

export const PostingFacts = ({
  posting,
  terms,
}: {
  posting: PostingSummary
  terms: readonly string[]
}): ReactElement => {
  const { period } = useCompensationPeriod()
  const compensation = formatCompensation(posting.salaryMin, posting.salaryMax, period)
  const postingDate = formatPostingDate(posting.postedAt, posting.firstSeenAt)
  const workplace = posting.remotePolicy && posting.remotePolicy !== 'unknown'
    ? WORKPLACE_LABELS[posting.remotePolicy]
    : undefined
  const seniority = posting.seniority && posting.seniority !== 'unknown'
    ? SENIORITY_LABELS[posting.seniority]
    : undefined

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-tertiary">
      <span className="font-semibold text-secondary">
        <HighlightedText text={posting.company} terms={terms} />
      </span>
      {posting.location && <><Dot /><span>{posting.location}</span></>}
      {workplace && (
        <>
          <Dot />
          <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] ${
            posting.remotePolicy === 'remote'
              ? 'border-strong text-positive'
              : posting.remotePolicy === 'hybrid'
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-strong text-secondary'
          }`}>
            {workplace}
          </span>
        </>
      )}
      {seniority && <><Dot /><span>{seniority}</span></>}
      <Dot />
      <span>
        {posting.yearsRequired === null || posting.yearsRequired === undefined
          ? 'Experience not listed'
          : `${posting.yearsRequired}+ ${posting.yearsRequired === 1 ? 'year' : 'years'}`}
      </span>
      <Dot />
      <span className={compensation ? 'text-secondary' : undefined}>
        {compensation ?? 'Salary undisclosed'}
      </span>
      <Dot />
      <span>via {sourceLabel(posting.source)}</span>
      {postingDate && (
        <>
          <Dot />
          <time dateTime={postingDate.dateTime}>{postingDate.label}</time>
        </>
      )}
    </div>
  )
}
