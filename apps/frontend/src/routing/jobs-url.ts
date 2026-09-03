import type { BestMatchRequest } from '@/api/search'
import type { components } from '@/api/schema'

export type Workplace = components['schemas']['RemoteFilter']
export type Seniority = components['schemas']['SeniorityFilter']
export type SourceId = components['schemas']['SourceId']
export type PostedWithin = components['schemas']['PostedWithin']
type ApiPostingFilters = NonNullable<BestMatchRequest['filters']>

export type JobsView = 'all' | 'best'
export type BrowseSort = 'newest' | 'salary'

export type JobsUrlFilters = {
  remote_policy: Workplace[]
  seniority: Seniority[]
  source: SourceId[]
  experience_years: number | null
  min_salary: number | null
  include_undisclosed_salary: boolean
  posted_within: PostedWithin | null
}

export type JobsUrlState = {
  view: JobsView
  query: string
  filters: JobsUrlFilters
  sort: BrowseSort
  page: number
}

export const WORKPLACE_VALUES = ['remote', 'hybrid', 'onsite'] as const satisfies readonly Workplace[]
export const SENIORITY_VALUES = [
  'intern',
  'junior',
  'mid',
  'senior',
  'lead',
  'principal',
] as const satisfies readonly Seniority[]
export const POSTED_VALUES = ['24h', '7d', '30d'] as const satisfies readonly PostedWithin[]
export const SOURCE_VALUES = [
  'ashby',
  'djinni',
  'dou',
  'greenhouse',
  'jobico',
  'lever',
  'linkedin',
] as const satisfies readonly SourceId[]

export function defaultViewForQuery(query: string): JobsView {
  return query.trim() ? 'best' : 'all'
}

export const DEFAULT_JOBS_FILTERS: JobsUrlFilters = {
  remote_policy: [],
  seniority: [],
  source: [],
  experience_years: null,
  min_salary: null,
  include_undisclosed_salary: false,
  posted_within: null,
}

export function defaultJobsState(): JobsUrlState {
  return {
    view: 'all',
    query: '',
    filters: {
      ...DEFAULT_JOBS_FILTERS,
      remote_policy: [],
      seniority: [],
      source: [],
    },
    sort: 'newest',
    page: 1,
  }
}

function firstValid<T>(
  params: URLSearchParams,
  name: string,
  decode: (value: string) => T | null,
): T | null {
  for (const value of params.getAll(name)) {
    const decoded = decode(value)
    if (decoded !== null) return decoded
  }
  return null
}

function canonicalList<T extends string>(
  params: URLSearchParams,
  name: string,
  order: readonly T[],
): T[] {
  const values = new Set(
    params.getAll(name).flatMap((value) => value.split(',')).filter(Boolean),
  )
  return order.filter((value) => values.has(value))
}

function integerInRange(value: string, minimum: number, maximum: number): number | null {
  if (!/^\d+$/.test(value)) return null
  const number = Number(value)
  return Number.isSafeInteger(number) && number >= minimum && number <= maximum
    ? number
    : null
}

function encodeValue(value: string): string {
  return encodeURIComponent(value).replaceAll('%2C', ',')
}

function orderedValues<T extends string>(values: readonly T[], order: readonly T[]): T[] {
  const selected = new Set(values)
  return order.filter((value) => selected.has(value))
}

export function decodeJobsState(rawQuery: string): JobsUrlState {
  const params = new URLSearchParams(rawQuery)
  const query = (params.get('q') ?? '').trim().slice(0, 500)
  const defaultView = defaultViewForQuery(query)
  const requestedView = firstValid(params, 'view', (value) =>
    value === 'all' || value === 'best' ? value : null,
  )
  const view = requestedView === 'best' && !query ? 'all' : requestedView ?? defaultView
  const minSalary = firstValid(params, 'minSalary', (value) =>
    integerInRange(value, 1, 1_000_000),
  )

  return {
    view,
    query,
    filters: {
      remote_policy: canonicalList(params, 'workplace', WORKPLACE_VALUES),
      seniority: canonicalList(params, 'seniority', SENIORITY_VALUES),
      source: canonicalList(params, 'source', SOURCE_VALUES),
      experience_years: firstValid(params, 'experience', (value) =>
        integerInRange(value, 0, 60),
      ),
      min_salary: minSalary,
      include_undisclosed_salary:
        minSalary !== null && params.getAll('undisclosedSalary').includes('1'),
      posted_within: firstValid(params, 'posted', (value) =>
        POSTED_VALUES.includes(value as PostedWithin) ? (value as PostedWithin) : null,
      ),
    },
    sort:
      view === 'all' && params.getAll('sort').includes('salary') ? 'salary' : 'newest',
    page:
      view === 'all'
        ? firstValid(params, 'page', (value) => integerInRange(value, 1, Number.MAX_SAFE_INTEGER)) ?? 1
        : 1,
  }
}

export function normalizeJobsState({
  query: rawQuery,
  view: requestedInputView,
  filters,
  sort,
  page,
}: JobsUrlState): JobsUrlState {
  const query = rawQuery.trim().slice(0, 500)
  const requestedView = requestedInputView === 'best' && !query
    ? 'all'
    : requestedInputView
  const rawMinSalary = filters.min_salary
  const minSalary =
    rawMinSalary !== null &&
    Number.isSafeInteger(rawMinSalary) &&
    rawMinSalary >= 1 &&
    rawMinSalary <= 1_000_000
      ? rawMinSalary
      : null
  const rawExperience = filters.experience_years
  const experience =
    rawExperience !== null &&
    Number.isSafeInteger(rawExperience) &&
    rawExperience >= 0 &&
    rawExperience <= 60
      ? rawExperience
      : null
  const view: JobsView = requestedView === 'best' ? 'best' : 'all'

  return {
    view,
    query,
    filters: {
      remote_policy: orderedValues(filters.remote_policy, WORKPLACE_VALUES),
      seniority: orderedValues(filters.seniority, SENIORITY_VALUES),
      source: orderedValues(filters.source, SOURCE_VALUES),
      experience_years: experience,
      min_salary: minSalary,
      include_undisclosed_salary:
        minSalary !== null && filters.include_undisclosed_salary === true,
      posted_within: POSTED_VALUES.includes(filters.posted_within as PostedWithin)
        ? filters.posted_within
        : null,
    },
    sort: view === 'all' && sort === 'salary' ? 'salary' : 'newest',
    page:
      view === 'all' && Number.isSafeInteger(page) && page > 0
        ? page
        : 1,
  }
}

export function encodeJobsState(input: JobsUrlState): string {
  const state = normalizeJobsState(input)
  const parts: string[] = []
  const add = (name: string, value: string) => {
    parts.push(`${name}=${encodeValue(value)}`)
  }

  if (state.view !== defaultViewForQuery(state.query)) add('view', state.view)
  if (state.query) add('q', state.query)
  if (state.filters.remote_policy.length) {
    add('workplace', state.filters.remote_policy.join(','))
  }
  if (state.filters.seniority.length) {
    add('seniority', state.filters.seniority.join(','))
  }
  if (state.filters.experience_years !== null) {
    add('experience', String(state.filters.experience_years))
  }
  if (state.filters.min_salary !== null) {
    add('minSalary', String(state.filters.min_salary))
  }
  if (state.filters.include_undisclosed_salary) add('undisclosedSalary', '1')
  if (state.filters.posted_within !== null) add('posted', state.filters.posted_within)
  if (state.filters.source.length) add('source', state.filters.source.join(','))
  if (state.view === 'all' && state.sort === 'salary') add('sort', 'salary')
  if (state.view === 'all' && state.page !== 1) add('page', String(state.page))

  return parts.length ? `#/jobs?${parts.join('&')}` : '#/jobs'
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
