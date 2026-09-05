import { formatRoute, type Route } from '@/routing/route-codec'

export type CopyPermalinkResult = {
  url: string
  copied: boolean
}

export function absoluteRouteUrl(route: Route, current: Location): string {
  const url = new URL(current.href)
  url.hash = formatRoute(route).slice(1)
  return url.toString()
}

export async function copyRoutePermalink(
  route: Route,
  clipboard = window.navigator.clipboard,
): Promise<CopyPermalinkResult> {
  const url = absoluteRouteUrl(route, window.location)
  if (!clipboard?.writeText) return { url, copied: false }
  try {
    await clipboard.writeText(url)
    return { url, copied: true }
  } catch {
    return { url, copied: false }
  }
}

export function canShareJobsSearch({ query, hasProfile }: {
  query: string
  hasProfile: boolean
}): boolean {
  return query.trim().length > 0 || !hasProfile
}
