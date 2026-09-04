import { expect, test } from '@playwright/test'
import type { Page, Route } from '@playwright/test'

import {
  completedStream,
  encodeStream,
  posting,
  type WireStreamEvent,
} from './fixtures/best-match-stream'

// Wire-fixture coverage for Plan 7 (docs/plans/07-live-best-match-experience.md
// §15.5, cases 12-23). Every case installs exactly one
// page.route('**/api/search/stream', ...) handler that fulfils
// encodeStream(...) with contentType 'text/event-stream' — a completed
// snapshot with scored, evidenced results cannot be produced without live
// provider credentials, so this file replays a typed wire fixture instead.
// It asserts no frame timing, no proxy behavior, no server log, and no HTTP
// status the real-path specification (best-match-experience.spec.ts) already
// covers. See §15.4.

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

const cards = (page: Page) => {
  return page.locator('li[aria-labelledby^="best-match-"]')
}

const installStream = async (
  page: Page,
  handler: (route: Route, callIndex: number) => Promise<void>,
): Promise<void> => {
  let callIndex = 0
  await page.route('**/api/search/stream', async (route) => {
    callIndex += 1
    await handler(route, callIndex)
  })
}

const fulfilStream = async (route: Route, events: readonly WireStreamEvent[], extra = ''): Promise<void> => {
  await route.fulfill({ contentType: 'text/event-stream', body: encodeStream(events, extra) })
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/meta', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', json: metaWire })
  })
})

test('a completed snapshot renders ten cards; Show more names and reveals the rest', async ({ page }) => {
  const results = Array.from({ length: 24 }, (_, index) => posting(index + 1, 0.9 - index * 0.01))
  await installStream(page, (route) => fulfilStream(route, completedStream(results)))

  await page.goto('/#/jobs?q=python+platform&view=best')

  await expect(cards(page)).toHaveCount(10)
  const showMore = page.getByRole('button', { name: 'Show 10 more (14 remaining)' })
  await expect(showMore).toBeVisible()
  await showMore.click()
  await expect(cards(page)).toHaveCount(20)

  await page.getByRole('button', { name: 'Show 4 more (4 remaining)' }).click()
  await expect(cards(page)).toHaveCount(24)
})

test('Stop leaves a stopped state, its description, and a working rerun action', async ({ page }) => {
  // The first stream is never fulfilled, so the search stays in flight for as
  // long as the click needs; on the real path the pipeline can reach its
  // terminal frame first and leave no Stop button to press.
  await installStream(page, async (route, callIndex) => {
    if (callIndex === 1) return
    await fulfilStream(route, completedStream([posting(1, 0.9)]))
  })

  await page.goto('/#/jobs?q=python+platform&view=best')

  await page.getByRole('button', { name: 'Stop' }).click()

  const stopped = page.getByRole('region', { name: 'Search stopped' })
  await expect(stopped).toBeVisible()
  await expect(stopped).toContainText('stopped on this device before results arrived')

  const rerun = page.getByRole('button', { name: 'Run the search again' })
  await expect(rerun).toBeVisible()
  await rerun.click()
  await expect(cards(page)).toHaveCount(1)
})

test('% match is the rounded integer of score * 100, with the uncalibrated notice and no link', async ({ page }) => {
  const result = posting(1, 0.826)
  await installStream(page, (route) => fulfilStream(route, completedStream([result])))

  await page.goto('/#/jobs?q=python+platform&view=best')

  await expect(cards(page).first()).toContainText('83% match')

  const notice = page.getByText(/uncalibrated/i)
  await expect(notice).toBeVisible()
  await expect(notice.locator('a')).toHaveCount(0)
})

test('Why this ranked lists only delivered evidence and is absent when evidence is empty', async ({ page }) => {
  const withEvidence = posting(1, 0.9)
  const withoutEvidence = { ...posting(2, 0.8), evidence: null }
  await installStream(page, (route) =>
    fulfilStream(route, completedStream([withEvidence, withoutEvidence])),
  )

  await page.goto('/#/jobs?q=python+platform&view=best')

  const card1 = cards(page).nth(0)
  const disclosure = card1.getByText('Why this ranked')
  await expect(disclosure).toBeVisible()
  await disclosure.click()
  await expect(card1).toContainText('python')
  await expect(card1).toContainText('requirements')
  await expect(card1).toContainText('responsibilities')

  const card2 = cards(page).nth(1)
  await expect(card2.getByText('Why this ranked')).toHaveCount(0)
})

test('no card exposes a save control, an internal job link, or an external source link', async ({ page }) => {
  await installStream(page, (route) => fulfilStream(route, completedStream([posting(1, 0.9)])))

  await page.goto('/#/jobs?q=python+platform&view=best')

  const card = cards(page).first()
  await expect(card.locator('a')).toHaveCount(0)
  await expect(card.getByRole('button', { name: /save/i })).toHaveCount(0)
  await expect(card.getByRole('link')).toHaveCount(0)
})

test('exhausting the snapshot offers All-postings text search, preserving query and hard filters', async ({ page }) => {
  await installStream(page, (route) =>
    fulfilStream(route, completedStream([posting(1, 0.9), posting(2, 0.8)])),
  )

  await page.goto('/#/jobs?q=python+platform&view=best&workplace=remote')
  await expect(cards(page)).toHaveCount(2)

  const escape = page.getByRole('button', { name: 'Search all postings by exact text' })
  await expect(escape).toBeVisible()
  await escape.click()

  await expect(page).toHaveURL(/view=all/)
  await expect(page).toHaveURL(/q=python(\+|%20)platform/)
  await expect(page).toHaveURL(/workplace=remote/)
})

test('a zero-result snapshot shows the honest empty state and the same escape route', async ({ page }) => {
  await installStream(page, (route) => fulfilStream(route, completedStream([])))

  await page.goto('/#/jobs?q=python+platform&view=best')

  await expect(page.getByRole('region', { name: 'Nothing cleared your filters' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Search all postings by exact text' })).toBeVisible()
})

test('editing the query after a completed run shows the pending banner and reruns only on Update matches', async ({ page }) => {
  let requests = 0
  await installStream(page, async (route) => {
    requests += 1
    await fulfilStream(route, completedStream([posting(1, 0.9)]))
  })

  await page.goto('/#/jobs?q=python&view=best')
  await expect(cards(page)).toHaveCount(1)
  expect(requests).toBe(1)

  await page.getByRole('textbox', { name: 'Search postings' }).fill('kafka')
  await expect(page.getByText('This ranking is from your previous search.')).toBeVisible()
  expect(requests).toBe(1)

  await page.getByRole('button', { name: 'Update matches' }).click()
  await expect.poll(() => requests).toBe(2)
})

test('attaching a CV after a completed run also marks the ranking pending', async ({ page }) => {
  await installStream(page, (route) => fulfilStream(route, completedStream([posting(1, 0.9)])))

  await page.goto('/#/jobs?q=python&view=best')
  await expect(cards(page)).toHaveCount(1)

  await page.getByLabel(/Attach a CV/).setInputFiles({
    name: 'profile.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('PostgreSQL and Python experience'),
  })

  await expect(page.getByText('This ranking is from your previous search.')).toBeVisible()
})

test('a stream that ends with no terminal frame shows the incomplete-connection error', async ({ page }) => {
  const truncated = completedStream([posting(1, 0.9)]).slice(0, 4)
  await installStream(page, (route) => fulfilStream(route, truncated))

  await page.goto('/#/jobs?q=python&view=best')

  await expect(page.getByRole('alert')).toContainText(
    'The search connection ended before results arrived.',
  )
  await expect(cards(page)).toHaveCount(0)
})

test('an unknown event name and a malformed data payload are dropped without a page error', async ({ page }) => {
  const crashes: string[] = []
  const garbage =
    'event: stage.completed\ndata: {not json\n\nevent: search.reticulated\ndata: {}\n\n'
  await installStream(page, (route) =>
    fulfilStream(route, completedStream([posting(1, 0.9)]), garbage),
  )

  const boundPage = page
  boundPage.on('pageerror', (error) => crashes.push(error.message))

  await page.goto('/#/jobs?q=python&view=best')

  await expect(cards(page)).toHaveCount(1)
  expect(crashes).toEqual([])
})

test('a keep-alive comment frame changes nothing on screen', async ({ page }) => {
  await installStream(page, (route) =>
    fulfilStream(route, completedStream([posting(1, 0.9)]), ': ping\n\n'),
  )

  await page.goto('/#/jobs?q=python&view=best')

  await expect(cards(page)).toHaveCount(1)
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('reveal count resets on a new run and is absent from the URL and localStorage', async ({ page }) => {
  await installStream(page, async (route, callIndex) => {
    const results = callIndex === 1
      ? Array.from({ length: 24 }, (_, index) => posting(index + 1, 0.9 - index * 0.01))
      : Array.from({ length: 15 }, (_, index) => posting(100 + index, 0.9 - index * 0.01))
    await fulfilStream(route, completedStream(results))
  })

  await page.goto('/#/jobs?q=python&view=best')
  await expect(cards(page)).toHaveCount(10)
  await page.getByRole('button', { name: 'Show 10 more (14 remaining)' }).click()
  await expect(cards(page)).toHaveCount(20)

  await page.getByRole('textbox', { name: 'Search postings' }).fill('kafka')
  await page.getByRole('button', { name: 'Update matches' }).click()

  await expect(cards(page)).toHaveCount(10)
  await expect(page.getByRole('button', { name: 'Show 5 more (5 remaining)' })).toBeVisible()

  await expect(page).not.toHaveURL(/reveal/)
  const storageDump = await page.evaluate(() => JSON.stringify(window.localStorage))
  expect(storageDump).not.toContain('reveal')
})
