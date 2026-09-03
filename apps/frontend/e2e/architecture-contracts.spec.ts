import { fileURLToPath } from 'node:url'

import { expect, test } from '@playwright/test'
import type { Page, Route } from '@playwright/test'

import { completedStream, encodeStream, posting } from './fixtures/best-match-stream'

const PDF_FIXTURE = fileURLToPath(new URL('./fixtures/profile.pdf', import.meta.url))

const metaWire = {
  data: {
    corpus_size: 321,
    sources: ['greenhouse', 'djinni'],
    source_counts: [
      { source: 'greenhouse', count: 200 },
      { source: 'djinni', count: 121 },
    ],
    retrieval: 'hybrid+rerank',
  },
  meta: { request_id: 'req-meta' },
}

function cards(page: Page) {
  return page.locator('li[aria-labelledby^="best-match-"]')
}

async function mockStream(page: Page, handler: (route: Route) => Promise<void>): Promise<void> {
  await page.route('**/api/search/stream', handler)
}

async function triggerBestMatch(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Best matches' }).click()
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/meta', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', json: metaWire })
  })
})

test('normalizes nested wire keys from the meta endpoint without error', async ({ page }) => {
  const metaRequest = page.waitForRequest('**/api/meta')
  await page.goto('/')
  await metaRequest
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('submits query, profile and filters as separate wire fields', async ({ page }) => {
  let body: unknown
  await mockStream(page, async (route) => {
    body = route.request().postDataJSON()
    await route.fulfill({
      contentType: 'text/event-stream',
      body: encodeStream(completedStream([])),
    })
  })

  await page.goto('/')
  await page.getByRole('textbox', { name: 'Search postings' }).fill('postgres')
  await triggerBestMatch(page)

  await expect(page.getByText('Nothing cleared your filters')).toBeVisible()
  expect(body).toMatchObject({
    query: 'postgres',
    profile_text: '',
    filters: { remote_policy: [], seniority: [], source: [] },
  })
})

test('renders a safe structured error and its request reference', async ({ page }) => {
  await mockStream(page, async (route) => {
    await route.fulfill({
      status: 502,
      headers: { 'X-Request-ID': 'req-error' },
      contentType: 'application/json',
      json: {
        error: {
          code: 'SEARCH_UNAVAILABLE',
          message: 'Best-match search is temporarily unavailable.',
          details: null,
        },
        meta: { request_id: 'req-error' },
      },
    })
  })

  await page.goto('/')
  await page.getByRole('textbox', { name: 'Search postings' }).fill('postgres')
  await triggerBestMatch(page)

  await expect(page.getByRole('alert')).toContainText('temporarily unavailable')
  await expect(page.getByRole('alert')).toContainText('req-error')
})

test('survives a malformed error payload without crashing', async ({ page }) => {
  const crashes: string[] = []
  page.on('pageerror', (error) => crashes.push(error.message))

  await mockStream(page, async (route) => {
    await route.fulfill({
      status: 500,
      headers: { 'X-Request-ID': 'req-malformed' },
      contentType: 'application/json',
      json: { detail: 'a legacy shape no caller should branch on' },
    })
  })

  await page.goto('/')
  await page.getByRole('textbox', { name: 'Search postings' }).fill('postgres')
  await triggerBestMatch(page)

  await expect(page.getByRole('alert')).toContainText('unreadable error')
  await expect(page.getByRole('alert')).toContainText('req-malformed')
  await expect(page.getByRole('alert')).not.toContainText('legacy shape')
  expect(crashes).toEqual([])
})

test('replacing an in-flight search raises no unhandled browser error', async ({ page }) => {
  const crashes: string[] = []
  page.on('pageerror', (error) => crashes.push(error.message))

  let served = 0
  await mockStream(page, async (route) => {
    served += 1
    if (served === 1) await new Promise((resolve) => setTimeout(resolve, 1500))
    await route.fulfill({
      contentType: 'text/event-stream',
      body: encodeStream(completedStream([posting(123, 0.82)])),
    })
  })

  await page.goto('/')
  const input = page.getByRole('textbox', { name: 'Search postings' })
  await input.fill('postgres')
  await triggerBestMatch(page)
  await input.fill('kafka')
  await triggerBestMatch(page)

  await expect(cards(page)).toHaveCount(1)
  expect(crashes).toEqual([])
})

test('enforces the 500 character query limit', async ({ page }) => {
  await page.goto('/')
  const input = page.getByRole('textbox', { name: 'Search postings' })
  await input.fill('x'.repeat(501))
  await expect(input).toHaveValue('x'.repeat(500))
})

test('attaches and removes a text CV through the visible form', async ({ page }) => {
  await page.goto('/')
  const file = page.getByLabel(/Attach a CV/)
  await file.setInputFiles({
    name: 'profile.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('PostgreSQL and Python experience'),
  })
  await expect(page.getByText('profile.txt')).toBeVisible()
  await page.getByRole('button', { name: 'Remove' }).click()
  await expect(page.getByText('profile.txt')).toBeHidden()
})

test('extracts text from an attached PDF and sends it as profile text', async ({ page }) => {
  let body: { profile_text?: string } | undefined
  await mockStream(page, async (route) => {
    body = route.request().postDataJSON()
    await route.fulfill({
      contentType: 'text/event-stream',
      body: encodeStream(completedStream([])),
    })
  })

  await page.goto('/')
  await page.getByLabel(/Attach a CV/).setInputFiles(PDF_FIXTURE)
  await expect(page.getByText('profile.pdf')).toBeVisible()

  await triggerBestMatch(page)
  await expect(page.getByText('Nothing cleared your filters')).toBeVisible()
  expect(body?.profile_text).toContain('PostgreSQL and Python experience')
})

test('the Best-matches submit stays disabled without a query or profile', async ({ page }) => {
  await mockStream(page, async (route) => {
    await route.fulfill({
      contentType: 'text/event-stream',
      body: encodeStream(completedStream([])),
    })
  })

  await page.goto('/#/jobs?q=postgres&view=best')
  const submit = page.getByRole('button', { name: /Find matches|Searching/ })
  await expect(submit).toBeEnabled()

  const input = page.getByRole('textbox', { name: 'Search postings' })
  await input.fill('')
  await expect(submit).toBeDisabled()

  await input.fill('postgres')
  await expect(submit).toBeEnabled()
})
