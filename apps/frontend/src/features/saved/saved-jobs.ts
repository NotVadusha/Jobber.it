import { useMemo, useSyncExternalStore } from 'react'

export const SAVED_JOBS_STORAGE_KEY = 'jobber.saved-jobs.v1'
export const SAVED_JOBS_LIMIT = 100

export type SavedJob = {
  id: string
  title: string
  company: string
  source: string
  savedAt: string
}

export type SaveTarget = Omit<SavedJob, 'savedAt'>

export type SavedJobsStore = {
  saved: readonly SavedJob[]
  isSaved(id: string): boolean
  save(target: SaveTarget): boolean
  remove(id: string): void
  atCapacity: boolean
}

const boundedText = (value: unknown, max: number): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().slice(0, max)
  return trimmed.length > 0 ? trimmed : null
}

const decodeSavedJob = (value: unknown): SavedJob | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const id = boundedText(record.id, 512)
  const title = boundedText(record.title, 200)
  const company = boundedText(record.company, 120)
  const source = boundedText(record.source, 32)
  const savedAt = boundedText(record.savedAt, 40)
  if (!id || !title || !company || !source || !savedAt) return null
  if (!Number.isFinite(Date.parse(savedAt))) return null
  return { id, title, company, source, savedAt }
}

const readSavedJobs = (): readonly SavedJob[] => {
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(SAVED_JOBS_STORAGE_KEY)
  } catch {
    return []
  }
  if (raw === null) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []

  const seen = new Set<string>()
  const records: SavedJob[] = []
  for (const entry of parsed) {
    const record = decodeSavedJob(entry)
    if (!record || seen.has(record.id)) continue
    seen.add(record.id)
    records.push(record)
    if (records.length === SAVED_JOBS_LIMIT) break
  }
  return records
}

const persist = (records: readonly SavedJob[]): void => {
  try {
    window.localStorage.setItem(SAVED_JOBS_STORAGE_KEY, JSON.stringify(records))
  } catch {
    // The current document still honors the change when storage is unavailable.
  }
}

let snapshot: readonly SavedJob[] = readSavedJobs()
const listeners = new Set<() => void>()

const emit = (): void => {
  for (const listener of listeners) listener()
}

const commit = (next: readonly SavedJob[]): void => {
  snapshot = next
  persist(next)
  emit()
}

const onStorage = (event: StorageEvent): void => {
  if (event.key !== null && event.key !== SAVED_JOBS_STORAGE_KEY) return
  snapshot = readSavedJobs()
  emit()
}

const subscribe = (listener: () => void): () => void => {
  if (listeners.size === 0) window.addEventListener('storage', onStorage)
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) window.removeEventListener('storage', onStorage)
  }
}

const getSnapshot = (): readonly SavedJob[] => {
  return snapshot
}

const saveJob = (target: SaveTarget): boolean => {
  if (snapshot.some((entry) => entry.id === target.id)) return true
  if (snapshot.length >= SAVED_JOBS_LIMIT) return false
  const record = decodeSavedJob({ ...target, savedAt: new Date().toISOString() })
  if (!record) return false
  commit([record, ...snapshot])
  return true
}

const removeJob = (id: string): void => {
  const next = snapshot.filter((entry) => entry.id !== id)
  if (next.length === snapshot.length) return
  commit(next)
}

export const useSavedJobs = (): SavedJobsStore => {
  const saved = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return useMemo(
    () => ({
      saved,
      isSaved: (id: string) => saved.some((entry) => entry.id === id),
      save: saveJob,
      remove: removeJob,
      atCapacity: saved.length >= SAVED_JOBS_LIMIT,
    }),
    [saved],
  )
}
