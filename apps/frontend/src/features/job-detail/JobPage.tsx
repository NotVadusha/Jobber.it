import type { ReactElement } from 'react'

import { ApiError } from '@/api/client'
import { isPostingNotFound, usePostingDetailQuery } from '@/api/postings'
import { Breadcrumb } from '@/features/job-detail/Breadcrumb'
import { JobBody } from '@/features/job-detail/JobBody'
import { CopyLinkButton } from '@/features/jobs/CopyLinkButton'
import { useSavedJobs } from '@/features/saved/saved-jobs'
import { navigate } from '@/routing/hash-router'
import { defaultJobsState } from '@/routing/jobs-model'
import { PageState } from '@/ui/PageState'
import { Skeleton } from '@/ui/Skeleton'

const ACTION_CLASS =
  'min-h-10 rounded-sm border border-subtle px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-secondary hover:border-strong hover:text-primary'

const browseAllPostings = (): void => {
  navigate({ name: 'jobs', state: defaultJobsState() }, 'push')
}

export function JobPage({ postingId }: { postingId: string }): ReactElement {
  const {
    data: detail,
    error: detailFailure,
    isPending,
    isError,
    refetch,
  } = usePostingDetailQuery(postingId)
  const { isSaved, remove } = useSavedJobs()

  const posting = detail?.data ?? null

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:py-12">
      <Breadcrumb title={posting?.title ?? null} />

      {isPending && (
        <div className="mt-6 flex flex-col gap-3">
          <Skeleton className="h-8 w-3/4" label="Loading posting" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {isError && isPostingNotFound(detailFailure) && (
        <PageState
          kind="empty"
          title="This posting is not in the catalogue"
          description="Jobber only holds postings its sources still publish. This one was never ingested, or its record has been cleared."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" onClick={browseAllPostings} className={ACTION_CLASS}>
                Browse all postings
              </button>
              {isSaved(postingId) && (
                <button type="button" onClick={() => remove(postingId)} className={ACTION_CLASS}>
                  Remove from saved
                </button>
              )}
            </div>
          }
        />
      )}

      {isError && !isPostingNotFound(detailFailure) && (
        <PageState
          kind="error"
          title="This posting could not be loaded"
          description={
            detailFailure instanceof ApiError &&
            detailFailure.code === 'CATALOGUE_UNAVAILABLE'
              ? 'The postings catalogue is temporarily unavailable.'
              : 'The posting could not be reached.'
          }
          action={
            <button type="button" onClick={() => void refetch()} className={ACTION_CLASS}>
              Try again
            </button>
          }
        />
      )}

      {posting && (
        <>
          <JobBody
            posting={posting}
            actions={
              <CopyLinkButton
                route={{ name: 'job', postingId }}
                className={ACTION_CLASS}
              />
            }
          />
        </>
      )}
    </section>
  )
}
