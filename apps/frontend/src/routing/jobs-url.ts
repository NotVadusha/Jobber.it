import {
  MAX_EXPERIENCE_YEARS,
  MAX_MIN_SALARY,
  MAX_QUERY_LENGTH,
  POSTED_VALUES,
  SENIORITY_VALUES,
  SOURCE_VALUES,
  WORKPLACE_VALUES,
  type JobsUrlState,
} from '@/routing/jobs-model'
import { canonicalList, firstValid, parseIntegerInRange } from '@/routing/jobs-query-values'
import { defaultViewForQuery, normalizeJobsState } from '@/routing/jobs-state'

export function decodeJobsState(rawQuery: string): JobsUrlState {
  const params = new URLSearchParams(rawQuery)
  const query = (params.get('q') ?? '').trim().slice(0, MAX_QUERY_LENGTH)
  const requestedView = firstValid(params, 'view', value =>
    value === 'all' || value === 'best' ? value : null,
  ) ?? defaultViewForQuery(query)
  const view = requestedView === 'best' && !query ? 'all' : requestedView
  const minSalary = firstValid(params, 'minSalary', value =>
    parseIntegerInRange(value, 1, MAX_MIN_SALARY),
  )
  const includeUndisclosedSalary = minSalary !== null && params.getAll('undisclosedSalary').includes('1')
  const browsePage = firstValid(params, 'page', value =>
    parseIntegerInRange(value, 1, Number.MAX_SAFE_INTEGER),
  ) ?? 1

  return {
    view,
    query,
    filters: {
      remote_policy: canonicalList(params, 'workplace', WORKPLACE_VALUES),
      seniority: canonicalList(params, 'seniority', SENIORITY_VALUES),
      source: canonicalList(params, 'source', SOURCE_VALUES),
      experience_years: firstValid(params, 'experience', value =>
        parseIntegerInRange(value, 0, MAX_EXPERIENCE_YEARS),
      ),
      min_salary: minSalary,
      include_undisclosed_salary: includeUndisclosedSalary,
      posted_within: firstValid(params, 'posted', value =>
        POSTED_VALUES.find(allowed => allowed === value) ?? null,
      ),
    },
    sort: view === 'all' && params.getAll('sort').includes('salary') ? 'salary' : 'newest',
    page: view === 'all' ? browsePage : 1,
  }
}

function encodeValue(value: string): string {
  return encodeURIComponent(value).replaceAll('%2C', ',')
}

export function encodeJobsState(input: JobsUrlState): string {
  const { view, query, filters, sort, page } = normalizeJobsState(input)
  const parts: string[] = []
  const add = (name: string, value: string) => {
    parts.push(`${name}=${encodeValue(value)}`)
  }

  // Parameter order, %20 spaces, and literal list commas are part of the shared URL format.
  if (view !== defaultViewForQuery(query)) add('view', view)
  if (query) add('q', query)
  if (filters.remote_policy.length) add('workplace', filters.remote_policy.join(','))
  if (filters.seniority.length) add('seniority', filters.seniority.join(','))
  if (filters.experience_years !== null) add('experience', String(filters.experience_years))
  if (filters.min_salary !== null) add('minSalary', String(filters.min_salary))
  if (filters.include_undisclosed_salary) add('undisclosedSalary', '1')
  if (filters.posted_within !== null) add('posted', filters.posted_within)
  if (filters.source.length) add('source', filters.source.join(','))
  if (view === 'all' && sort === 'salary') add('sort', 'salary')
  if (view === 'all' && page !== 1) add('page', String(page))

  return parts.length ? `#/jobs?${parts.join('&')}` : '#/jobs'
}
