import type { ReactElement } from 'react'

import type { components } from '@/api/schema'
import type { KeysToCamelCase } from '@/api/camelize-response'
import { HighlightedText } from '@/features/jobs/HighlightedText'
import { formatCompensation, useCompensationPeriod } from '@/features/jobs/compensation'
import { SENIORITY_LABELS, WORKPLACE_LABELS } from '@/features/jobs/posting-labels'
import { sourceLabel } from '@/features/jobs/source-labels'
import { formatPostingDate } from '@/lib/format'

type PostingSummary = KeysToCamelCase<components['schemas']['PostingSummary']>

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
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
        <span className="font-medium text-primary"><HighlightedText text={posting.company} terms={terms} /></span>
        {posting.location && <span className="text-secondary">{posting.location}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-secondary">
        <span className={compensation ? 'font-semibold text-primary' : undefined}>{compensation ?? 'Salary undisclosed'}</span>
        {workplace && <span className="rounded-full bg-surface-raised px-2.5 py-1 text-xs text-secondary">{workplace}</span>}
        {seniority && <span>{seniority}</span>}
        <span>{posting.yearsRequired === null || posting.yearsRequired === undefined
          ? 'Experience not listed'
          : `${posting.yearsRequired}+ ${posting.yearsRequired === 1 ? 'year' : 'years'}`}</span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-tertiary">
        <span>via {sourceLabel(posting.source)}</span>
        {postingDate && <time dateTime={postingDate.dateTime}>{postingDate.label}</time>}
      </div>
    </div>
  )
}
