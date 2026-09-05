import type { ReactElement } from 'react'

import type { ResolvedPosting } from '@/api/postings'
import { JobLink } from '@/features/jobs/JobLink'
import { PostingFacts } from '@/features/jobs/PostingFacts'
import { PostingStack } from '@/features/jobs/PostingStack'
import { sourceLabel } from '@/features/jobs/source-labels'
import { SaveJobButton } from '@/features/saved/SaveJobButton'
import { SavedBadge } from '@/features/saved/SavedBadge'
import type { SavedJob } from '@/features/saved/saved-jobs'

const NO_TERMS: readonly string[] = []

export const SavedRow = ({
  job,
  resolved,
  resolvedKnown,
}: {
  job: SavedJob
  resolved: ResolvedPosting | undefined
  resolvedKnown: boolean
}): ReactElement => {
  const removed = resolvedKnown && resolved === undefined
  const delisted = resolved !== undefined && resolved.delistedAt !== null

  return (
    <li className="rounded-md border border-subtle bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <h2 className="min-w-0 text-base font-semibold leading-snug text-primary sm:text-lg">
          <JobLink postingId={job.id}>{resolved?.title ?? job.title}</JobLink>
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          {delisted && <SavedBadge>No longer listed</SavedBadge>}
          {removed && <SavedBadge>Removed from the catalogue</SavedBadge>}
          <SaveJobButton
            target={{
              id: job.id,
              title: job.title,
              company: job.company,
              source: job.source,
            }}
          />
        </div>
      </div>

      {resolved ? (
        <>
          <PostingFacts posting={resolved} terms={NO_TERMS} />
          <PostingStack stack={resolved.stack ?? []} terms={NO_TERMS} />
        </>
      ) : (
        <p className="mt-2 text-xs text-tertiary">
          {`${job.company} · via ${sourceLabel(job.source)} · showing the details saved on this device`}
        </p>
      )}
    </li>
  )
}
