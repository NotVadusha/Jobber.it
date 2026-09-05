import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const DETAIL_ID = 'jobico:e2e-13'
const SPARSE_ID = 'linkedin:e2e-14'
const HOSTILE_ID = 'greenhouse:e2e-15'
const DELISTED_ID = 'ashby:e2e-44'
const REMOVED_ID = 'greenhouse:e2e-removed'

const jobHash = (postingId: string): string => {
  return `#/job/${encodeURIComponent(postingId)}`
}

const waitForCatalogue = async (page: Page): Promise<void> => {
  await page.waitForResponse((response) =>
    response.url().endsWith('/api/postings/query') &&
    response.request().method() === 'POST' &&
    response.status() === 200,
  )
}

const openBrowse = async (page: Page, query: string): Promise<void> => {
  await page.goto(`/#/jobs?view=all&q=${encodeURIComponent(query)}`)
  const results = page.getByRole('list', { name: 'All postings results' })
  await expect(results).toBeVisible()
  await expect(results.locator(':scope > li').first()).toBeVisible()
}

const openJob = async (page: Page, postingId: string): Promise<void> => {
  await page.goto(`/${jobHash(postingId)}`)
}

test('a browse result title is a canonical job anchor and a plain click opens the detail page', async ({ page }) => {
  await openBrowse(page, 'DetailBeacon')

  const title = page.getByRole('link', { name: /DetailBeacon Platform Engineer/ })
  await expect(title).toHaveAttribute('href', jobHash(DETAIL_ID))

  await title.click()
  await expect(page).toHaveURL(`/${jobHash(DETAIL_ID)}`)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('DetailBeacon Platform Engineer')
})

test('the detail page renders the stored sections verbatim and generates no bullet points', async ({ page }) => {
  await openJob(page, DETAIL_ID)

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('DetailBeacon Platform Engineer')
  await expect(page.getByText('Fixture Company 13')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Requirements' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Responsibilities' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Description' })).toBeVisible()
  await expect(page.getByText('DetailRequirementBeacon five years')).toBeVisible()
  await expect(page.getByText('DetailResponsibilityBeacon owns the pipeline')).toBeVisible()
  await expect(page.getByText('DetailBeacon owns the deployment pipeline.')).toBeVisible()

  const body = await page.locator('main').innerText()
  expect(body).not.toContain('•')
  expect(body).not.toContain('◦')
  expect(body).toContain('Second stored line.')
})

test('a posting with no stored requirements renders neither the heading nor a stand-in sentence', async ({ page }) => {
  await openJob(page, SPARSE_ID)

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('SparseBeacon Engineer')
  await expect(page.getByRole('heading', { name: 'Requirements' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Responsibilities' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Description' })).toBeVisible()
  await expect(page.getByText(/none listed/i)).toHaveCount(0)
  await expect(page.getByText(/not (provided|listed) by the employer/i)).toHaveCount(0)
})

test('stored text with a script tag, a long token, and dash line starts stays inert text', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openJob(page, HOSTILE_ID)

  await expect(page.getByText('<script>alert(1)</script>', { exact: false })).toBeVisible()
  await expect(page.locator('main script')).toHaveCount(0)
  await expect(page.getByText('- literal dash line start')).toBeVisible()

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
})

test('the external action carries the stored URL, a new tab target, and the full rel', async ({ page }) => {
  await openJob(page, DETAIL_ID)

  const external = page.getByRole('link', { name: /Open original posting on/ })
  await expect(external).toHaveAttribute('href', 'https://example.test/jobs/13')
  await expect(external).toHaveAttribute('target', '_blank')
  const rel = await external.getAttribute('rel')
  expect(rel).toContain('noopener')
  expect(rel).toContain('noreferrer')
  expect(rel).toContain('nofollow')
})

test('a delisted posting is marked, dated, readable, and carries no external anchor', async ({ page }) => {
  await openJob(page, DELISTED_ID)

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('DelistedBeacon Engineer')
  const banner = page.getByRole('status').filter({ hasText: 'No longer listed' })
  await expect(banner).toContainText('stopped listing this posting')
  await expect(banner.locator('time')).toHaveCount(1)
  await expect(page.getByText('The original posting is no longer available at the source.')).toBeVisible()
  await expect(page.getByRole('link', { name: /Open original posting on/ })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Description' })).toBeVisible()
})

test('an identifier absent from the catalogue renders the removed state and leaves the URL alone', async ({ page }) => {
  const notFound = page.waitForResponse((response) =>
    response.url().includes('/api/postings/') && response.status() === 404,
  )
  await openJob(page, REMOVED_ID)
  await notFound

  await expect(page.getByText('This posting is not in the catalogue')).toBeVisible()
  await expect(page).toHaveURL(`/${jobHash(REMOVED_ID)}`)

  const catalogue = waitForCatalogue(page)
  await page.getByRole('button', { name: 'Browse all postings' }).click()
  await catalogue
  await expect(page).toHaveURL(/#\/jobs$/)
})

test('returning by the breadcrumb restores the page, its results, and its scroll position', async ({ page }) => {
  const catalogue = waitForCatalogue(page)
  await page.goto('/#/jobs?page=2')
  await catalogue
  await expect(page.getByRole('list', { name: 'All postings results' })).toBeVisible()

  await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'auto' }))
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(400)
  const scrolled = await page.evaluate(() => window.scrollY)

  await page.getByRole('list', { name: 'All postings results' }).getByRole('link').first().click()
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toBeVisible()

  await page.getByRole('link', { name: 'Jobs' }).click()
  await expect(page).toHaveURL(/#\/jobs\?page=2$/)
  await expect(page.getByRole('list', { name: 'All postings results' })).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(scrolled - 120)
})

test('the browser Back button restores exactly what the breadcrumb restores', async ({ page }) => {
  const catalogue = waitForCatalogue(page)
  await page.goto('/#/jobs?page=2')
  await catalogue

  await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'auto' }))
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(400)
  const scrolled = await page.evaluate(() => window.scrollY)

  await page.getByRole('list', { name: 'All postings results' }).getByRole('link').first().click()
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toBeVisible()

  await page.goBack()
  await expect(page).toHaveURL(/#\/jobs\?page=2$/)
  await expect(page.getByRole('list', { name: 'All postings results' })).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(scrolled - 120)
})

test('a direct open starts at the top with the Jobs crumb pointing at the default jobs route', async ({ page }) => {
  await openJob(page, DETAIL_ID)

  await expect(page.getByRole('link', { name: 'Jobs' })).toHaveAttribute('href', '#/jobs')
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
})

test('a modified click opens a canonical job URL in a new context with no ranking panel', async ({ page, context }) => {
  await openBrowse(page, 'DetailBeacon')

  const opened = context.waitForEvent('page')
  await page.getByRole('link', { name: /DetailBeacon Platform Engineer/ }).click({
    modifiers: ['ControlOrMeta'],
  })
  const newTab = await opened
  // waitForLoadState can resolve on the tab's about:blank, before the click's
  // navigation starts; wait for the URL the click is being asserted on.
  await newTab.waitForURL((url) => url.href.includes(jobHash(DETAIL_ID)))

  expect(newTab.url()).toContain(jobHash(DETAIL_ID))
  await expect(newTab.getByRole('heading', { level: 1 })).toHaveText('DetailBeacon Platform Engineer')
  await expect(newTab.getByText('Why this ranked')).toHaveCount(0)
  await newTab.close()
})

test('Copy link copies the absolute canonical job URL and reports it once', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await openJob(page, DETAIL_ID)

  await page.getByRole('button', { name: 'Copy link' }).click()
  await expect(page.getByText('Link copied')).toBeVisible()

  const copied = await page.evaluate(() => window.navigator.clipboard.readText())
  expect(copied).toBe(`http://127.0.0.1:5174/${jobHash(DETAIL_ID)}`)
  await expect(page.getByLabel('Copy this link manually')).toHaveCount(0)
})

test('a rejecting clipboard shows no toast and reveals the selectable URL instead', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error('denied')) },
    })
  })
  await openJob(page, DETAIL_ID)

  await page.getByRole('button', { name: 'Copy link' }).click()

  const manual = page.getByLabel('Copy this link manually')
  await expect(manual).toBeVisible()
  await expect(manual).toHaveValue(`http://127.0.0.1:5174/${jobHash(DETAIL_ID)}`)
  await expect(page.getByText('Link copied')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Copy link' })).toBeFocused()
})

test('the detail response is uncacheable and the request carries no query or profile text', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/api/')) {
      requests.push(`${request.url()} ${request.postData() ?? ''}`)
    }
  })

  const detail = page.waitForResponse((response) =>
    response.url().includes(encodeURIComponent(DETAIL_ID)) && response.status() === 200,
  )
  await openJob(page, DETAIL_ID)
  const response = await detail

  expect(response.headers()['cache-control']).toBe('no-store')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  for (const entry of requests) {
    expect(entry).not.toContain('profile_text')
    expect(entry).not.toMatch(/[?&]q=/)
  }
})
