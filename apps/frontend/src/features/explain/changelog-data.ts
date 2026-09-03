import { useQuery } from '@tanstack/react-query'

import { RELEASES_API, REPO_URL } from '@/features/explain/project'
import { STORAGE_KEYS } from '@/lib/storage-keys'

export const CHANGELOG_TTL_MS = 6 * 60 * 60 * 1000

export type Release = {
  tag: string
  name: string
  publishedAt: string
  body: string
  prerelease: boolean
}

export type ChangelogState = {
  releases: readonly Release[]
  source: 'network' | 'cache'
  fetchedAt: string
}

type CachedChangelog = {
  fetchedAt: string
  releases: Release[]
}

export const releaseUrl = (tag: string): string => {
  return `${REPO_URL}/releases/tag/${encodeURIComponent(tag)}`
}

const text = (value: unknown, max: number): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().slice(0, max)
  return trimmed.length > 0 ? trimmed : null
}

const decodeRelease = (value: unknown): Release | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const entry = value as Record<string, unknown>

  const tag = text(entry.tag_name ?? entry.tag, 120)
  if (!tag) return null

  const publishedAt = text(entry.published_at ?? entry.publishedAt, 40)
  if (!publishedAt || !Number.isFinite(Date.parse(publishedAt))) return null

  return {
    tag,
    name: text(entry.name, 200) ?? tag,
    publishedAt,
    body: typeof entry.body === 'string' ? entry.body : '',
    prerelease: entry.prerelease === true,
  }
}

const decodeReleases = (value: unknown): Release[] => {
  if (!Array.isArray(value)) return []
  return value.map(decodeRelease).filter((release): release is Release => release !== null)
}

const readCache = (): CachedChangelog | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.changelog)
    if (raw === null) return null
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const fetchedAt = text(parsed.fetchedAt, 40)
    if (!fetchedAt || !Number.isFinite(Date.parse(fetchedAt))) return null
    return { fetchedAt, releases: decodeReleases(parsed.releases) }
  } catch {
    return null
  }
}

const writeCache = (cached: CachedChangelog): void => {
  try {
    window.localStorage.setItem(STORAGE_KEYS.changelog, JSON.stringify(cached))
  } catch {
    // The page still renders; the next visit simply fetches again.
  }
}

const fetchReleases = async (signal?: AbortSignal): Promise<Release[]> => {
  const response = await fetch(RELEASES_API, {
    signal,
    credentials: 'omit',
    headers: { Accept: 'application/vnd.github+json' },
  })
  if (!response.ok) throw new Error(`GitHub responded ${response.status}`)
  return decodeReleases(await response.json())
}

const loadChangelog = async (signal?: AbortSignal): Promise<ChangelogState> => {
  try {
    const releases = await fetchReleases(signal)
    const fetchedAt = new Date().toISOString()
    writeCache({ fetchedAt, releases })
    return { releases, source: 'network', fetchedAt }
  } catch (error) {
    const cached = readCache()
    if (!cached) throw error
    return { releases: cached.releases, source: 'cache', fetchedAt: cached.fetchedAt }
  }
}

export const changelogQueryKeys = {
  all: ['changelog'] as const,
}

export const useChangelogQuery = () => {
  const cached = readCache()
  const cachedAt = cached ? Date.parse(cached.fetchedAt) : 0
  const fresh = cached !== null && Date.now() - cachedAt < CHANGELOG_TTL_MS

  return useQuery<ChangelogState>({
    queryKey: changelogQueryKeys.all,
    queryFn: ({ signal }) => loadChangelog(signal),
    staleTime: CHANGELOG_TTL_MS,
    gcTime: CHANGELOG_TTL_MS,
    retry: 1,
    refetchOnWindowFocus: false,
    initialData:
      fresh && cached
        ? { releases: cached.releases, source: 'cache', fetchedAt: cached.fetchedAt }
        : undefined,
    initialDataUpdatedAt: fresh ? cachedAt : undefined,
  })
}
