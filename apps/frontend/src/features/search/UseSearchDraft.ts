import { useEffect, useReducer } from 'react'

import type { JobsUrlFilters, JobsUrlState, Seniority, Workplace } from '@/routing/jobs-model'

export type SearchDraft = {
  query: string
  filters: JobsUrlFilters
}

type DraftAction =
  | { type: 'route.changed'; state: JobsUrlState }
  | { type: 'query.changed'; query: string }
  | { type: 'filters.changed'; filters: JobsUrlFilters }

function draftFromRoute(state: JobsUrlState): SearchDraft {
  return { query: state.query, filters: state.filters }
}

function searchDraftReducer(state: SearchDraft, action: DraftAction): SearchDraft {
  switch (action.type) {
    case 'route.changed':
      return draftFromRoute(action.state)
    case 'query.changed':
      return { ...state, query: action.query }
    case 'filters.changed':
      return { ...state, filters: action.filters }
  }
}

function numberFromInput(value: string): number | null {
  return value === '' ? null : Number(value)
}

export function useSearchDraft(urlState: JobsUrlState) {
  const [draft, dispatch] = useReducer(searchDraftReducer, urlState, draftFromRoute)

  useEffect(() => {
    dispatch({ type: 'route.changed', state: urlState })
  }, [urlState])

  function setQuery(query: string): void {
    dispatch({ type: 'query.changed', query })
  }

  function updateFilters(changes: Partial<JobsUrlFilters>): void {
    dispatch({ type: 'filters.changed', filters: { ...draft.filters, ...changes } })
  }

  function toggleRemote(value: Workplace): void {
    const selected = draft.filters.remote_policy
    const remotePolicy = selected.includes(value)
      ? selected.filter((workplace) => workplace !== value)
      : [...selected, value]
    updateFilters({ remote_policy: remotePolicy })
  }

  const formProps = {
    query: draft.query,
    remote: draft.filters.remote_policy,
    seniority: draft.filters.seniority[0] ?? '',
    experienceYears: String(draft.filters.experience_years ?? ''),
    minSalary: String(draft.filters.min_salary ?? ''),
    onQueryChange: setQuery,
    onRemoteToggle: toggleRemote,
    onSeniorityChange: (value: Seniority | '') =>
      updateFilters({ seniority: value ? [value] : [] }),
    onExperienceYearsChange: (value: string) =>
      updateFilters({ experience_years: numberFromInput(value) }),
    onMinSalaryChange: (value: string) =>
      updateFilters({ min_salary: numberFromInput(value) }),
  }

  return { draft, setQuery, formProps }
}
