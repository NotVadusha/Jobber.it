import {
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactElement,
} from 'react'

import { ApiError } from '@/api/client'
import type { BestMatchRequest, PineconeSearchSelection } from '@/api/search'
import { usePineconeSearchQuery } from '@/api/search'
import { AllPostingsView } from '@/features/catalogue/AllPostingsView'
import {
  CATALOGUE_DEBOUNCE_MS,
  buildCatalogueDraftState,
  emptyCatalogueFilters,
} from '@/features/catalogue/catalogue-state'
import { ProfileReadError, readProfile, type ProfileDocument } from '@/features/cv/read-profile'
import { JobsViewSwitcher } from '@/features/search/JobsViewSwitcher'
import { SearchForm } from '@/features/search/SearchForm'
import { SearchResults } from '@/features/search/SearchResults'
import { SearchTrace } from '@/features/search/SearchTrace'
import { navigate } from '@/routing/hash-router'
import type { JobsUrlFilters, JobsUrlState, JobsView } from '@/routing/jobs-model'
import { normalizeJobsState, toApiFilters } from '@/routing/jobs-state'
import { encodeJobsState } from '@/routing/jobs-url'
import {
  currentEntryId,
  renewCurrentHistoryEntry,
} from '@/routing/navigation-context'
import { PageState } from '@/ui/PageState'
import { useToast } from '@/ui/toast'

type SearchDraft = {
  query: string
  filters: JobsUrlFilters
}

type DraftAction =
  | { type: 'route.changed'; state: JobsUrlState }
  | { type: 'query.changed'; query: string }
  | { type: 'filters.changed'; filters: JobsUrlFilters }

const searchDraftReducer = (_draft: SearchDraft, action: DraftAction): SearchDraft => {
  switch (action.type) {
    case 'route.changed':
      return { query: action.state.query, filters: action.state.filters }
    case 'query.changed':
      return { ..._draft, query: action.query }
    case 'filters.changed':
      return { ..._draft, filters: action.filters }
  }
}

const buildBestMatchRequest = (
  state: JobsUrlState,
  profileText: string,
): BestMatchRequest => {
  return {
    query: state.query.trim(),
    profile_text: profileText,
    filters: toApiFilters(state.filters),
  }
}

export function SearchPage({ urlState }: { urlState: JobsUrlState }): ReactElement {
  const { showToast } = useToast()
  const [draft, dispatch] = useReducer(
    searchDraftReducer,
    urlState,
    (state): SearchDraft => ({ query: state.query, filters: state.filters }),
  )
  const [profile, setProfile] = useState<ProfileDocument | null>(null)
  const [selection, setSelection] = useState<PineconeSearchSelection | null>(null)
  const [localError, setLocalError] = useState<ApiError | null>(null)
  const [cvOnlyBestVisible, setCvOnlyBestVisible] = useState(false)

  const visibleView: JobsView =
    !urlState.query && cvOnlyBestVisible ? 'best' : urlState.view
  const {
    data: bestMatchResponse,
    error: bestMatchFailure,
    isFetching: bestMatchFetching,
  } = usePineconeSearchQuery(visibleView === 'best' ? selection : null)
  const bestData = bestMatchResponse?.data ?? null
  const bestError =
    localError ?? (bestMatchFailure instanceof ApiError ? bestMatchFailure : null)
  const appliedHash = encodeJobsState(urlState)
  const catalogueDraftState = useMemo(
    () => buildCatalogueDraftState({
      applied: urlState,
      query: draft.query,
      filters: draft.filters,
    }),
    [draft.filters, draft.query, urlState],
  )
  const catalogueDraftHash = encodeJobsState(catalogueDraftState)

  useEffect(() => {
    dispatch({ type: 'route.changed', state: urlState })
    if (urlState.query.trim()) setCvOnlyBestVisible(false)

    const entryId = currentEntryId()
    setSelection((current) => {
      if (urlState.view !== 'best' || !urlState.query.trim()) return null
      if (current?.executionId === entryId) return current
      return {
        executionId: entryId,
        request: buildBestMatchRequest(urlState, ''),
      }
    })
  }, [urlState])

  useEffect(() => {
    if (visibleView !== 'all' || catalogueDraftHash === appliedHash) return
    const timeout = window.setTimeout(() => {
      navigate({ name: 'jobs', state: catalogueDraftState }, 'replace')
    }, CATALOGUE_DEBOUNCE_MS)
    return () => window.clearTimeout(timeout)
  }, [appliedHash, catalogueDraftHash, catalogueDraftState, visibleView])

  const commitCatalogueDraft = (mode: 'push' | 'replace'): void => {
    setLocalError(null)
    setCvOnlyBestVisible(false)
    navigate({ name: 'jobs', state: catalogueDraftState }, mode)
  }

  const runBestMatch = (queryOverride = draft.query): void => {
    const query = queryOverride.trim()
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
      view: query ? 'best' : 'all',
      filters: draft.filters,
      sort: 'newest',
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

    setCvOnlyBestVisible(!query)
    setSelection({
      executionId,
      request: buildBestMatchRequest(next, profileText),
    })
  }

  const submit = (): void => {
    if (visibleView === 'all') {
      commitCatalogueDraft('replace')
      return
    }
    runBestMatch()
  }

  const changeView = (view: JobsView): void => {
    if (view === 'best') {
      runBestMatch()
      return
    }
    setCvOnlyBestVisible(false)
    setSelection(null)
    navigate({ name: 'jobs', state: catalogueDraftState }, 'push')
  }

  const selectProfile = async (file: File | null): Promise<void> => {
    if (!file) return
    try {
      const document = await readProfile(file)
      setProfile(document)
      setLocalError(null)
      if (!urlState.query.trim()) setCvOnlyBestVisible(true)
    } catch (failure) {
      setProfile(null)
      setCvOnlyBestVisible(false)
      setLocalError(new ApiError({
        status: 0,
        code: failure instanceof ProfileReadError ? failure.code : 'READ_FAILED',
        message:
          failure instanceof Error
            ? failure.message
            : 'Could not read the selected file.',
      }))
    }
  }

  const clearFilters = (): void => {
    const filters = emptyCatalogueFilters()
    dispatch({ type: 'filters.changed', filters })
    if (visibleView === 'all') {
      navigate({
        name: 'jobs',
        state: normalizeJobsState({ ...urlState, query: draft.query, filters, page: 1 }),
      }, 'push')
    }
  }

  const clearQuery = (): void => {
    dispatch({ type: 'query.changed', query: '' })
    setCvOnlyBestVisible(false)
    navigate({
      name: 'jobs',
      state: normalizeJobsState({ ...urlState, view: 'all', query: '', page: 1 }),
    }, 'push')
  }

  return (
    <section className="mx-auto w-full max-w-[var(--layout-content-max)] px-4 pb-20 sm:px-6">
      <div className="pt-12 pb-2 sm:pt-16">
        <h1 className="max-w-3xl font-mono text-2xl font-semibold leading-tight tracking-tight text-primary sm:text-4xl">
          Ranked postings, <span className="text-accent">and why each one ranked.</span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-secondary">
          Search the normalized corpus by exact text or semantic relevance. Hard constraints stay structured and are never embedded.
        </p>
      </div>

      <div className="mt-7">
        <SearchForm
          view={visibleView}
          query={draft.query}
          profile={profile}
          busy={bestMatchFetching}
          onQueryChange={(query) => dispatch({ type: 'query.changed', query })}
          onProfileSelect={(file) => void selectProfile(file)}
          onProfileRemove={() => {
            setProfile(null)
            setSelection(null)
            if (!urlState.query.trim()) setCvOnlyBestVisible(false)
            showToast({ message: 'Profile removed', tone: 'info' })
          }}
          onSubmit={submit}
        />
      </div>

      <JobsViewSwitcher
        view={visibleView}
        bestEnabled={Boolean(draft.query.trim() || profile)}
        onViewChange={changeView}
      />

      {visibleView === 'all' ? (
        <AllPostingsView
          state={urlState}
          draftQuery={draft.query}
          draftFilters={draft.filters}
          onDraftFiltersChange={(filters) =>
            dispatch({ type: 'filters.changed', filters })
          }
          onClearFilters={clearFilters}
          onClearQuery={clearQuery}
        />
      ) : (
        <div className="mt-10">
          {bestError && (
            <PageState
              kind="error"
              title="Could not search Best matches"
              description={
                bestError.requestId
                  ? `${bestError.message} · reference ${bestError.requestId}`
                  : bestError.message
              }
            />
          )}
          {!bestError && !bestData && (
            <PageState
              kind={bestMatchFetching ? 'loading' : 'empty'}
              title={
                bestMatchFetching
                  ? 'Ranking postings'
                  : 'Best matches has not run yet'
              }
              description={
                bestMatchFetching
                  ? undefined
                  : 'Best matches orders postings by semantic relevance. Run the search to rank the current query, attached profile, and filters.'
              }
            />
          )}
          {bestData && (
            <>
              <SearchTrace
                data={bestData}
                tookMs={bestMatchResponse?.meta.tookMs}
                busy={bestMatchFetching}
              />
              <SearchResults data={bestData} busy={bestMatchFetching} />
            </>
          )}
        </div>
      )}
    </section>
  )
}
