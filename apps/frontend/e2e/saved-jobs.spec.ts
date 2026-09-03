import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const STORAGE_KEY = 'jobber.saved-jobs.v1'
const DETAIL_ID = 'jobico:e2e-13'
const DELISTED_ID = 'ashby:e2e-44'
const REMOVED_ID = 'greenhouse:e2e-removed'
const SAVED_LIMIT = 100

type SeedRecord = {
  id: string
  title: string
  company: string
  source: string
  savedAt: string
}

async function waitForCatalogue(page: Page): Promise<void> {
  await page.waitForResponse((response) =>
    response.url().endsWith('/api/postings/query') &&
    response.request().method() === 'POST' &&
    response.status() === 200,
  )
}

async function openBrowse(page: Page, query: string): Promise<void> {
  const catalogue = waitForCatalogue(page)
  await page.goto(`/#/jobs?q=${encodeURIComponent(query)}`)
  await catalogue
  await expect(page.getByRole('list', { name: 'All postings results' })).toBeVisible()
}

async function seedStorage(page: Page, value: unknown): Promise<void> {
  await page.addInitScript(
    ([key, raw]) => {
      window.localStorage.setItem(key as string, raw as string)
    },
    [STORAGE_KEY, typeof value === 'string' ? value : JSON.stringify(value)] as const,
  )
}

function record(id: string, title: string): SeedRecord {
  return {
    id,
    title,
    company: 'Saved Snapshot Company',
    source: id.split(':')[0],
    savedAt: '2026-09-01T10:00:00.000Z',
  }
}

async function openSaved(page: Page): Promise<void> {
  await page.goto('/#/saved')
  await expect(page.getByRole('heading', { level: 1, name: 'Saved jobs' })).toBeVisible()
}

test('saving from a browse card marks the control and survives a reload on the Saved page', async ({ page }) => {
  await openBrowse(page, 'DetailBeacon')

  const save = page.getByRole('button', { name: /^Save DetailBeacon Platform Engineer$/ })
  await save.click()
  await expect(save).toHaveAttribute('aria-pressed', 'true')

  await openSaved(page)
  await expect(page.getByRole('link', { name: 'DetailBeacon Platform Engineer' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('link', { name: 'DetailBeacon Platform Engineer' })).toBeVisible()
  await expect(page.getByText('1 saved · 99 remaining')).toBeVisible()
})

test('the Saved page issues exactly one lookup carrying exactly the saved identifiers', async ({ page }) => {
  await seedStorage(page, [record(DETAIL_ID, 'Saved One'), record(DELISTED_ID, 'Saved Two')])

  const bodies: unknown[] = []
  page.on('request', (request) => {
    if (request.url().endsWith('/api/postings/lookup')) {
      bodies.push(request.postDataJSON())
    }
  })

  const lookup = page.waitForResponse((response) =>
    response.url().endsWith('/api/postings/lookup') && response.status() === 200,
  )
  await openSaved(page)
  const response = await lookup

  expect(response.headers()['cache-control']).toBe('no-store')
  expect(bodies).toEqual([{ ids: [DETAIL_ID, DELISTED_ID] }])
})

test('a delisted saved posting is badged and a removed one falls back to its device snapshot', async ({ page }) => {
  await seedStorage(page, [
    record(DELISTED_ID, 'Delisted Snapshot Title'),
    record(REMOVED_ID, 'Removed Snapshot Title'),
  ])

  const lookup = page.waitForResponse((response) =>
    response.url().endsWith('/api/postings/lookup') && response.status() === 200,
  )
  await openSaved(page)
  await lookup

  const rows = page.getByRole('list', { name: 'Saved jobs' }).getByRole('listitem')
  await expect(rows.filter({ hasText: 'DelistedBeacon Engineer' })).toContainText('No longer listed')

  const removedRow = rows.filter({ hasText: 'Removed Snapshot Title' })
  await expect(removedRow).toContainText('Removed from the catalogue')
  await expect(removedRow).toContainText('showing the details saved on this device')
})

test('removing on the Saved page clears the pressed state on the browse card', async ({ page }) => {
  await openBrowse(page, 'DetailBeacon')
  await page.getByRole('button', { name: /^Save DetailBeacon Platform Engineer$/ }).click()

  await openSaved(page)
  await page
    .getByRole('button', { name: /DetailBeacon Platform Engineer, remove from saved/ })
    .click()
  await expect(page.getByText('No saved jobs on this device')).toBeVisible()

  await openBrowse(page, 'DetailBeacon')
  await expect(
    page.getByRole('button', { name: /^Save DetailBeacon Platform Engineer$/ }),
  ).toHaveAttribute('aria-pressed', 'false')
})

test('storage holds exactly one Jobber saved-jobs key carrying only the five allowed fields', async ({ page }) => {
  await openBrowse(page, 'DetailBeacon')
  await page.getByRole('button', { name: /^Save DetailBeacon Platform Engineer$/ }).click()
  await openSaved(page)

  const keys = await page.evaluate((prefix) =>
    Object.keys(window.localStorage).filter((key) => key.startsWith(prefix)),
    'jobber.saved-jobs',
  )
  expect(keys).toEqual([STORAGE_KEY])

  const fields = await page.evaluate((key) =>
    Array.from(
      new Set(
        (JSON.parse(window.localStorage.getItem(key) ?? '[]') as Record<string, unknown>[])
          .flatMap((entry) => Object.keys(entry)),
      ),
    ),
    STORAGE_KEY,
  )
  expect(fields.sort()).toEqual(['company', 'id', 'savedAt', 'source', 'title'])
})

test('a corrupted stored value reads as empty and a later save repairs the record', async ({ page }) => {
  await seedStorage(page, '{not json at all')

  await openSaved(page)
  await expect(page.getByText('No saved jobs on this device')).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)

  await openBrowse(page, 'DetailBeacon')
  await page.getByRole('button', { name: /^Save DetailBeacon Platform Engineer$/ }).click()
  await openSaved(page)
  await expect(page.getByRole('link', { name: 'DetailBeacon Platform Engineer' })).toBeVisible()
})

test('at capacity the unsaved control is disabled, explained, and changes nothing', async ({ page }) => {
  await seedStorage(
    page,
    Array.from({ length: SAVED_LIMIT }, (_, index) =>
      record(`greenhouse:e2e-cap-${index}`, `Capacity Filler ${index}`),
    ),
  )

  await openBrowse(page, 'DetailBeacon')
  const save = page.getByRole('button', { name: /^Save DetailBeacon Platform Engineer$/ })
  await expect(save).toBeDisabled()
  await expect(
    page.getByText(
      `Saved jobs are limited to ${SAVED_LIMIT} on this device. Remove one to save another.`,
    ),
  ).toBeAttached()

  const stored = await page.evaluate(
    (key) => (JSON.parse(window.localStorage.getItem(key) ?? '[]') as unknown[]).length,
    STORAGE_KEY,
  )
  expect(stored).toBe(SAVED_LIMIT)
})

test('a save in one tab reaches a second tab on the same origin without a reload', async ({ context }) => {
  const reader = await context.newPage()
  const writer = await context.newPage()

  try {
    await openSaved(reader)
    await expect(reader.getByText('No saved jobs on this device')).toBeVisible()

    await openBrowse(writer, 'DetailBeacon')
    await writer.getByRole('button', { name: /^Save DetailBeacon Platform Engineer$/ }).click()

    await expect(reader.getByRole('link', { name: 'DetailBeacon Platform Engineer' })).toBeVisible()
  } finally {
    await writer.close()
    await reader.close()
  }
})

test('an unreachable lookup keeps every saved row visible under one error state with a working retry', async ({ page, context }) => {
  await seedStorage(page, [record(DETAIL_ID, 'Snapshot Only Title')])
  const catalogue = waitForCatalogue(page)
  await page.goto('/#/jobs')
  await catalogue

  await context.setOffline(true)
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Saved' }).click()
  await expect(page.getByRole('alert')).toContainText('Current details could not be loaded')
  await expect(page.getByRole('link', { name: 'Snapshot Only Title' })).toBeVisible()

  await context.setOffline(false)
  const lookup = page.waitForResponse((response) =>
    response.url().endsWith('/api/postings/lookup') && response.status() === 200,
  )
  await page.getByRole('button', { name: 'Try again' }).click()
  await lookup
  await expect(page.getByRole('link', { name: 'DetailBeacon Platform Engineer' })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('the Saved page states device-local storage in visible page text', async ({ page }) => {
  await openSaved(page)

  await expect(
    page.getByText(
      'Saved jobs are stored in this browser on this device only. They are not tied to an account, do not sync between devices, and are lost if you clear this site’s data.',
    ),
  ).toBeVisible()
  await expect(page.locator('[title]')).toHaveCount(0)
})
