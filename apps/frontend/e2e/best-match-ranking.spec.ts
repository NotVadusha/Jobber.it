import { expect, test } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'

const LIMITED_SEARCH = 'http://127.0.0.1:3101/api/search'
const QUERY_BEACON = 'zzqueryleakbeacon'

test.describe.configure({ mode: 'serial' })

function postSearch(request: APIRequestContext, url: string, data: unknown) {
  return request.post(url, {
    data,
    headers: { 'content-type': 'application/json' },
  })
}

test('rejects a search with neither query nor profile', async ({ request }) => {
  const response = await postSearch(request, '/api/search', {
    query: '',
    profile_text: '',
  })

  expect(response.status()).toBe(400)
  expect(response.headers()['x-request-id']).toBeTruthy()

  const body = await response.json()
  expect(body.error.code).toBe('EMPTY_SEARCH')
  expect(body.meta.request_id).toBeTruthy()
  expect(body).not.toHaveProperty('data')
})

test('rejects filter combinations and fields the contract forbids', async ({ request }) => {
  const undisclosed = await postSearch(request, '/api/search', {
    query: 'platform engineer',
    filters: { include_undisclosed_salary: true },
  })
  expect(undisclosed.status()).toBe(422)
  expect((await undisclosed.json()).error.code).toBe('VALIDATION_ERROR')

  const experience = await postSearch(request, '/api/search', {
    query: 'platform engineer',
    filters: { experience_years: 99 },
  })
  expect(experience.status()).toBe(422)

  const extra = await postSearch(request, '/api/search', {
    query: 'platform engineer',
    page: 2,
  })
  expect(extra.status()).toBe(422)
})

test('reports a real provider failure without echoing the query', async ({ request }) => {
  const response = await postSearch(request, '/api/search', { query: QUERY_BEACON })

  expect(response.status()).toBe(502)

  const raw = await response.text()
  expect(raw).not.toContain(QUERY_BEACON)

  const body = await response.json()
  expect(body.error.code).toBe('SEARCH_UNAVAILABLE')
  expect(body.error.message).toBe('Best-match search is temporarily unavailable.')
  expect(body.error.details).toBeNull()
  expect(body.meta.request_id).toBeTruthy()
})

test('limits semantic search per client while All postings stays open', async ({ request }) => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const allowed = await postSearch(request, LIMITED_SEARCH, {
      query: '',
      profile_text: '',
    })
    expect(allowed.status()).toBe(400)
  }

  const limited = await postSearch(request, LIMITED_SEARCH, {
    query: '',
    profile_text: '',
  })

  expect(limited.status()).toBe(429)
  expect(limited.headers()['x-request-id']).toBeTruthy()
  expect(Number(limited.headers()['retry-after'])).toBeGreaterThan(0)

  const body = await limited.json()
  expect(body.error.code).toBe('RATE_LIMITED')
  expect(body.error.details.retry_after_seconds).toBeGreaterThan(0)
  expect(body.error.message).toMatch(/browse all postings/)

  const catalogue = await request.post('/api/postings/query', { data: { query: '' } })
  expect(catalogue.status()).toBe(200)
})
