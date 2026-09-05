import { useCallback, useSyncExternalStore } from 'react'

export const CV_CONSENT_STORAGE_KEY = 'jobber.cv-consent.v1'

const GRANTED = 'granted'

const read = (): boolean => {
  try {
    return window.localStorage.getItem(CV_CONSENT_STORAGE_KEY) === GRANTED
  } catch {
    return false
  }
}

let snapshot = read()
const listeners = new Set<() => void>()

const emit = (): void => {
  for (const listener of listeners) listener()
}

const onStorage = (event: StorageEvent): void => {
  if (event.key !== null && event.key !== CV_CONSENT_STORAGE_KEY) return
  snapshot = read()
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

const getSnapshot = (): boolean => {
  return snapshot
}

export const useCvConsent = (): { granted: boolean; grant(): void } => {
  const granted = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const grant = useCallback(() => {
    try {
      window.localStorage.setItem(CV_CONSENT_STORAGE_KEY, GRANTED)
    } catch {
      // The current document still honors the choice when storage is unavailable.
    }
    snapshot = true
    emit()
  }, [])

  return { granted, grant }
}
