import type { ReactElement } from 'react'

import { ApiError } from '@/api/client'
import type { BestMatchRequest } from '@/api/search'
import {
  idleStream,
  useBestMatchStreamQuery,
  useCancelBestMatchStream,
  type BestMatchSelection,
} from '@/api/search-stream'
import { BestMatchResults } from '@/features/search/BestMatchResults'
import { BestMatchTrace } from '@/features/search/BestMatchTrace'
import { Cooldown } from '@/features/search/Cooldown'
import { isRankingPending } from '@/features/search/best-match-state'
import { PageState } from '@/ui/PageState'
import { Skeleton } from '@/ui/Skeleton'

const retryAfterSeconds = (error: ApiError): number | null => {
  const details = error.details
  if (typeof details !== 'object' || details === null) return null
  const value = (details as Record<string, unknown>).retryAfterSeconds
  return typeof value === 'number' && value > 0 ? value : null
}

export const BestMatchView = ({
  selection,
  pendingRequest,
  onRun,
  onBrowseAllPostings,
}: {
  selection: BestMatchSelection | null
  pendingRequest: BestMatchRequest
  onRun(): void
  onBrowseAllPostings(): void
}): ReactElement => {
  const {
    data,
    error: streamFailure,
    isFetching: streaming,
  } = useBestMatchStreamQuery(selection)
  const cancel = useCancelBestMatchStream()
  const state = data ?? null
  const error = streamFailure instanceof ApiError ? streamFailure : null
  const pending = isRankingPending(pendingRequest, selection?.request ?? null)
  const cooldown = error?.code === 'RATE_LIMITED' ? retryAfterSeconds(error) : null
  // Rendered from the first paint, all stages pending, so the rail cannot
  // appear underneath the Stop button and shift it out from under a click.
  const traced = state ?? (streaming ? idleStream() : null)

  if (!selection) {
    return (
      <div className="mt-10">
        <PageState
          kind="empty"
          title="Best matches has not run yet"
          description="Best matches orders postings by semantic relevance. Run the search to rank the current query, attached profile, and filters."
        />
      </div>
    )
  }

  return (
    <div className="mt-10">
      {traced && (
        <BestMatchTrace
          stages={traced.stages}
          status={traced.status}
          failed={Boolean(error)}
          snapshot={traced.snapshot}
          tookMs={traced.tookMs}
        />
      )}

      {streaming && (
        <div className="mt-4 flex items-center justify-between gap-4">
          <span role="status" className="font-mono text-xs text-tertiary">
            Ranking postings…
          </span>
          <button
            type="button"
            onClick={() => void cancel(selection.executionId)}
            className="min-h-9 rounded-sm border border-strong px-3 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-primary transition-colors hover:border-accent hover:text-accent"
          >
            Stop
          </button>
        </div>
      )}

      {!streaming && pending && state?.snapshot && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-accent bg-accent-soft px-4 py-3">
          <p className="text-sm text-secondary">
            This ranking is from your previous search. The query or filters have changed.
          </p>
          <button
            type="button"
            onClick={onRun}
            className="min-h-10 rounded-sm bg-accent px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-ink"
          >
            Update matches
          </button>
        </div>
      )}

      {error && (
        <div className="mt-6">
          <PageState
            kind="error"
            title={cooldown === null ? 'Could not rank postings' : 'Too many searches'}
            description={`${error.message}${error.requestId ? ` (${error.requestId})` : ''}`}
            action={
              <span className="flex flex-wrap items-center gap-3">
                {cooldown !== null && <Cooldown seconds={cooldown} />}
                <button
                  type="button"
                  onClick={onRun}
                  className="min-h-10 rounded-sm border border-strong px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-primary"
                >
                  Try again
                </button>
                <button
                  type="button"
                  onClick={onBrowseAllPostings}
                  className="min-h-10 rounded-sm bg-accent px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-ink"
                >
                  Browse all postings
                </button>
              </span>
            }
          />
        </div>
      )}

      {!error && state?.status === 'cancelled' && (
        <div className="mt-6">
          <PageState
            kind="empty"
            title="Search stopped"
            description="The ranking was stopped on this device before results arrived. A provider request already in progress may still finish."
            action={
              <button
                type="button"
                onClick={onRun}
                className="min-h-10 rounded-sm bg-accent px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-ink"
              >
                Run the search again
              </button>
            }
          />
        </div>
      )}

      {!error && streaming && !state?.snapshot && (
        <ol className="mt-6 flex flex-col gap-3" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((index) => (
            <li key={index} className="rounded-md border border-subtle bg-surface p-4 sm:p-5">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="mt-3 h-3 w-full" />
              <Skeleton className="mt-2 h-3 w-1/2" />
            </li>
          ))}
        </ol>
      )}
      {!error && streaming && !state?.snapshot && (
        <p role="status" className="sr-only">Ranking postings</p>
      )}

      {!error && state?.snapshot && (
        <BestMatchResults
          key={selection.executionId}
          snapshot={state.snapshot}
          onBrowseAllPostings={onBrowseAllPostings}
        />
      )}
    </div>
  )
}
