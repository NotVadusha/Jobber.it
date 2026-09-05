import { defaultJobsState, SOURCE_VALUES, type JobsUrlState } from '@/routing/jobs-model'
import { decodeJobsState, encodeJobsState } from '@/routing/jobs-url'

const STATIC_ROUTES = ['saved', 'ranking', 'privacy', 'changelog', 'about'] as const

export type StaticRouteName = typeof STATIC_ROUTES[number]

export type Route =
  | { name: 'jobs'; state: JobsUrlState }
  | { name: 'job'; postingId: string }
  | { name: StaticRouteName }

export type RouteName = Route['name']

const MAX_POSTING_ID_LENGTH = 512
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

  if (decoded.length > MAX_POSTING_ID_LENGTH) return null
  // Percent decoding can smuggle ASCII control characters into an ID: C0 (0-31) and DEL (127).
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

  const staticName = STATIC_ROUTES.find(name => path === `/${name}`)
  return staticName ? { name: staticName } : defaultJobsRoute()
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
