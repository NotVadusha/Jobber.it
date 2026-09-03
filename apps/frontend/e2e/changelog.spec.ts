import { expect, test } from '@playwright/test'
import type { Page, Route } from '@playwright/test'

const STORAGE_KEY = 'jobber.changelog.v1'
const RELEASES_PATTERN = '**api.github.com/**'

type WireRelease = {
  tag_name?: string
  name?: string
  published_at?: string
  body?: string
  prerelease?: boolean
  html_url?: string
}

const fulfilReleases = async (page: Page, body: unknown, status = 200): Promise<void> => {
  await page.route(RELEASES_PATTERN, (route: Route) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }),
  )
}

const abortReleases = async (page: Page): Promise<void> => {
  await page.route(RELEASES_PATTERN, (route: Route) => route.abort())
}

const seedCache = async (page: Page, value: { fetchedAt: string; releases: unknown[] } | string): Promise<void> => {
  await page.addInitScript(
    ([key, raw]) => window.localStorage.setItem(key as string, raw as string),
    [STORAGE_KEY, typeof value === 'string' ? value : JSON.stringify(value)] as const,
  )
}

const release = (overrides: WireRelease = {}): WireRelease => {
  return {
    tag_name: 'v1.0.0',
    name: 'Release 1',
    published_at: '2026-09-01T10:00:00.000Z',
    body: 'The first release.',
    prerelease: false,
    html_url: 'https://example.invalid/should-not-be-used',
    ...overrides,
  }
}

const openChangelog = async (page: Page): Promise<void> => {
  await page.goto('/#/changelog')
  await expect(page.getByRole('heading', { level: 1, name: 'Changelog' })).toBeVisible()
}

const entries = (page: Page) => {
  return page.locator('#main-content').getByRole('listitem')
}

test('a populated response renders one entry per release, newest first', async ({ page }) => {
  await fulfilReleases(page, [
    release({ tag_name: 'v2.0.0', name: 'Release 2' }),
    release({ tag_name: 'v1.0.0', name: 'Release 1' }),
  ])
  await openChangelog(page)

  const rows = entries(page)
  await expect(rows).toHaveCount(2)
  await expect(rows.nth(0)).toContainText('Release 2')
  await expect(rows.nth(0)).toContainText('v2.0.0')
  await expect(rows.nth(0).locator('time')).toBeVisible()
})

test("an entry's link is built from the repository constant and tag, not html_url", async ({ page }) => {
  await fulfilReleases(page, [release({ tag_name: 'v1.0.0' })])
  await openChangelog(page)

  const link = page.getByRole('link', { name: /Read on GitHub/ })
  await expect(link).toHaveAttribute(
    'href',
    'https://github.com/NotVadusha/Jobber.it/releases/tag/v1.0.0',
  )
})

test('a hostile body renders as visible text, executes nothing, and does not widen the document', async ({ page }) => {
  const longToken = 'x'.repeat(400)
  const hostileBody = `<script>alert(1)</script>\n- a list-like line\n${longToken}`
  await fulfilReleases(page, [release({ body: hostileBody })])
  await openChangelog(page)

  await expect(page.getByText('alert(1)')).toBeVisible()
  await expect(page.locator('#main-content script')).toHaveCount(0)
  await expect(entries(page).locator('ul, ol, li')).toHaveCount(0)

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)
})

test('a prerelease shows its badge as text', async ({ page }) => {
  await fulfilReleases(page, [release({ prerelease: true })])
  await openChangelog(page)

  await expect(page.getByText('Prerelease')).toBeVisible()
})

test('entries missing tag_name or published_at are dropped, and the rest still render', async ({ page }) => {
  await fulfilReleases(page, [
    release({ tag_name: undefined }),
    release({ published_at: undefined }),
    release({ tag_name: 'v1.0.0' }),
  ])
  await openChangelog(page)

  await expect(entries(page)).toHaveCount(1)
})

test('after a successful load, localStorage holds the projection and a fetchedAt, and no html_url', async ({ page }) => {
  await fulfilReleases(page, [release()])
  await openChangelog(page)
  await expect(entries(page)).toHaveCount(1)

  const stored = await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY)
  expect(stored).not.toBeNull()
  const parsed = JSON.parse(stored ?? '{}')
  expect(parsed.fetchedAt).toBeTruthy()
  expect(JSON.stringify(parsed)).not.toContain('html_url')
})

test('a reload within the freshness window renders from cache and makes no request', async ({ page }) => {
  await seedCache(page, { fetchedAt: new Date().toISOString(), releases: [release()] })

  let requested = false
  await page.route(RELEASES_PATTERN, (route: Route) => {
    requested = true
    return route.abort()
  })

  await openChangelog(page)
  await expect(entries(page)).toHaveCount(1)
  expect(requested).toBe(false)
})

test('with a stale cache present and the request failing, the cached entries render under a fetch-date notice', async ({ page }) => {
  await seedCache(page, {
    fetchedAt: '2020-01-01T00:00:00.000Z',
    releases: [release()],
  })
  await abortReleases(page)

  await openChangelog(page)
  await expect(entries(page)).toHaveCount(1)
  await expect(page.getByRole('status')).toContainText('could not be reached')
})

test('with no cache and the request failing, one error state renders with a working GitHub link', async ({ page }) => {
  await abortReleases(page)
  await openChangelog(page)

  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('link', { name: /Open releases on GitHub/ })).toHaveAttribute(
    'href',
    'https://github.com/NotVadusha/Jobber.it/releases',
  )
})

test('an empty array renders the honest empty state, not an error', async ({ page }) => {
  await fulfilReleases(page, [])
  await openChangelog(page)

  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByText('No releases published yet')).toBeVisible()
  await expect(page.getByRole('link', { name: /Open releases on GitHub/ })).toBeVisible()
})

test('a malformed cached value is discarded and the page fetches instead of erroring', async ({ page }) => {
  await seedCache(page, 'not json')
  await fulfilReleases(page, [release()])

  await openChangelog(page)
  await expect(entries(page)).toHaveCount(1)
})
