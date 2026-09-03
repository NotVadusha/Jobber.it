import { useEffect, useMemo, useSyncExternalStore } from 'react'

import {
  decodeJobsState,
  defaultJobsState,
  encodeJobsState,
  SOURCE_VALUES,
  type JobsUrlState,
} from '@/routing/jobs-url'
import {
  commitCanonicalHash,
  currentReturnContext,
  ensureCurrentHistoryEntry,
  rememberCurrentJobsScroll,
  ROUTE_EVENT,
} from '@/routing/navigation-context'

export type StaticRouteName = 'saved' | 'ranking' | 'privacy' | 'changelog' | 'about'

export type Route =
  | { name: 'jobs'; state: JobsUrlState }
  | { name: 'job'; postingId: string }
  | { name: StaticRouteName }

export type RouteName = Route['name']

export type NavigationMode = 'push' | 'replace'

export type RouteSnapshot = {
  route: Route
  canonicalHash: string
  rawHash: string
}

const STATIC_ROUTES = new Set<StaticRouteName>(['saved', 'ranking', 'privacy', 'changelog', 'about'])
const POSTING_SOURCES = new Set<string>(SOURCE_VALUES)

export function defaultJobsRoute(): Route {
  return { name: 'jobs', state: defaultJobsState() }
}

function decodePostingId(segment: string): string | null {
  let decoded: string
  try {
    decoded = decodeURIComponent(segment)
  } catch {
    return null
  }

  if (decoded.length < 3 || decoded.length > 512) return null
  for (let i = 0; i < decoded.length; i += 1) {
    const code = decoded.charCodeAt(i)
    if (code <= 0x1f || code === 0x7f) return null
  }

  const separator = decoded.indexOf(':')
  if (separator <= 0 || separator === decoded.length - 1) return null

  const source = decoded.slice(0, separator)
  return POSTING_SOURCES.has(source) ? decoded : null
}

export function parseHash(hash: string): Route {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  const separator = raw.indexOf('?')
  const path = separator === -1 ? raw : raw.slice(0, separator)
  const rawQuery = separator === -1 ? '' : raw.slice(separator + 1)

  if (path === '' || path === '/' || path === '/jobs') {
    return { name: 'jobs', state: decodeJobsState(rawQuery) }
  }

  const job = path.match(/^\/job\/([^/]+)$/)
  if (job) {
    const postingId = decodePostingId(job[1])
    return postingId ? { name: 'job', postingId } : defaultJobsRoute()
  }

  const staticName = path.match(/^\/(saved|ranking|privacy|changelog|about)$/)?.[1]
  return staticName && STATIC_ROUTES.has(staticName as StaticRouteName)
    ? { name: staticName as StaticRouteName }
    : defaultJobsRoute()
}

export function formatRoute(route: Route): string {
  if (route.name === 'jobs') return encodeJobsState(route.state)
  if (route.name === 'job') return `#/job/${encodeURIComponent(route.postingId)}`
  return `#/${route.name}`
}

export function resolveActiveRoute(
  route: Route,
  active: ReadonlySet<RouteName>,
): Route {
  return active.has(route.name) ? route : defaultJobsRoute()
}

function currentHash(): string {
  return window.location.hash
}

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener('hashchange', onStoreChange)
  window.addEventListener('popstate', onStoreChange)
  window.addEventListener(ROUTE_EVENT, onStoreChange)
  return () => {
    window.removeEventListener('hashchange', onStoreChange)
    window.removeEventListener('popstate', onStoreChange)
    window.removeEventListener(ROUTE_EVENT, onStoreChange)
  }
}

export function navigate(route: Route, mode: NavigationMode = 'push'): void {
  const hash = formatRoute(route)
  if (mode === 'push' && hash === currentHash()) return
  commitCanonicalHash(hash, { mode })
}

export function navigateFromJobsToJob(postingId: string): void {
  const canonicalJobsHash = formatRoute(parseHash(currentHash()))
  commitCanonicalHash(canonicalJobsHash, { mode: 'replace' })
  rememberCurrentJobsScroll(window.scrollY)
  commitCanonicalHash(formatRoute({ name: 'job', postingId }), {
    mode: 'push',
    fromJobs: { hash: canonicalJobsHash, scrollY: window.scrollY },
  })
}

export function returnToJobs(): void {
  if (currentReturnContext()) {
    window.history.back()
    return
  }
  navigate(defaultJobsRoute(), 'push')
}

export function useHashRoute(active: ReadonlySet<RouteName>): RouteSnapshot {
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
