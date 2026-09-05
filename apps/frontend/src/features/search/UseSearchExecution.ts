import { useEffect, useState } from 'react'

import { ApiError } from '@/api/client'
import { usePineconeSearchQuery, type PineconeSearchSelection } from '@/api/search'
import { buildBestMatchRequest, commitSearchEntry } from '@/features/search/search-execution'
import type { SearchDraft } from '@/features/search/UseSearchDraft'
import type { JobsUrlState } from '@/routing/jobs-model'
import { normalizeJobsState } from '@/routing/jobs-state'
import { currentEntryId } from '@/routing/navigation-context'

type SearchExecutionOptions = {
  urlState: JobsUrlState
  draft: SearchDraft
  profileText: string
  onError: (error: ApiError | null) => void
}

export function useSearchExecution({ urlState, draft, profileText, onError }: SearchExecutionOptions) {
  const [selection, setSelection] = useState<PineconeSearchSelection | null>(null)
  const searchQuery = usePineconeSearchQuery(selection)

  useEffect(() => {
    const entryId = currentEntryId()
    setSelection((current) => {
      // Preserve a just-submitted query+CV request during its own URL update.
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
    if (!query && !profileText) {
      onError(new ApiError({
        status: 400,
        code: 'EMPTY_SEARCH',
        message: 'Enter a query or attach a CV.',
      }))
      return
    }

    onError(null)
    const next = normalizeJobsState({
      ...urlState,
      query,
      view: query ? 'best' : urlState.view,
      filters: draft.filters,
      page: 1,
    })
    setSelection({
      executionId: commitSearchEntry(next),
      request: buildBestMatchRequest(next, profileText),
    })
  }

  return { searchQuery, submit }
}
