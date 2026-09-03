import {
  createEntryId,
  hasValidEnvelope,
  mergeJobberHistory,
  normalizeScrollY,
  readJobberHistory,
  type JobberHistoryState,
  type JobsReturnContext,
} from '@/routing/history-state'

export const ROUTE_EVENT = 'jobber:routechange'

export type CommitHashOptions = {
  mode: 'push' | 'replace'
  fromJobs?: JobsReturnContext
}

export const ensureCurrentHistoryEntry = (): JobberHistoryState => {
  const raw = window.history.state
  if (hasValidEnvelope(raw)) return readJobberHistory(raw)

  const fresh = readJobberHistory(raw)
  window.history.replaceState(mergeJobberHistory(fresh), '', window.location.href)
  return fresh
}

export const commitCanonicalHash = (
  hash: string,
  { mode, fromJobs: requestedFromJobs }: CommitHashOptions,
): void => {
  const current = readJobberHistory()
  const entryId = mode === 'replace' ? current.entryId : createEntryId()
  const jobber: JobberHistoryState = { version: 1, entryId }

  if (mode === 'replace' && current.jobsScrollY !== undefined) {
    jobber.jobsScrollY = current.jobsScrollY
  }
  if (requestedFromJobs?.hash.startsWith('#/jobs')) {
    jobber.fromJobs = {
      hash: requestedFromJobs.hash,
      scrollY: normalizeScrollY(requestedFromJobs.scrollY),
      entryId: requestedFromJobs.entryId,
    }
  }
  const state = mergeJobberHistory(jobber)

  if (mode === 'replace') {
    window.history.replaceState(state, '', hash)
  } else {
    window.history.pushState(state, '', hash)
  }
  window.dispatchEvent(new Event(ROUTE_EVENT))
}

export const renewCurrentHistoryEntry = (): JobberHistoryState => {
  const current = ensureCurrentHistoryEntry()
  const jobber: JobberHistoryState = {
    ...current,
    entryId: createEntryId(),
  }

  window.history.replaceState(mergeJobberHistory(jobber), '', window.location.href)
  window.dispatchEvent(new Event(ROUTE_EVENT))
  return jobber
}

export const rememberCurrentJobsScroll = (scrollY: number = window.scrollY): JobberHistoryState => {
  const current = ensureCurrentHistoryEntry()
  const jobber: JobberHistoryState = { ...current, jobsScrollY: normalizeScrollY(scrollY) }
  window.history.replaceState(mergeJobberHistory(jobber), '', window.location.href)
  window.dispatchEvent(new Event(ROUTE_EVENT))
  return jobber
}

export const currentEntryId = (): string => {
  return ensureCurrentHistoryEntry().entryId
}

export const jobsReturnContext = (): JobsReturnContext | null => {
  return readJobberHistory().fromJobs ?? null
}
