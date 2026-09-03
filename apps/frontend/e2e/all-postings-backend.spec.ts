import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

type JsonObject = Record<string, unknown>

const emptyFilters = {
  remote_policy: [],
  seniority: [],
  source: [],
  experience_years: null,
  min_salary: null,
  include_undisclosed_salary: false,
  posted_within: null,
}

function catalogueRequest(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    query: '',
    filters: emptyFilters,
    sort: 'newest',
    page: 1,
    ...overrides,
  }
}

function asObject(value: unknown): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Expected a JSON object')
  }
  return value as JsonObject
}

function dataRows(body: unknown): JsonObject[] {
  const data = asObject(body).data
  if (!Array.isArray(data)) throw new Error('Expected data to be an array')
  return data.map(asObject)
}

function pagination(body: unknown): JsonObject {
  const meta = asObject(asObject(body).meta)
  return asObject(meta.pagination)
}

async function postCatalogue(page: Page, payload: unknown) {
  return page.evaluate(async (body) => {
    const response = await fetch('/api/postings/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const responseBody: unknown = await response.json()
    return {
      status: response.status,
      requestId: response.headers.get('x-request-id'),
      cacheControl: response.headers.get('cache-control'),
      body: responseBody,
    }
  }, payload)
}

async function loadApp(page: Page) {
  await page.goto('/')
  await expect(page.locator('body')).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await loadApp(page)
})

test('returns the exhaustive first page with stable newest metadata', async ({ page }) => {
  const result = await postCatalogue(page, catalogueRequest())
  const rows = dataRows(result.body)
  const pageMeta = pagination(result.body)

  expect(result.status).toBe(200)
  expect(result.requestId).toBeTruthy()
  expect(result.cacheControl).toContain('no-store')
  expect(rows).toHaveLength(20)
  expect(rows[0].id).toBe('lever:e2e-45')
  expect(rows[0].posted_at).toBeNull()
  expect(rows[0].first_seen_at).toBeTruthy()
  expect(pageMeta).toMatchObject({
    page: 1,
    page_size: 20,
    total_items: 44,
    total_pages: 3,
  })
})

test('pages without duplicates and preserves totals past the last page', async ({ page }) => {
  const first = await postCatalogue(page, catalogueRequest())
  const second = await postCatalogue(page, catalogueRequest({ page: 2 }))
  const beyond = await postCatalogue(page, catalogueRequest({ page: 99 }))

  const firstIds = new Set(dataRows(first.body).map((row) => row.id))
  const secondIds = dataRows(second.body).map((row) => row.id)

  expect(secondIds).toHaveLength(20)
  expect(secondIds.every((id) => !firstIds.has(id))).toBe(true)
  expect(pagination(second.body)).toMatchObject({
    page: 2,
    page_size: 20,
    total_items: 44,
    total_pages: 3,
  })
  expect(dataRows(beyond.body)).toEqual([])
  expect(pagination(beyond.body)).toMatchObject({
    page: 99,
    page_size: 20,
    total_items: 44,
    total_pages: 3,
  })
})

test('sorts by disclosed minimum salary with null minimums last', async ({ page }) => {
  const pages = await Promise.all([1, 2, 3].map((pageNumber) =>
    postCatalogue(page, catalogueRequest({ sort: 'salary', page: pageNumber })),
  ))
  const rows = pages.flatMap((result) => dataRows(result.body))

  expect(rows).toHaveLength(44)
  expect(rows[0].id).toBe('greenhouse:e2e-43')
  expect(rows[0].salary_min).toBe(300000)
  expect(rows.slice(-2).map((row) => row.id)).toEqual([
    'dou:e2e-40',
    'jobico:e2e-41',
  ])
  expect(rows.slice(-2).every((row) => row.salary_min === null)).toBe(true)

  const tiedIds = rows
    .filter((row) => row.salary_min === 180000)
    .map((row) => row.id)
  expect(tiedIds).toEqual(['ashby:e2e-23', 'greenhouse:e2e-22'])
})

test('searches every approved text field and requires every query term', async ({ page }) => {
  const cases = [
    ['titlebeacon', 'greenhouse:e2e-01'],
    ['companybeacon', 'ashby:e2e-02'],
    ['stackbeacon', 'lever:e2e-03'],
    ['requirementbeacon', 'djinni:e2e-04'],
    ['responsibilitybeacon', 'dou:e2e-05'],
    ['descriptionbeacon', 'jobico:e2e-06'],
  ] as const

  for (const [query, expectedId] of cases) {
    const result = await postCatalogue(page, catalogueRequest({ query }))
    expect(dataRows(result.body).map((row) => row.id)).toEqual([expectedId])
  }

  const ukrainian = await postCatalogue(
    page,
    catalogueRequest({ query: 'розробник київ' }),
  )
  expect(dataRows(ukrainian.body).map((row) => row.id)).toEqual([
    'lever:e2e-10',
  ])

  const bothTerms = await postCatalogue(
    page,
    catalogueRequest({ query: 'sharedalpha sharedbeta' }),
  )
  const missingTerm = await postCatalogue(
    page,
    catalogueRequest({ query: 'sharedalpha absentbeacon' }),
  )

  expect(dataRows(bothTerms.body).map((row) => row.id)).toEqual([
    'greenhouse:e2e-01',
  ])
  expect(dataRows(missingTerm.body)).toEqual([])
})

test('keeps lexical search boolean and honors the selected sort', async ({ page }) => {
  const result = await postCatalogue(page, catalogueRequest({
    query: 'salarybeacon',
    sort: 'salary',
  }))

  expect(dataRows(result.body).map((row) => row.id)).toEqual([
    'greenhouse:e2e-43',
    'linkedin:e2e-42',
    'dou:e2e-40',
    'jobico:e2e-41',
  ])
})

test('uses OR inside groups and AND between filter groups', async ({ page }) => {
  const workplace = await postCatalogue(page, catalogueRequest({
    filters: {
      ...emptyFilters,
      remote_policy: ['remote', 'hybrid'],
    },
  }))
  const workplaceValues = new Set(
    dataRows(workplace.body).map((row) => row.remote_policy),
  )
  expect(workplaceValues).toEqual(new Set(['remote', 'hybrid']))

  const combined = await postCatalogue(page, catalogueRequest({
    filters: {
      ...emptyFilters,
      remote_policy: ['remote', 'hybrid'],
      seniority: ['senior', 'lead'],
      source: ['djinni', 'dou', 'linkedin'],
    },
  }))
  const rows = dataRows(combined.body)

  expect(rows.length).toBeGreaterThan(0)
  for (const row of rows) {
    expect(['remote', 'hybrid']).toContain(row.remote_policy)
    expect(['senior', 'lead']).toContain(row.seniority)
    expect(['djinni', 'dou', 'linkedin']).toContain(row.source)
  }
})

test('treats candidate experience as a maximum and keeps unknown requirements', async ({ page }) => {
  const result = await postCatalogue(page, catalogueRequest({
    query: 'experiencebeacon',
    filters: { ...emptyFilters, experience_years: 3 },
  }))

  expect(dataRows(result.body).map((row) => row.id)).toEqual([
    'linkedin:e2e-07',
    'greenhouse:e2e-08',
  ])
})

test('excludes undisclosed salary by default and includes it only on request', async ({ page }) => {
  const defaultResult = await postCatalogue(page, catalogueRequest({
    query: 'salarybeacon',
    filters: { ...emptyFilters, min_salary: 200000 },
  }))
  const includeResult = await postCatalogue(page, catalogueRequest({
    query: 'salarybeacon',
    filters: {
      ...emptyFilters,
      min_salary: 200000,
      include_undisclosed_salary: true,
    },
  }))

  expect(new Set(dataRows(defaultResult.body).map((row) => row.id))).toEqual(
    new Set(['jobico:e2e-41', 'greenhouse:e2e-43']),
  )
  expect(new Set(dataRows(includeResult.body).map((row) => row.id))).toEqual(
    new Set(['dou:e2e-40', 'jobico:e2e-41', 'greenhouse:e2e-43']),
  )
})

test('uses the effective date for posted-within and excludes delisted rows', async ({ page }) => {
  const recent = await postCatalogue(page, catalogueRequest({
    query: 'recentbeacon',
    filters: { ...emptyFilters, posted_within: '24h' },
  }))
  const delisted = await postCatalogue(page, catalogueRequest({
    query: 'delistedbeacon',
  }))
  const unnormalized = await postCatalogue(page, catalogueRequest({
    query: 'unnormalizedbeacon',
  }))
  const unindexed = await postCatalogue(page, catalogueRequest({
    query: 'unindexedbeacon',
  }))

  expect(dataRows(recent.body).map((row) => row.id)).toEqual([
    'greenhouse:e2e-01',
  ])
  expect(dataRows(delisted.body)).toEqual([])
  expect(dataRows(unnormalized.body).map((row) => row.id)).toEqual([
    'djinni:e2e-11',
  ])
  expect(dataRows(unindexed.body).map((row) => row.id)).toEqual([
    'dou:e2e-12',
  ])
})

test('reports source counts from the same live corpus', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const response = await fetch('/api/meta')
    const body: unknown = await response.json()
    return { status: response.status, body }
  })
  const data = asObject(asObject(result.body).data)
  const countsValue = data.source_counts

  if (!Array.isArray(countsValue)) {
    throw new Error('Expected source_counts to be an array')
  }
  const counts = countsValue.map(asObject)
  const total = counts.reduce((sum, item) => sum + Number(item.count), 0)

  expect(result.status).toBe(200)
  expect(data.corpus_size).toBe(44)
  expect(total).toBe(44)
  expect(counts.map((item) => item.source)).toEqual([
    'greenhouse',
    'ashby',
    'lever',
    'djinni',
    'dou',
    'jobico',
    'linkedin',
  ])
})

test('returns structured validation errors for every forbidden request shape', async ({ page }) => {
  const invalidBodies = [
    catalogueRequest({ query: 'x'.repeat(501) }),
    { ...catalogueRequest(), page_size: 50 },
    catalogueRequest({ sort: 'relevance' }),
    catalogueRequest({ page: 0 }),
    catalogueRequest({
      filters: {
        ...emptyFilters,
        include_undisclosed_salary: true,
      },
    }),
  ]

  for (const body of invalidBodies) {
    const result = await postCatalogue(page, body)
    const error = asObject(asObject(result.body).error)
    const meta = asObject(asObject(result.body).meta)

    expect(result.status).toBe(422)
    expect(result.cacheControl).toContain('no-store')
    expect(error.code).toBe('VALIDATION_ERROR')
    expect(error.message).toBe('The request contains invalid values.')
    expect(meta.request_id).toBeTruthy()
    expect(JSON.stringify(result.body).toLowerCase()).not.toContain('select ')
  }
})

test('trims before enforcing the 500-character limit and keeps wire keys snake case', async ({ page }) => {
  const result = await postCatalogue(page, catalogueRequest({
    query: `  ${'x'.repeat(500)}  `,
  }))
  const emptyResult = await postCatalogue(page, catalogueRequest())
  const firstRow = dataRows(emptyResult.body)[0]
  const pageMeta = pagination(emptyResult.body)

  expect(result.status).toBe(200)
  expect(firstRow).toHaveProperty('first_seen_at')
  expect(firstRow).not.toHaveProperty('firstSeenAt')
  expect(pageMeta).toHaveProperty('page_size', 20)
  expect(pageMeta).not.toHaveProperty('pageSize')
})
