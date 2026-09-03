import type { ReactElement } from 'react'

import type { components } from '@/api/schema'
import type { KeysToCamelCase } from '@/api/camelize-response'
import { HighlightedText } from '@/features/jobs/HighlightedText'
import { formatCompensation, useCompensationPeriod } from '@/features/jobs/compensation'
import { sourceLabel } from '@/features/jobs/source-labels'
import { formatPostingDate } from '@/lib/format'

type PostingSummary = KeysToCamelCase<components['schemas']['PostingSummary']>

const WORKPLACE_LABELS: Record<string, string> = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'On-site',
}

const SENIORITY_LABELS: Record<string, string> = {
  intern: 'Intern',
  junior: 'Junior',
  mid: 'Mid',
  senior: 'Senior',
  lead: 'Lead',
  principal: 'Principal',
}

function Dot(): ReactElement {
  return <span aria-hidden="true">·</span>
}

export function PostingFacts({
  posting,
  terms,
}: {
  posting: PostingSummary
  terms: readonly string[]
}): ReactElement {
  const { period } = useCompensationPeriod()
  const compensation = formatCompensation(posting.salaryMin, posting.salaryMax, period)
  const postingDate = formatPostingDate(posting.postedAt, posting.firstSeenAt)
  const workplace = posting.remotePolicy
    ? WORKPLACE_LABELS[posting.remotePolicy]
    : undefined
  const seniority = posting.seniority ? SENIORITY_LABELS[posting.seniority] : undefined

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

export function PostingStack({
  stack,
  terms,
}: {
  stack: readonly string[]
  terms: readonly string[]
}): ReactElement | null {
  if (stack.length === 0) return null

  return (
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
  )
}
