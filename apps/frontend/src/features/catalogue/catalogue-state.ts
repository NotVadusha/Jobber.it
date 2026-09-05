import type { PostgresSearchRequest } from '@/api/search'
import { defaultJobsState, type JobsUrlFilters, type JobsUrlState } from '@/routing/jobs-model'
import { normalizeJobsState, toApiFilters } from '@/routing/jobs-state'

export const CATALOGUE_DEBOUNCE_MS = 350

export function emptyCatalogueFilters(): JobsUrlFilters {
  return defaultJobsState().filters
}

export function activeCatalogueFilterCount({
  remote_policy: workplace,
  seniority,
  source,
  experience_years: experience,
  min_salary: minimumSalary,
  posted_within: postedWithin,
}: JobsUrlFilters): number {
  return (
    workplace.length +
    seniority.length +
    source.length +
    (experience === null ? 0 : 1) +
    (minimumSalary === null ? 0 : 1) +
    (postedWithin === null ? 0 : 1)
  )
}

export function buildPostgresSearchRequest({
  query,
  filters,
  sort,
  page,
}: JobsUrlState): PostgresSearchRequest {
  return {
    query,
    filters: toApiFilters(filters),
    sort,
    page,
  }
}

export function buildCatalogueDraftState({
  applied,
  query,
  filters,
}: {
  applied: JobsUrlState
  query: string
  filters: JobsUrlFilters
}): JobsUrlState {
  return normalizeJobsState({
    ...applied,
    view: 'all',
    query,
    filters,
    page: 1,
  })
}

export function shouldShowWelcome({
  view,
  query,
  filters,
  sort,
  page,
}: JobsUrlState): boolean {
  return (
    view === 'all' &&
    query.length === 0 &&
    activeCatalogueFilterCount(filters) === 0 &&
    sort === 'newest' &&
    page === 1
  )
}
