import { useEffect, useMemo, useSyncExternalStore } from 'react'

import {
  commitCanonicalHash,
  currentEntryId,
  ensureCurrentHistoryEntry,
  jobsReturnContext,
  rememberCurrentJobsScroll,
  ROUTE_EVENT,
} from '@/routing/navigation-context'

import {
  defaultJobsRoute,
  formatRoute,
  parseHash,
  resolveActiveRoute,
  type Route,
  type RouteName,
} from '@/routing/route-codec'

export type NavigationMode = 'push' | 'replace'

export type RouteSnapshot = {
  route: Route
  canonicalHash: string
  rawHash: string
}

const currentHash = (): string => {
  return window.location.hash
}

const subscribe = (onStoreChange: () => void): () => void => {
  window.addEventListener('hashchange', onStoreChange)
  window.addEventListener('popstate', onStoreChange)
  window.addEventListener(ROUTE_EVENT, onStoreChange)
  return () => {
    window.removeEventListener('hashchange', onStoreChange)
    window.removeEventListener('popstate', onStoreChange)
    window.removeEventListener(ROUTE_EVENT, onStoreChange)
  }
}

export const navigate = (route: Route, mode: NavigationMode = 'push'): void => {
  const hash = formatRoute(route)
  if (mode === 'push' && hash === currentHash()) return
  commitCanonicalHash(hash, { mode })
}

export const isPlainPrimaryClick = (event: MouseEvent): boolean => {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  )
}

export const navigateFromJobsToJob = (postingId: string): void => {
  const canonicalJobsHash = formatRoute(parseHash(currentHash()))
  commitCanonicalHash(canonicalJobsHash, { mode: 'replace' })
  rememberCurrentJobsScroll(window.scrollY)
  commitCanonicalHash(formatRoute({ name: 'job', postingId }), {
    mode: 'push',
    fromJobs: {
      hash: canonicalJobsHash,
      scrollY: window.scrollY,
      entryId: currentEntryId(),
    },
  })
}

export const returnToJobs = (): void => {
  if (jobsReturnContext()) {
    window.history.back()
    return
  }
  navigate(defaultJobsRoute(), 'push')
}

export const useHashRoute = (active: ReadonlySet<RouteName>): RouteSnapshot => {
  const rawHash = useSyncExternalStore(subscribe, currentHash, () => '#/jobs')

  const snapshot = useMemo<RouteSnapshot>(() => {
    const route = resolveActiveRoute(parseHash(rawHash), active)
    return { route, canonicalHash: formatRoute(route), rawHash }
  }, [rawHash, active])

  useEffect(() => {
    if (rawHash !== snapshot.canonicalHash) {
      commitCanonicalHash(snapshot.canonicalHash, { mode: 'replace' })
    } else {
      ensureCurrentHistoryEntry()
    }
  }, [rawHash, snapshot.canonicalHash])

  return snapshot
}
