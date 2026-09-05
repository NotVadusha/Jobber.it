import type { BestMatchRequest } from '@/api/search'
import { navigate } from '@/routing/hash-router'
import type { JobsUrlState } from '@/routing/jobs-model'
import { toApiFilters } from '@/routing/jobs-state'
import { currentEntryId, renewCurrentHistoryEntry } from '@/routing/navigation-context'

export function buildBestMatchRequest(state: JobsUrlState, profileText: string): BestMatchRequest {
  return {
    query: state.query.trim(),
    profile_text: profileText,
    filters: toApiFilters(state.filters),
  }
}

export function commitSearchEntry(state: JobsUrlState): string {
  // CV-only searches get a new execution ID without putting profile data in the URL.
  if (!state.query) return renewCurrentHistoryEntry().entryId

  const previousEntryId = currentEntryId()
  navigate({ name: 'jobs', state }, 'push')
  const entryId = currentEntryId()

  // Explicit resubmission must run again even when the canonical URL has not changed.
  return entryId === previousEntryId ? renewCurrentHistoryEntry().entryId : entryId
}
