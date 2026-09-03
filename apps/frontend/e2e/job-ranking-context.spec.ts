import { expect, test } from '@playwright/test'
import type { Page, Route } from '@playwright/test'

import {
  completedStream,
  encodeStream,
  posting,
  type WireStreamEvent,
} from './fixtures/best-match-stream'

// Wire-fixture coverage for Plan 8 (docs/plans/08-job-details-and-saved-jobs.md
// §16.5, cases 25-31). A scored, evidenced snapshot cannot be produced without
// live provider credentials, so this file replays Plan 7's typed wire fixture
// through page.route and asserts only the presence, contents, and absence of
// the ranking panel. Detail-page content, saved behavior, and availability
// states belong to the real-path specifications. See §16.4.

const RANKED_ID = 'greenhouse:1'
const FIXTURE_TERMS = ['python']
const FIXTURE_SECTIONS = 'requirements, responsibilities'

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

const detailWire = {
  data: {
    id: RANKED_ID,
    source: 'greenhouse',
    url: 'https://example.com/jobs/1',
    title: 'Senior Platform Engineer 1',
    company: 'Acme',
    posted_at: '2026-08-30T09:00:00Z',
    first_seen_at: '2026-08-30T09:12:00Z',
    last_seen_at: '2026-09-02T06:00:00Z',
    delisted_at: null,
    seniority: 'senior',
    years_required: 5,
    remote_policy: 'remote',
    location: 'Berlin',
    salary_min: 95000,
    salary_max: 130000,
    stack: ['Python', 'Kubernetes'],
    description: 'Stored description text.',
    requirements: null,
    responsibilities: null,
  },
  meta: { request_id: 'req-detail' },
}

function panel(page: Page) {
  return page.getByRole('region', { name: 'Why this ranked' })
}

async function installWire(page: Page, events: readonly WireStreamEvent[]): Promise<void> {
  await page.route('**/api/meta', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', json: metaWire })
  })
  await page.route('**/api/postings/greenhouse%3A1', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', json: detailWire })
  })
  await page.route('**/api/search/stream', async (route: Route) => {
    await route.fulfill({ contentType: 'text/event-stream', body: encodeStream(events) })
  })
}

async function openRankedResults(page: Page): Promise<void> {
  await page.goto('/#/jobs?q=python+platform&view=best')
  await expect(page.locator('li[aria-labelledby^="best-match-"]').first()).toBeVisible()
}

async function openRankedJob(page: Page): Promise<void> {
  await openRankedResults(page)
  await page.getByRole('link', { name: 'Senior Platform Engineer 1' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Senior Platform Engineer 1')
}

test('a Best-match departure renders the delivered rank, percent, hits, and sections', async ({ page }) => {
  await installWire(page, completedStream([posting(1, 0.87), posting(2, 0.5)]))
  await openRankedJob(page)

  await expect(panel(page)).toBeVisible()
  await expect(panel(page)).toContainText('Rank 1')
  await expect(panel(page)).toContainText('87% match')

  await panel(page).locator('summary').click()
  await expect(panel(page)).toContainText('python (stack, requirements)')
  await expect(panel(page)).toContainText(FIXTURE_SECTIONS)
})

test('the panel renders the delivered literal terms and no others', async ({ page }) => {
  await installWire(page, completedStream([posting(1, 0.87)]))
  await openRankedJob(page)

  await panel(page).locator('summary').click()
  const rendered = await panel(page)
    .locator('details dl > div')
    .filter({ hasText: 'Literal matches' })
    .locator('dd')
    .allInnerTexts()
  const terms = rendered.map((line) => line.replace(/\s*\(.*\)$/, '').trim()).filter(Boolean)
  expect(new Set(terms)).toEqual(new Set(FIXTURE_TERMS))
})

test('the uncalibrated-score sentence is present and links nowhere', async ({ page }) => {
  await installWire(page, completedStream([posting(1, 0.87)]))
  await openRankedJob(page)

  await expect(panel(page)).toContainText('not from a new ranking')
  await expect(panel(page)).toContainText('not a probability, a prediction, or a guarantee')
  await expect(panel(page).getByRole('link')).toHaveCount(0)
})

test('reloading the job page removes the panel while the rest of the page still renders', async ({ page }) => {
  await installWire(page, completedStream([posting(1, 0.87)]))
  await openRankedJob(page)
  await expect(panel(page)).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Senior Platform Engineer 1')
  await expect(page.getByRole('heading', { name: 'Description' })).toBeVisible()
  await expect(panel(page)).toHaveCount(0)
})

test('opening the same posting from All postings in the same session renders no panel', async ({ page }) => {
  await installWire(page, completedStream([posting(1, 0.87)]))
  await openRankedResults(page)

  await page.goto(`/#/job/${encodeURIComponent(RANKED_ID)}`)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Senior Platform Engineer 1')
  await expect(panel(page)).toHaveCount(0)
})

test('a delivered result with empty evidence renders rank and percent but no evidence list', async ({ page }) => {
  const bare = { ...posting(1, 0.87), evidence: { literal_hits: [], retrieved_sections: [] } }
  await installWire(page, completedStream([bare]))
  await openRankedJob(page)

  await expect(panel(page)).toContainText('Rank 1')
  await expect(panel(page)).toContainText('87% match')
  await expect(panel(page).locator('details')).toHaveCount(0)
  await expect(panel(page)).not.toContainText('Literal matches')
})

test('going back to the results and forward into the same job restores the panel', async ({ page }) => {
  await installWire(page, completedStream([posting(1, 0.87)]))
  await openRankedJob(page)
  await expect(panel(page)).toBeVisible()

  await page.goBack()
  await expect(page.locator('li[aria-labelledby^="best-match-"]').first()).toBeVisible()

  await page.goForward()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Senior Platform Engineer 1')
  await expect(panel(page)).toBeVisible()
  await expect(panel(page)).toContainText('Rank 1')
})
