import { useEffect, useReducer, useState } from 'react'

import { ApiError } from '@/api/client'
import type { BestMatchRequest, PineconeSearchSelection } from '@/api/search'
import { useCorpusMetaQuery, usePineconeSearchQuery } from '@/api/search'
import type { ProfileDocument } from '@/features/cv/read-profile'
import { ProfileReadError, readProfile } from '@/features/cv/read-profile'
import { Label, SearchForm } from '@/features/search/SearchForm'
import { SearchResults } from '@/features/search/SearchResults'
import { SearchTrace } from '@/features/search/SearchTrace'
import {
  currentEntryId,
  renewCurrentHistoryEntry,
} from '@/routing/navigation-context'
import { navigate } from '@/routing/hash-router'
import {
  normalizeJobsState,
  toApiFilters,
  type JobsUrlFilters,
  type JobsUrlState,
  type Seniority,
  type Workplace,
} from '@/routing/jobs-url'
import { PageState } from '@/ui/PageState'
import { useToast } from '@/ui/toast'

type ProfileState = ProfileDocument | null

// Verified against the indexed corpus; an example returning nothing misleads.
const EXAMPLES = ['python aws terraform', 'node.js typescript nestjs', 'distributed systems scala']

type SearchDraft = {
  query: string
  filters: JobsUrlFilters
}

type DraftAction =
  | { type: 'route.changed'; state: JobsUrlState }
  | { type: 'query.changed'; query: string }
  | { type: 'filters.changed'; filters: JobsUrlFilters }

function searchDraftReducer(state: SearchDraft, action: DraftAction): SearchDraft {
  switch (action.type) {
    case 'route.changed':
      return { query: action.state.query, filters: action.state.filters }
    case 'query.changed':
      return { ...state, query: action.query }
    case 'filters.changed':
      return { ...state, filters: action.filters }
  }
}

function buildBestMatchRequest(state: JobsUrlState, profileText: string): BestMatchRequest {
  return {
    query: state.query.trim(),
    profile_text: profileText,
    filters: toApiFilters(state.filters),
  }
}

export type SearchPageProps = {
  urlState: JobsUrlState
}

export function SearchPage({ urlState }: SearchPageProps) {
  const [draft, dispatch] = useReducer(searchDraftReducer, urlState, (state) => ({
    query: state.query,
    filters: state.filters,
  }))
  const [profile, setProfile] = useState<ProfileState>(null)
  const [selection, setSelection] = useState<PineconeSearchSelection | null>(null)
  const [localError, setLocalError] = useState<ApiError | null>(null)
  const { showToast } = useToast()

  // Kept for the wire-normalization contract test to have a request to
  // observe; corpus-meta data has no renderer, so its result/error is
  // intentionally not surfaced here.
  useCorpusMetaQuery()
  const bestMatchQuery = usePineconeSearchQuery(selection)

  const data = bestMatchQuery.data?.data ?? null
  const tookMs = bestMatchQuery.data?.meta.tookMs
  const busy = bestMatchQuery.isFetching

  const error =
    localError ??
    (bestMatchQuery.error instanceof ApiError ? bestMatchQuery.error : null)

  useEffect(() => {
    dispatch({ type: 'route.changed', state: urlState })
    const entryId = currentEntryId()

    setSelection((current) => {
      if (current?.executionId === entryId) return current
      if (urlState.view !== 'best' || !urlState.query.trim()) return null

      return {
        executionId: entryId,
        request: buildBestMatchRequest(urlState, ''),
      }
    })
  }, [urlState])

  function submit(queryOverride?: string): void {
    const query = (queryOverride ?? draft.query).trim()
    const profileText = profile?.text ?? ''
    if (!query && !profileText) {
      setLocalError(new ApiError({
        status: 400,
        code: 'EMPTY_SEARCH',
        message: 'Enter a query or attach a CV.',
      }))
      return
    }

    setLocalError(null)

    const next = normalizeJobsState({
      ...urlState,
      query,
      view: query ? 'best' : urlState.view,
      filters: draft.filters,
      page: 1,
    })

    let executionId: string
    if (query) {
      const before = currentEntryId()
      navigate({ name: 'jobs', state: next }, 'push')
      const after = currentEntryId()
      executionId = after === before
        ? renewCurrentHistoryEntry().entryId
        : after
    } else {
      executionId = renewCurrentHistoryEntry().entryId
    }

    setSelection({
      executionId,
      request: buildBestMatchRequest(next, profileText),
    })
  }

  function submitExample(example: string): void {
    dispatch({ type: 'query.changed', query: example })
    submit(example)
  }

  async function selectProfile(file: File | null): Promise<void> {
    if (!file) return

    try {
      setProfile(await readProfile(file))
      setLocalError(null)
    } catch (failure) {
      setProfile(null)
      setLocalError(new ApiError({
        status: 0,
        code: failure instanceof ProfileReadError ? failure.code : 'READ_FAILED',
        message:
          failure instanceof Error ? failure.message : 'Could not read the selected file.',
      }))
    }
  }

  const toggleRemote = (value: Workplace) =>
    dispatch({
      type: 'filters.changed',
      filters: {
        ...draft.filters,
        remote_policy: draft.filters.remote_policy.includes(value)
          ? draft.filters.remote_policy.filter((v) => v !== value)
          : [...draft.filters.remote_policy, value],
      },
    })

  const setSeniority = (value: Seniority | '') =>
    dispatch({
      type: 'filters.changed',
      filters: { ...draft.filters, seniority: value ? [value] : [] },
    })

  const setExperienceYears = (value: string) =>
    dispatch({
      type: 'filters.changed',
      filters: { ...draft.filters, experience_years: value === '' ? null : Number(value) },
    })

  const setMinSalary = (value: string) =>
    dispatch({
      type: 'filters.changed',
      filters: { ...draft.filters, min_salary: value === '' ? null : Number(value) },
    })

  return (
    <div className="mx-auto max-w-4xl px-6 pb-24">
      <div className="pt-14 pb-10">
        <h1 className="max-w-2xl font-mono text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
          Ranked postings, and why each one ranked.
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-secondary">
          Search the normalized corpus by free text, or attach a CV to search by profile.
          Hard constraints run as metadata filters — they are never embedded.
        </p>
      </div>

      <SearchForm
        query={draft.query}
        remote={draft.filters.remote_policy}
        seniority={draft.filters.seniority[0] ?? ''}
        experienceYears={draft.filters.experience_years === null ? '' : String(draft.filters.experience_years)}
        minSalary={draft.filters.min_salary === null ? '' : String(draft.filters.min_salary)}
        profile={profile}
        busy={busy}
        onQueryChange={(query) => dispatch({ type: 'query.changed', query })}
        onRemoteToggle={toggleRemote}
        onSeniorityChange={setSeniority}
        onExperienceYearsChange={setExperienceYears}
        onMinSalaryChange={setMinSalary}
        onProfileSelect={selectProfile}
        onProfileRemove={() => {
          setProfile(null)
          showToast({ message: 'Profile removed', tone: 'info' })
        }}
        onSubmit={submit}
      />

      {error && (
        <PageState
          kind="error"
          title={error.message}
          description={error.requestId ? `reference ${error.requestId}` : undefined}
          compact
        />
      )}

      {data && <SearchTrace data={data} tookMs={tookMs} busy={busy} />}

      <div aria-live="polite">
        <SearchResults data={data} busy={busy} />

        {!data && !error && (
          <section className="mt-16">
            <Label>Try</Label>
            <ul className="mt-3 flex flex-wrap gap-2">
              {EXAMPLES.map((example) => (
                <li key={example}>
                  <button
                    type="button"
                    onClick={() => submitExample(example)}
                    className="border border-subtle px-3 py-1.5 font-mono text-xs text-secondary transition-colors hover:border-accent hover:text-accent"
                  >
                    {example}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <p className="mt-16 font-mono text-[11px] leading-relaxed text-tertiary">
        Every result links to the posting on its original board. A query or profile runs the full
        retrieve → rerank → respond pipeline over the live Pinecone index; leave both blank
        and this lists the filtered corpus off disk instead, since there's nothing to embed.
      </p>
    </div>
  )
}
