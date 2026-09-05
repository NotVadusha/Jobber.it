import type { ReactElement, ReactNode } from 'react'

import type { PostingDetail } from '@/api/postings'
import { JobRankingContext } from '@/features/job-detail/JobRankingContext'
import { JobSection } from '@/features/job-detail/JobSection'
import { PostingFacts } from '@/features/jobs/PostingFacts'
import { PostingStack } from '@/features/jobs/PostingStack'
import { sourceLabel } from '@/features/jobs/source-labels'
import { SaveJobButton } from '@/features/saved/SaveJobButton'
import { formatAbsoluteDate } from '@/lib/format'

const NO_TERMS: readonly string[] = []

const externalHost = (url: string): string | null => {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.host : null
  } catch {
    return null
  }
}

export const JobBody = ({
  posting,
  actions,
}: {
  posting: PostingDetail
  actions: ReactNode
}): ReactElement => {
  const host = externalHost(posting.url)
  const delisted = posting.delistedAt !== null && posting.delistedAt !== undefined
  const lastSeen = formatAbsoluteDate(posting.lastSeenAt)

  return (
    <article className="min-w-0">
      {delisted && (
        <p
          role="status"
          className="mt-4 rounded-md border border-strong bg-surface-raised px-4 py-3 text-sm text-secondary"
        >
          {`No longer listed. ${sourceLabel(posting.source)} stopped listing this posting. `}
          {lastSeen ? (
            <>
              {'It was last seen on '}
              <time dateTime={lastSeen.dateTime}>{lastSeen.label}</time>.
            </>
          ) : null}
        </p>
      )}

      <h1 className="mt-4 text-xl font-semibold leading-tight text-primary sm:text-2xl">
        {posting.title}
      </h1>

      <PostingFacts posting={posting} terms={NO_TERMS} />
      <PostingStack stack={posting.stack ?? []} terms={NO_TERMS} />

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {delisted || host === null ? (
          <p className="text-xs text-tertiary">
            The original posting is no longer available at the source.
          </p>
        ) : (
          <a
            href={posting.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="min-h-10 rounded-sm bg-accent px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-ink"
          >
            {`Open original posting on ${host}`}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        )}
        <SaveJobButton
          target={{
            id: posting.id,
            title: posting.title,
            company: posting.company,
            source: posting.source,
          }}
        />
        {actions}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-tertiary">
        {`Aggregated from ${sourceLabel(posting.source)}. `}
        {lastSeen ? (
          <>
            {'Last seen in the source on '}
            <time dateTime={lastSeen.dateTime}>{lastSeen.label}</time>.{' '}
          </>
        ) : null}
        Jobber does not host this posting.
      </p>

      <JobRankingContext postingId={posting.id} />

      <JobSection heading="Requirements" text={posting.requirements ?? null} />
      <JobSection heading="Responsibilities" text={posting.responsibilities ?? null} />
      <JobSection heading="Description" text={posting.description ?? null} />
    </article>
  )
}
