import { useEffect, useMemo, useRef, type ReactElement } from 'react'

import { usePostgresSearchQuery } from '@/api/search'
import { CatalogueFilters } from '@/features/catalogue/CatalogueFilters'
import { CatalogueResults } from '@/features/catalogue/CatalogueResults'
import {
  activeCatalogueFilterCount,
  buildPostgresSearchRequest,
  shouldShowWelcome,
} from '@/features/catalogue/catalogue-state'
import { WelcomeDashboard } from '@/features/catalogue/WelcomeDashboard'
import { navigate } from '@/routing/hash-router'
import { useJobsScrollRestoration } from '@/routing/navigation-context'
import {
  normalizeJobsState,
  type BrowseSort,
  type JobsUrlFilters,
  type JobsUrlState,
} from '@/routing/jobs-url'

export type AllPostingsViewProps = {
  state: JobsUrlState
  draftQuery: string
  draftFilters: JobsUrlFilters
  onDraftFiltersChange(filters: JobsUrlFilters): void
  onClearFilters(): void
  onClearQuery(): void
}

export function AllPostingsView({
  state,
  draftQuery,
  draftFilters,
  onDraftFiltersChange,
  onClearFilters,
  onClearQuery,
}: AllPostingsViewProps): ReactElement {
  const resultsRef = useRef<HTMLDivElement>(null)
  const request = useMemo(() => buildPostgresSearchRequest(state), [state])
  const postingsQuery = usePostgresSearchQuery(request)
  const pagination = postingsQuery.data?.meta.pagination
  useJobsScrollRestoration(!postingsQuery.isPending && !postingsQuery.isPlaceholderData)
  const activeCount = activeCatalogueFilterCount(draftFilters)
  const welcomeState = normalizeJobsState({
    ...state,
    query: draftQuery,
    filters: draftFilters,
  })

  useEffect(() => {
    if (
      postingsQuery.isPlaceholderData ||
      !pagination ||
      pagination.totalPages === 0 ||
      state.page <= pagination.totalPages
    ) {
      return
    }
    navigate({
      name: 'jobs',
      state: normalizeJobsState({ ...state, page: pagination.totalPages }),
    }, 'replace')
  }, [pagination, postingsQuery.isPlaceholderData, state])

  function changeSort(sort: BrowseSort): void {
    navigate({
      name: 'jobs',
      state: normalizeJobsState({
        ...state,
        view: 'all',
        query: draftQuery,
        filters: draftFilters,
        sort,
        page: 1,
      }),
    }, 'push')
  }

  function changePage(page: number): void {
    navigate({
      name: 'jobs',
      state: normalizeJobsState({ ...state, page }),
    }, 'push')
    window.requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' })
    })
  }

  return (
    <div className="mt-10 grid items-start gap-6 lg:grid-cols-[16.5rem_minmax(0,1fr)] lg:gap-9">
      <CatalogueFilters
        filters={draftFilters}
        activeCount={activeCount}
        onChange={onDraftFiltersChange}
        onClear={onClearFilters}
      />
      <div ref={resultsRef} className="min-w-0 scroll-mt-[calc(var(--layout-header-height)+1rem)]">
        {shouldShowWelcome(welcomeState) && <WelcomeDashboard />}
        <CatalogueResults
          query={state.query}
          activeFilterCount={activeCount}
          sort={state.sort}
          response={postingsQuery.data}
          error={postingsQuery.error}
          pending={postingsQuery.isPending}
          fetching={postingsQuery.isFetching}
          placeholder={postingsQuery.isPlaceholderData}
          onSortChange={changeSort}
          onPageChange={changePage}
          onClearFilters={onClearFilters}
          onClearQuery={onClearQuery}
          onRetry={() => void postingsQuery.refetch()}
        />
      </div>
    </div>
  )
}
