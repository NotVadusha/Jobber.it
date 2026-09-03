export type JobberHistoryState = {
  version: 1
  entryId: string
  jobsScrollY?: number
  fromJobs?: JobsReturnContext
}

export type JobsReturnContext = {
  hash: string
  scrollY: number
  entryId: string
}

type BrowserHistoryState = Record<string, unknown> & {
  jobber?: JobberHistoryState
}

type HistoryEnvelope = {
  jobber: Record<string, unknown> & Pick<JobberHistoryState, 'version' | 'entryId'>
}

let entryCounter = 0

export const createEntryId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  entryCounter += 1
  return `entry-${Date.now()}-${entryCounter}`
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const isValidScrollY = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

export const normalizeScrollY = (value: unknown): number => {
  return isValidScrollY(value) ? value : 0
}

const isValidFromJobs = (value: unknown): value is NonNullable<JobberHistoryState['fromJobs']> => {
  return (
    isRecord(value) &&
    typeof value.hash === 'string' &&
    value.hash.startsWith('#/jobs') &&
    isValidScrollY(value.scrollY) &&
    typeof value.entryId === 'string' &&
    value.entryId !== ''
  )
}

export const hasValidEnvelope = (raw: unknown): raw is HistoryEnvelope => {
  const jobber = isRecord(raw) ? raw.jobber : undefined
  return (
    isRecord(jobber) &&
    jobber.version === 1 &&
    typeof jobber.entryId === 'string' &&
    jobber.entryId !== ''
  )
}

export const mergeJobberHistory = (jobber: JobberHistoryState): BrowserHistoryState => {
  const current = isRecord(window.history.state) ? window.history.state : {}
  return { ...current, jobber }
}

export const readJobberHistory = (value: unknown = window.history.state): JobberHistoryState => {
  if (!hasValidEnvelope(value)) {
    return { version: 1, entryId: createEntryId() }
  }

  const jobber = value.jobber
  const result: JobberHistoryState = { version: 1, entryId: jobber.entryId }

  if (isValidScrollY(jobber.jobsScrollY)) {
    result.jobsScrollY = jobber.jobsScrollY
  }

  if (isValidFromJobs(jobber.fromJobs)) {
    result.fromJobs = jobber.fromJobs
  }

  return result
}
