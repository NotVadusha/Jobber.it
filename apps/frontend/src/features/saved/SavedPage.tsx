import { useMemo, type ReactElement } from 'react'

import { usePostingLookupQuery, type ResolvedPosting } from '@/api/postings'
import { JobLink } from '@/features/jobs/JobLink'
import { PostingFacts, PostingStack } from '@/features/jobs/PostingFacts'
import { sourceLabel } from '@/features/jobs/source-labels'
import { SaveJobButton } from '@/features/saved/SaveJobButton'
import { SAVED_JOBS_LIMIT, useSavedJobs, type SavedJob } from '@/features/saved/saved-jobs'
import { navigate } from '@/routing/hash-router'
import { defaultJobsState } from '@/routing/jobs-model'
import { PageState } from '@/ui/PageState'

const NO_TERMS: readonly string[] = []

const ACTION_CLASS =
  'min-h-10 rounded-sm border border-subtle px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-secondary hover:border-strong hover:text-primary'

const DEVICE_LOCAL_NOTICE =
  'Saved jobs are stored in this browser on this device only. They are not tied to an account, do not sync between devices, and are lost if you clear this site’s data.'

const Badge = ({ children }: { children: string }): ReactElement => {
  return (
    <span className="rounded-full border border-strong px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-secondary">
      {children}
    </span>
  )
}

const SavedRow = ({
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
          {delisted && <Badge>No longer listed</Badge>}
          {removed && <Badge>Removed from the catalogue</Badge>}
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

export function SavedPage(): ReactElement {
  const { saved } = useSavedJobs()
  const ids = useMemo(() => saved.map((job) => job.id), [saved])
  const lookupQuery = usePostingLookupQuery(ids)

  const resolved = useMemo(
    () => new Map((lookupQuery.data?.data ?? []).map((posting) => [posting.id, posting])),
    [lookupQuery.data],
  )
  const resolvedKnown = lookupQuery.isSuccess && !lookupQuery.isPlaceholderData

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:py-12">
      <h1 className="text-xl font-semibold leading-tight text-primary sm:text-2xl">Saved jobs</h1>
      <p className="mt-2 max-w-2xl text-xs leading-relaxed text-tertiary">{DEVICE_LOCAL_NOTICE}</p>

      {saved.length === 0 ? (
        <PageState
          kind="empty"
          title="No saved jobs on this device"
          description="Save a posting from a result card or a job page and it will appear here."
          action={
            <button
              type="button"
              onClick={() => navigate({ name: 'jobs', state: defaultJobsState() }, 'push')}
              className={ACTION_CLASS}
            >
              Browse all postings
            </button>
          }
        />
      ) : (
        <>
          <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.12em] text-tertiary">
            {`${saved.length} saved · ${SAVED_JOBS_LIMIT - saved.length} remaining`}
          </p>

          {lookupQuery.isError && (
            <PageState
              kind="error"
              title="Current details could not be loaded"
              description="The postings catalogue is temporarily unavailable. The list below shows the details saved on this device."
              compact
              action={
                <button type="button" onClick={() => void lookupQuery.refetch()} className={ACTION_CLASS}>
                  Try again
                </button>
              }
            />
          )}

          <ul aria-label="Saved jobs" aria-busy={lookupQuery.isFetching} className="mt-4 flex flex-col gap-3">
            {saved.map((job) => (
              <SavedRow
                key={job.id}
                job={job}
                resolved={resolved.get(job.id)}
                resolvedKnown={resolvedKnown}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
