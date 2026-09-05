import type { BestMatchRequest } from '@/api/search'
import {
  MAX_EXPERIENCE_YEARS,
  MAX_MIN_SALARY,
  MAX_QUERY_LENGTH,
  POSTED_VALUES,
  SENIORITY_VALUES,
  SOURCE_VALUES,
  WORKPLACE_VALUES,
  type JobsUrlFilters,
  type JobsUrlState,
  type JobsView,
} from '@/routing/jobs-model'
import { integerInRange, orderedValues } from '@/routing/jobs-query-values'

type ApiPostingFilters = NonNullable<BestMatchRequest['filters']>

export function defaultViewForQuery(query: string): JobsView {
  return query.trim() ? 'best' : 'all'
}

export function normalizeJobsState(input: JobsUrlState): JobsUrlState {
  const { filters, sort, page } = input
  const query = input.query.trim().slice(0, MAX_QUERY_LENGTH)
  const view: JobsView = input.view === 'best' && query ? 'best' : 'all'
  const minSalary = integerInRange(filters.min_salary, 1, MAX_MIN_SALARY)
  const experience = integerInRange(filters.experience_years, 0, MAX_EXPERIENCE_YEARS)
  const includeUndisclosedSalary = minSalary !== null && filters.include_undisclosed_salary === true
  const postedWithin = POSTED_VALUES.find(value => value === filters.posted_within) ?? null
  const browsePage = integerInRange(page, 1, Number.MAX_SAFE_INTEGER) ?? 1

  return {
    view,
    query,
    filters: {
      remote_policy: orderedValues(filters.remote_policy, WORKPLACE_VALUES),
      seniority: orderedValues(filters.seniority, SENIORITY_VALUES),
      source: orderedValues(filters.source, SOURCE_VALUES),
      experience_years: experience,
      min_salary: minSalary,
      include_undisclosed_salary: includeUndisclosedSalary,
      posted_within: postedWithin,
    },
    sort: view === 'all' && sort === 'salary' ? 'salary' : 'newest',
    page: view === 'all' ? browsePage : 1,
  }
}

export function withJobsView(state: JobsUrlState, view: JobsView): JobsUrlState {
  if (view === 'best' && !state.query.trim()) return { ...state, view: 'all' }
  return view === 'best'
    ? { ...state, view, sort: 'newest', page: 1 }
    : { ...state, view, page: 1 }
}

export function toApiFilters(filters: JobsUrlFilters): ApiPostingFilters {
  return {
    remote_policy: [...filters.remote_policy],
    seniority: [...filters.seniority],
    source: [...filters.source],
    experience_years: filters.experience_years,
    min_salary: filters.min_salary,
    include_undisclosed_salary: filters.include_undisclosed_salary,
    posted_within: filters.posted_within,
  }
}
