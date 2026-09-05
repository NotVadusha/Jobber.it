import type { components } from '@/api/schema'

export type Workplace = components['schemas']['RemoteFilter']
export type Seniority = components['schemas']['SeniorityFilter']
export type SourceId = components['schemas']['SourceId']
export type PostedWithin = components['schemas']['PostedWithin']

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

export const MAX_QUERY_LENGTH = 500
export const MAX_EXPERIENCE_YEARS = 60
export const MAX_MIN_SALARY = 1_000_000

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
