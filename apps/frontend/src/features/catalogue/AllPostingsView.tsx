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
import type { BrowseSort, JobsUrlFilters, JobsUrlState } from '@/routing/jobs-model'
import { normalizeJobsState } from '@/routing/jobs-state'
import { useJobsScrollRestoration } from '@/routing/scroll-restoration'

export type AllPostingsViewProps = {
  state: JobsUrlState
  draftQuery: string
  draftFilters: JobsUrlFilters
  onDraftFiltersChange(filters: JobsUrlFilters): void
  onClearFilters(): void
  onClearQuery(): void
}

export const AllPostingsView = ({
  state,
  draftQuery,
  draftFilters,
  onDraftFiltersChange,
  onClearFilters,
  onClearQuery,
}: AllPostingsViewProps): ReactElement => {
  const resultsRef = useRef<HTMLDivElement>(null)
  const request = useMemo(() => buildPostgresSearchRequest(state), [state])
  const {
    data,
    error,
    isPending,
    isFetching,
    isPlaceholderData,
    refetch,
  } = usePostgresSearchQuery(request)
  const pagination = data?.meta.pagination
  useJobsScrollRestoration(!isPending && !isPlaceholderData)
  const activeCount = activeCatalogueFilterCount(draftFilters)
  const welcomeState = normalizeJobsState({
    ...state,
    query: draftQuery,
    filters: draftFilters,
  })

  useEffect(() => {
    if (
      isPlaceholderData ||
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
  }, [pagination, isPlaceholderData, state])

  const changeSort = (sort: BrowseSort): void => {
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

  const changePage = (page: number): void => {
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
          response={data}
          error={error}
          pending={isPending}
          fetching={isFetching}
          placeholder={isPlaceholderData}
          onSortChange={changeSort}
          onPageChange={changePage}
          onClearFilters={onClearFilters}
          onClearQuery={onClearQuery}
          onRetry={() => void refetch()}
        />
      </div>
    </div>
  )
}
