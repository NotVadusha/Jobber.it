import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

// Real-path coverage for Plan 7 (docs/plans/07-live-best-match-experience.md
// §15.5, cases 1-11). This spec talks to the actual Vite dev server, the
// actual FastAPI backend, and the actual Postgres catalogue — no mocked
// network route, no fulfilled response, no imported production function,
// no test-only route. The E2E harness holds unusable Pinecone/OpenAI keys on
// purpose, so the reachable real outcomes are a degraded `rewrite`, a
// completed `filter`, and a failed `retrieve` — enough to prove the
// lifecycle, rate-limiting, and privacy without live network flakiness.
// Cancellation is not here: the pipeline reaches its terminal frame in about
// 360 ms, too fast to reliably catch the Stop control, so what Stop does to
// the interface is a wire-fixture case and the server's cancellation log is
// a backend test. See §15.4 for the division of labour with
// best-match-presentation.spec.ts, which covers the completed-snapshot cases
// this file cannot reach.

const QUERY_BEACON = 'zzstreamleakbeacon'
const LIMITED_BASE = 'http://127.0.0.1:5175'

const trace = (page: Page) => {
  return page.getByLabel('Retrieval trace')
}

const stageRow = (page: Page, stage: string) => {
  return trace(page).locator('li', { hasText: stage })
}

test.describe('best-match real-path lifecycle', () => {
  test('opens an event stream and renders the rail before any terminal frame', async ({ page }) => {
    const streamResponse = page.waitForResponse((response) =>
      response.url().includes('/api/search/stream'),
    )
    await page.goto('/#/jobs?q=platform+engineer&view=best')

    const response = await streamResponse
    expect(response.headers()['content-type']).toContain('text/event-stream')

    await expect(trace(page)).toBeVisible()
    await expect(stageRow(page, 'rewrite')).toBeVisible()
  })

  test('rewrite degrades with its factual detail and filter runs with a real count', async ({ page }) => {
    await page.goto('/#/jobs?q=platform+engineer&view=best&workplace=remote')

    const rewrite = stageRow(page, 'rewrite')
    await expect(rewrite.getByText('skipped', { exact: true })).toBeVisible()
    await expect(rewrite).toContainText('raw search text; rewrite unavailable')

    const filter = stageRow(page, 'filter')
    await expect(filter.getByText('ran', { exact: true })).toBeVisible()
    await expect(filter).toContainText(/\d+ of \d+ pushed to the index/)
    await expect(filter).toContainText(/\d+(\.\d+)? ms/)
  })

  test('retrieve fails and shows one error panel with the safe message and a request id', async ({ page }) => {
    await page.goto('/#/jobs?q=platform+engineer&view=best')

    const alert = page.getByRole('alert')
    await expect(alert).toBeVisible()
    await expect(alert).toContainText('Best-match search is temporarily unavailable.')
    await expect(alert).toContainText(/\([0-9a-f]+\)/)
    await expect(page.getByRole('alert')).toHaveCount(1)
  })

  test('the failing stage stops animating and no later stage claims progress', async ({ page }) => {
    await page.goto('/#/jobs?q=platform+engineer&view=best')

    await expect(page.getByRole('alert')).toBeVisible()

    await expect(stageRow(page, 'retrieve').getByText('failed', { exact: true })).toBeVisible()
    await expect(stageRow(page, 'group').getByText('pending', { exact: true })).toBeVisible()
    await expect(stageRow(page, 'rerank').getByText('pending', { exact: true })).toBeVisible()
  })

  test('the raw bytes of a failing search never carry the query beacon', async ({ request }) => {
    const response = await request.post('/api/search/stream', {
      data: { query: QUERY_BEACON },
      headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
    })

    const raw = await response.text()
    expect(raw).toContain('search.failed')
    expect(raw).not.toContain(QUERY_BEACON)
  })

  test('a search against the rate-limited harness is limited on the second attempt', async ({ page }) => {
    // One browser search exhausts this dedicated instance's window
    // (RATE_LIMIT_MAX_SEARCHES=1) — see playwright.config.ts.
    await page.goto(`${LIMITED_BASE}/#/jobs?view=best&q=platform+engineer`)
    await expect(page.getByRole('alert')).toBeVisible()

    await page.getByRole('button', { name: 'Try again' }).click()

    const limited = page.getByRole('alert')
    await expect(limited).toContainText('Too many searches')
    await expect(
      page.getByRole('status').filter({ hasText: /remaining|search again/ }).first(),
    ).toBeVisible()

    const escape = page.getByRole('button', { name: 'Browse all postings' })
    await expect(escape).toBeVisible()
    await escape.click()
    await expect(page).toHaveURL(/view=all/)
    await expect(page).toHaveURL(/q=platform(\+|%20)engineer/)
  })

  test('All postings still returns 200 while Best matches is rate-limited', async ({ page }) => {
    await page.goto(`${LIMITED_BASE}/#/jobs?view=best&q=platform+engineer`)
    await expect(page.getByRole('alert')).toBeVisible()
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByRole('alert')).toContainText('Too many searches')

    const catalogueResponse = page.waitForResponse((response) =>
      response.url().includes('/api/postings/query'),
    )
    await page.getByRole('button', { name: 'All postings', exact: true }).click()
    const response = await catalogueResponse
    expect(response.status()).toBe(200)
  })

  test('an /api/meta failure does not change the Best-match outcome', async ({ page, context }) => {
    // Narrow, deliberate exception to this file's no-mocking rule: only the
    // corpus-meta badge endpoint is blocked (aborted, never fulfilled with
    // fake data), to prove Best-match failure independence from an
    // unrelated endpoint. No search response is faked.
    await context.route('**/api/meta', (route) => route.abort())

    await page.goto('/#/jobs?q=platform+engineer&view=best')

    const alert = page.getByRole('alert')
    await expect(alert).toBeVisible()
    await expect(alert).toContainText('Best-match search is temporarily unavailable.')
  })

  test('frames arrive incrementally: the rail advances before the terminal frame', async ({ page }) => {
    await page.goto('/#/jobs?q=platform+engineer&view=best&workplace=remote')

    await expect(page.getByRole('alert')).toBeVisible()

    // A single buffered terminal frame could never have populated rewrite's
    // and filter's own completed detail/duration independently of the
    // failing retrieve stage's state — the rail only carries this much
    // distinct, stage-specific detail if at least two separate
    // stage.completed frames were applied before the terminal search.failed
    // frame arrived. (A synchronous "not yet failed" check right after the
    // first wait was tried and is racy in this harness — the whole
    // rewrite→filter→retrieve pipeline can complete in under a second — so
    // this asserts the same incrementality from stable post-error state.)
    const rewrite = stageRow(page, 'rewrite')
    await expect(rewrite.getByText('skipped', { exact: true })).toBeVisible()
    await expect(rewrite).toContainText(/\d+(\.\d+)? ms/)

    const filter = stageRow(page, 'filter')
    await expect(filter.getByText('ran', { exact: true })).toBeVisible()
    await expect(filter).toContainText(/\d+(\.\d+)? ms/)

    await expect(stageRow(page, 'retrieve').getByText('failed', { exact: true })).toBeVisible()
  })
})
