import { fileURLToPath } from 'node:url'

import { expect, test } from '@playwright/test'

const PDF_FIXTURE = fileURLToPath(new URL('./fixtures/profile.pdf', import.meta.url))

const metaWire = {
  data: {
    corpus_size: 321,
    sources: ['greenhouse', 'djinni'],
    source_counts: [
      { source: 'greenhouse', count: 201 },
      { source: 'djinni', count: 120 },
    ],
    retrieval: 'hybrid+rerank',
  },
  meta: { request_id: 'req-meta' },
}

const searchWire = {
  data: {
    query: 'postgres',
    terms: ['postgres'],
    results: [],
    filters_applied: [],
    corpus_size: 321,
    trace: [],
  },
  meta: { request_id: 'req-search', took_ms: 12.5 },
}

const resultWire = {
  data: {
    query: 'postgres',
    terms: ['postgres'],
    results: [
      {
        id: 'greenhouse:123',
        source: 'greenhouse',
        url: 'https://example.com/jobs/123',
        title: 'Senior Backend Engineer',
        company: 'Example',
        posted_at: '2026-09-01T08:00:00Z',
        first_seen_at: null,
        seniority: 'senior',
        years_required: 5,
        remote_policy: 'remote',
        location: 'Europe',
        salary_min: 90000,
        salary_max: 120000,
        stack: ['PostgreSQL', 'Python'],
        score: 0.82,
        evidence: null,
      },
    ],
    filters_applied: [
      { field: 'remote_policy', label: 'remote', note: null },
    ],
    corpus_size: 321,
    trace: [
      { node: 'retrieve', status: 'ran', detail: 'hybrid top 20', count: 20 },
      { node: 'rerank', status: 'ran', detail: 'bge-reranker-v2-m3', count: 1 },
    ],
  },
  meta: { request_id: 'req-result', took_ms: 42.5 },
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

test('submits query profile and filters as separate wire fields', async ({ page }) => {
  let body: unknown
  await page.route('**/api/search', async (route) => {
    body = route.request().postDataJSON()
    await route.fulfill({ status: 200, contentType: 'application/json', json: searchWire })
  })
  await page.goto('/')
  await page.getByRole('textbox', { name: 'Search postings' }).fill('postgres')
  await page.getByRole('button', { name: 'Best matches' }).click()

  await expect(page.getByText('Nothing cleared the filters.')).toBeVisible()
  expect(body).toMatchObject({
    query: 'postgres',
    profile_text: '',
    filters: { remote_policy: [], seniority: [], source: [] },
  })
})

test('renders results, highlighted stack hits and the retrieval trace', async ({ page }) => {
  await page.route('**/api/search', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', json: resultWire })
  })
  await page.goto('/')
  await page.getByRole('textbox', { name: 'Search postings' }).fill('postgres')
  await page.getByRole('button', { name: 'Best matches' }).click()

  const result = page.getByRole('listitem').filter({ hasText: 'Senior Backend Engineer' })
  await expect(result).toBeVisible()
  await expect(result).toContainText('Europe')
  await expect(result).toContainText('$90k–$120k')
  await expect(result).toContainText('Sep 2026')

  const trace = page.getByLabel('Retrieval trace')
  await expect(trace).toContainText('1 of 321 · 42.5 ms')
  await expect(trace).toContainText('remote policy = remote')
})

test('renders a safe structured error and its request reference', async ({ page }) => {
  await page.route('**/api/search', async (route) => {
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
  await page.getByRole('button', { name: 'Best matches' }).click()
  await expect(page.getByRole('alert')).toContainText('temporarily unavailable')
  await expect(page.getByRole('alert')).toContainText('req-error')
})

test('survives a malformed error payload without crashing', async ({ page }) => {
  const crashes: string[] = []
  page.on('pageerror', (error) => crashes.push(error.message))

  await page.route('**/api/search', async (route) => {
    await route.fulfill({
      status: 500,
      headers: { 'X-Request-ID': 'req-malformed' },
      contentType: 'application/json',
      json: { detail: 'a legacy shape no caller should branch on' },
    })
  })
  await page.goto('/')
  await page.getByRole('textbox', { name: 'Search postings' }).fill('postgres')
  await page.getByRole('button', { name: 'Best matches' }).click()

  await expect(page.getByRole('alert')).toContainText('unreadable error')
  await expect(page.getByRole('alert')).toContainText('req-malformed')
  await expect(page.getByRole('alert')).not.toContainText('legacy shape')
  expect(crashes).toEqual([])
})

test('replacing an in-flight search raises no unhandled browser error', async ({ page }) => {
  const crashes: string[] = []
  page.on('pageerror', (error) => crashes.push(error.message))

  let served = 0
  await page.route('**/api/search', async (route) => {
    served += 1
    if (served === 1) await new Promise((resolve) => setTimeout(resolve, 1500))
    await route.fulfill({ status: 200, contentType: 'application/json', json: resultWire })
  })

  await page.goto('/')
  const input = page.getByRole('textbox', { name: 'Search postings' })
  await input.fill('postgres')
  await page.getByRole('button', { name: 'Best matches' }).click()
  await input.fill('kafka')
  await page.getByRole('button', { name: 'Best matches' }).click()

  await expect(page.getByRole('listitem').filter({ hasText: 'Senior Backend Engineer' }))
    .toBeVisible()
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
  await page.route('**/api/search', async (route) => {
    body = route.request().postDataJSON()
    await route.fulfill({ status: 200, contentType: 'application/json', json: searchWire })
  })

  await page.goto('/')
  await page.getByLabel(/Attach a CV/).setInputFiles(PDF_FIXTURE)
  await expect(page.getByText('profile.pdf')).toBeVisible()

  await page.getByRole('button', { name: 'Best matches' }).click()
  await expect(page.getByText('Nothing cleared the filters.')).toBeVisible()
  expect(body?.profile_text).toContain('PostgreSQL and Python experience')
})

test('never submits an empty search', async ({ page }) => {
  let requested = false
  await page.route('**/api/search', async (route) => {
    requested = true
    await route.fulfill({ status: 200, contentType: 'application/json', json: searchWire })
  })

  await page.goto('/')
  const submit = page.getByRole('button', { name: 'Best matches' })
  await expect(submit).toBeDisabled()

  await page.getByRole('textbox', { name: 'Search postings' }).fill('   ')
  await expect(submit).toBeDisabled()

  await page.getByRole('textbox', { name: 'Search postings' }).fill('postgres')
  await expect(submit).toBeEnabled()
  expect(requested).toBe(false)
})
