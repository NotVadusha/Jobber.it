import { useState, type ReactElement } from 'react'

import { ApiError } from '@/api/client'
import { isPostingNotFound, usePostingDetailQuery } from '@/api/postings'
import { JobBody } from '@/features/job-detail/JobBody'
import { useSavedJobs } from '@/features/saved/saved-jobs'
import { isPlainPrimaryClick, navigate, returnToJobs } from '@/routing/hash-router'
import { defaultJobsState } from '@/routing/jobs-model'
import { jobsReturnContext } from '@/routing/navigation-context'
import { copyRoutePermalink, type CopyPermalinkResult } from '@/routing/permalink'
import { PageState } from '@/ui/PageState'
import { Skeleton } from '@/ui/Skeleton'
import { useToast } from '@/ui/toast'

const ACTION_CLASS =
  'min-h-10 rounded-sm border border-subtle px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-secondary hover:border-strong hover:text-primary'

const browseAllPostings = (): void => {
  navigate({ name: 'jobs', state: defaultJobsState() }, 'push')
}

const Breadcrumb = ({ title }: { title: string | null }): ReactElement => {
  const origin = jobsReturnContext()
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-tertiary">
        <li>
          <a
            href={origin?.hash ?? '#/jobs'}
            onClick={(event) => {
              if (!isPlainPrimaryClick(event.nativeEvent)) return
              event.preventDefault()
              returnToJobs()
            }}
            className="rounded-sm underline-offset-4 hover:text-primary hover:underline"
          >
            Jobs
          </a>
        </li>
        <li aria-hidden="true">/</li>
        <li aria-current="page" className="min-w-0 truncate text-secondary">
          {title ?? 'Posting'}
        </li>
      </ol>
    </nav>
  )
}

export function JobPage({ postingId }: { postingId: string }): ReactElement {
  const detailQuery = usePostingDetailQuery(postingId)
  const { isSaved, remove } = useSavedJobs()
  const { showToast } = useToast()
  const [permalink, setPermalink] = useState<CopyPermalinkResult | null>(null)

  const onCopyLink = async (): Promise<void> => {
    const result = await copyRoutePermalink({ name: 'job', postingId })
    if (result.copied) {
      setPermalink(null)
      showToast({ message: 'Link copied', tone: 'success' })
      return
    }
    setPermalink(result)
  }

  const posting = detailQuery.data?.data ?? null

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:py-12">
      <Breadcrumb title={posting?.title ?? null} />

      {detailQuery.isPending && (
        <div className="mt-6 flex flex-col gap-3">
          <Skeleton className="h-8 w-3/4" label="Loading posting" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {detailQuery.isError && isPostingNotFound(detailQuery.error) && (
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

      {detailQuery.isError && !isPostingNotFound(detailQuery.error) && (
        <PageState
          kind="error"
          title="This posting could not be loaded"
          description={
            detailQuery.error instanceof ApiError &&
            detailQuery.error.code === 'CATALOGUE_UNAVAILABLE'
              ? 'The postings catalogue is temporarily unavailable.'
              : 'The posting could not be reached.'
          }
          action={
            <button type="button" onClick={() => void detailQuery.refetch()} className={ACTION_CLASS}>
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
              <button type="button" onClick={() => void onCopyLink()} className={ACTION_CLASS}>
                Copy link
              </button>
            }
          />
          {permalink && !permalink.copied && (
            <label className="mt-3 flex flex-col gap-1 text-xs text-tertiary">
              Copy this link manually
              <input
                readOnly
                value={permalink.url}
                onFocus={(event) => event.currentTarget.select()}
                className="w-full rounded-sm border border-subtle bg-surface px-2 py-1 font-mono text-xs text-secondary"
              />
            </label>
          )}
        </>
      )}
    </main>
  )
}
