import { useEffect } from 'react'

export type JobberHistoryState = {
  version: 1
  entryId: string
  jobsScrollY?: number
  fromJobs?: {
    hash: string
    scrollY: number
    entryId: string
  }
}

export type JobsReturnContext = {
  hash: string
  scrollY: number
  entryId: string
}

type BrowserHistoryState = Record<string, unknown> & {
  jobber?: JobberHistoryState
}

export const ROUTE_EVENT = 'jobber:routechange'

export type CommitHashOptions = {
  mode: 'push' | 'replace'
  fromJobs?: JobsReturnContext
}

let entryCounter = 0

function createEntryId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  entryCounter += 1
  return `entry-${Date.now()}-${entryCounter}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function finiteScroll(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0
}

function isValidFromJobs(value: unknown): value is NonNullable<JobberHistoryState['fromJobs']> {
  return (
    isRecord(value) &&
    typeof value.hash === 'string' &&
    value.hash.startsWith('#/jobs') &&
    typeof value.scrollY === 'number' &&
    Number.isFinite(value.scrollY) &&
    value.scrollY >= 0 &&
    typeof value.entryId === 'string' &&
    value.entryId !== ''
  )
}

function hasValidEnvelope(raw: unknown): raw is { jobber: { version: 1; entryId: string } } {
  const jobber = isRecord(raw) ? raw.jobber : undefined
  return (
    isRecord(jobber) &&
    jobber.version === 1 &&
    typeof jobber.entryId === 'string' &&
    jobber.entryId !== ''
  )
}

function mergeJobberHistory(jobber: JobberHistoryState): BrowserHistoryState {
  const current = isRecord(window.history.state) ? window.history.state : {}
  return { ...current, jobber }
}

export function readJobberHistory(value: unknown = window.history.state): JobberHistoryState {
  if (!hasValidEnvelope(value)) {
    return { version: 1, entryId: createEntryId() }
  }

  const jobber = (value as { jobber: Record<string, unknown> }).jobber
  const result: JobberHistoryState = { version: 1, entryId: jobber.entryId as string }

  if (
    typeof jobber.jobsScrollY === 'number' &&
    Number.isFinite(jobber.jobsScrollY) &&
    jobber.jobsScrollY >= 0
  ) {
    result.jobsScrollY = jobber.jobsScrollY
  }

  if (isValidFromJobs(jobber.fromJobs)) {
    result.fromJobs = jobber.fromJobs
  }

  return result
}

export function ensureCurrentHistoryEntry(): JobberHistoryState {
  const raw = window.history.state
  if (hasValidEnvelope(raw)) return readJobberHistory(raw)

  const fresh = readJobberHistory(raw)
  window.history.replaceState(mergeJobberHistory(fresh), '', window.location.href)
  return fresh
}

export function commitCanonicalHash(
  hash: string,
  { mode, fromJobs: requestedFromJobs }: CommitHashOptions,
): void {
  const current = readJobberHistory()
  const entryId = mode === 'replace' ? current.entryId : createEntryId()
  const fromJobs =
    requestedFromJobs?.hash.startsWith('#/jobs')
      ? {
          hash: requestedFromJobs.hash,
          scrollY: finiteScroll(requestedFromJobs.scrollY),
          entryId: requestedFromJobs.entryId,
        }
      : undefined
  const jobber: JobberHistoryState = {
    version: 1,
    entryId,
    ...(mode === 'replace' && current.jobsScrollY !== undefined
      ? { jobsScrollY: current.jobsScrollY }
      : {}),
    ...(fromJobs ? { fromJobs } : {}),
  }
  const state = mergeJobberHistory(jobber)

  if (mode === 'replace') {
    window.history.replaceState(state, '', hash)
  } else {
    window.history.pushState(state, '', hash)
  }
  window.dispatchEvent(new Event(ROUTE_EVENT))
}

export function renewCurrentHistoryEntry(): JobberHistoryState {
  const current = ensureCurrentHistoryEntry()
  const jobber: JobberHistoryState = {
    ...current,
    entryId: createEntryId(),
  }

  window.history.replaceState(mergeJobberHistory(jobber), '', window.location.href)
  window.dispatchEvent(new Event(ROUTE_EVENT))
  return jobber
}

export function rememberCurrentJobsScroll(scrollY: number = window.scrollY): JobberHistoryState {
  const current = ensureCurrentHistoryEntry()
  const jobber: JobberHistoryState = { ...current, jobsScrollY: finiteScroll(scrollY) }
  window.history.replaceState(mergeJobberHistory(jobber), '', window.location.href)
  window.dispatchEvent(new Event(ROUTE_EVENT))
  return jobber
}

export function currentEntryId(): string {
  return ensureCurrentHistoryEntry().entryId
}

export function jobsReturnContext(): JobsReturnContext | null {
  return readJobberHistory().fromJobs ?? null
}

const restoredEntries = new Set<string>()

export function useJobsScrollRestoration(ready: boolean): void {
  useEffect(() => {
    if (!ready) return

    const current = readJobberHistory()
    if (current.jobsScrollY === undefined) return
    if (restoredEntries.has(current.entryId)) return
    restoredEntries.add(current.entryId)

    const targetY = current.jobsScrollY
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: targetY, behavior: 'auto' })
    })
    return () => cancelAnimationFrame(frame)
  }, [ready])
}
