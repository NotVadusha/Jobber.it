import { useMemo, type ReactElement } from 'react'

import { usePostingLookupQuery, type ResolvedPosting } from '@/api/postings'
import { SavedRow } from '@/features/saved/SavedRow'
import { SAVED_JOBS_LIMIT, useSavedJobs } from '@/features/saved/saved-jobs'
import { navigate } from '@/routing/hash-router'
import { defaultJobsState } from '@/routing/jobs-model'
import { PageState } from '@/ui/PageState'

const ACTION_CLASS =
  'min-h-10 rounded-sm border border-subtle px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-secondary hover:border-strong hover:text-primary'

const DEVICE_LOCAL_NOTICE =
  'Saved jobs are stored in this browser on this device only. They are not tied to an account, do not sync between devices, and are lost if you clear this site’s data.'

export function SavedPage(): ReactElement {
  const { saved } = useSavedJobs()
  const ids = useMemo(() => saved.map((job) => job.id), [saved])
  const {
    data: lookup,
    isSuccess,
    isError,
    isFetching,
    isPlaceholderData,
    refetch,
  } = usePostingLookupQuery(ids)

  const resolved = useMemo(
    () => new Map((lookup?.data ?? []).map((posting) => [posting.id, posting])),
    [lookup],
  )
  const resolvedKnown = isSuccess && !isPlaceholderData

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

          {isError && (
            <PageState
              kind="error"
              title="Current details could not be loaded"
              description="The postings catalogue is temporarily unavailable. The list below shows the details saved on this device."
              compact
              action={
                <button type="button" onClick={() => void refetch()} className={ACTION_CLASS}>
                  Try again
                </button>
              }
            />
          )}

          <ul aria-label="Saved jobs" aria-busy={isFetching} className="mt-4 flex flex-col gap-3">
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
