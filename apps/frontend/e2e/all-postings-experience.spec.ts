import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const waitForCatalogue = async (page: Page): Promise<void> => {
  await page.waitForResponse((response) =>
    response.url().endsWith('/api/postings/query') &&
    response.request().method() === 'POST' &&
    response.status() === 200,
  )
}

const openJobs = async (page: Page, hash = '#/jobs'): Promise<void> => {
  const catalogue = waitForCatalogue(page)
  await page.goto(`/${hash}`)
  await catalogue
  await expect(page.getByRole('list', { name: 'All postings results' })).toBeVisible()
}

const changeAndWait = async (page: Page, action: () => Promise<void>): Promise<void> => {
  const catalogue = waitForCatalogue(page)
  await action()
  await catalogue
}

const welcome = (page: Page) => {
  return page.getByRole('region', { name: 'Welcome to Jobber' })
}

const activeFilters = (page: Page) => {
  return page.getByRole('complementary', { name: 'Posting filters' })
}

const postingItems = (page: Page) => {
  return page.getByRole('list', { name: 'All postings results' }).locator(':scope > li')
}

test('shows factual welcome counts and the real newest page without browse-only lies', async ({ page }) => {
  await openJobs(page)

  await expect(welcome(page).getByText('44 live postings', { exact: true })).toBeVisible()
  const counts = page.getByRole('list', { name: 'Live posting counts by source' })
  await expect(
    counts.getByRole('listitem').filter({ hasText: 'Greenhouse company boards' }).getByText('7'),
  ).toBeVisible()
  await expect(
    counts.getByRole('listitem').filter({ hasText: 'Ashby company boards' }).getByText('6'),
  ).toBeVisible()

  const results = page.getByRole('list', { name: 'All postings results' })
  await expect(postingItems(page)).toHaveCount(20)
  await expect(results.getByRole('heading').first()).toHaveText('Fixture Engineer 45')
  await expect(results.getByText(/Discovered /).first()).toBeVisible()
  await expect(results.getByRole('button', { name: /save/i })).toHaveCount(0)
  await expect(results.getByRole('link')).toHaveCount(0)
  await expect(results.getByText(/% match/i)).toHaveCount(0)
  await expect(results.getByText(/matched:/i)).toHaveCount(0)
})

test('debounces All-postings text, applies Enter immediately, and focuses with slash', async ({ page }) => {
  await openJobs(page)
  const query = page.getByRole('textbox', { name: 'Search postings' })

  await changeAndWait(page, () => query.fill('titlebeacon'))
  await expect(page).toHaveURL(/#\/jobs\?view=all&q=titlebeacon$/)
  await expect(postingItems(page)).toHaveCount(1)
  await expect(page.locator('mark').first()).toHaveText(/TitleBeacon/i)
  await expect(page.getByText(/matched:/i)).toHaveCount(0)

  await query.fill('companybeacon')
  await changeAndWait(page, () => query.press('Enter'))
  await expect(page).toHaveURL(/q=companybeacon/)
  await expect(page.getByRole('heading', { name: 'Fixture Engineer 2' })).toBeVisible()

  await page.locator('body').click({ position: { x: 8, y: 8 } })
  await page.keyboard.press('/')
  await expect(query).toBeFocused()
})

test('uses canonical filter controls including principal and candidate experience', async ({ page }) => {
  await openJobs(page)

  await changeAndWait(page, async () => {
    await page.getByRole('button', { name: 'Remote', exact: true }).click()
    await page.getByRole('button', { name: 'Hybrid', exact: true }).click()
  })
  await expect(page).toHaveURL(/workplace=remote,hybrid/)
  await expect(activeFilters(page).getByText('2 active', { exact: true })).toBeVisible()

  await changeAndWait(page, () =>
    page.getByRole('button', { name: 'Principal', exact: true }).click(),
  )
  await expect(page).toHaveURL(/seniority=principal/)
  await expect(page.getByText('No postings match this search')).toBeVisible()

  await page.getByRole('button', { name: 'Clear all' }).click()
  await expect(page).not.toHaveURL(/workplace|seniority/)

  const query = page.getByRole('textbox', { name: 'Search postings' })
  await changeAndWait(page, () => query.fill('experiencebeacon'))
  await changeAndWait(page, () =>
    page.getByRole('slider', { name: 'Candidate experience' }).fill('3'),
  )
  await expect(postingItems(page)).toHaveCount(2)
  await expect(activeFilters(page).getByText('I have 3 years', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'ExperienceBeacon Unknown Requirement' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'ExperienceBeacon Three Years' })).toBeVisible()
})

test('ORs source choices and ANDs posted-within across filter groups', async ({ page }) => {
  await openJobs(page)

  await changeAndWait(page, async () => {
    await page.getByRole('checkbox', { name: 'Greenhouse company boards' }).check()
    await page.getByRole('checkbox', { name: 'Ashby company boards' }).check()
  })
  await expect(page).toHaveURL(/source=ashby,greenhouse/)
  await expect(
    postingItems(page),
  ).toHaveCount(13)

  await changeAndWait(page, () =>
    page.getByRole('button', { name: '24 hours', exact: true }).click(),
  )
  await expect(page).toHaveURL(/posted=24h/)
  await expect(
    postingItems(page),
  ).toHaveCount(8)
})

test('keeps annual salary canonical while monthly presentation persists', async ({ page }) => {
  await openJobs(page)
  const query = page.getByRole('textbox', { name: 'Search postings' })
  await changeAndWait(page, () => query.fill('salarybeacon'))
  await changeAndWait(page, () =>
    page.getByRole('slider', { name: 'Minimum salary' }).fill('200000'),
  )

  await expect(postingItems(page)).toHaveCount(2)
  await expect(activeFilters(page).getByText('At least $200k/yr', { exact: true })).toBeVisible()

  await changeAndWait(page, () =>
    page.getByRole('checkbox', { name: 'Include postings with undisclosed salary' }).check(),
  )
  await expect(postingItems(page)).toHaveCount(3)
  await expect(activeFilters(page).getByText('At least $200k/yr or undisclosed', { exact: true })).toBeVisible()

  const hashBefore = await page.evaluate(() => window.location.hash)
  await page.getByRole('button', { name: 'monthly', exact: true }).click()
  await expect(activeFilters(page).getByText('At least $16.7k/mo or undisclosed', { exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe(hashBefore)
  await page.reload()
  await expect(page.getByRole('button', { name: 'monthly', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

test('sorts, paginates, restores Back, and replaces an out-of-range page', async ({ page }) => {
  await openJobs(page)

  await changeAndWait(page, async () => {
    await page.getByRole('combobox', { name: 'Sort' }).selectOption('salary')
  })
  await expect(page).toHaveURL(/sort=salary/)
  await expect(page.getByRole('heading', { name: 'SalaryBeacon Engineer' }).first()).toBeVisible()
  await expect(page.getByText('jobber — live corpus')).toHaveCount(0)

  await page.getByRole('combobox', { name: 'Sort' }).selectOption('newest')
  await expect(page).not.toHaveURL(/sort=salary/)
  await expect(page.getByRole('heading', { name: 'Fixture Engineer 45' })).toBeVisible()
  await changeAndWait(page, () => page.getByRole('button', { name: 'Next page' }).click())
  await expect(page).toHaveURL(/page=2/)
  await expect(page.getByRole('heading', { name: 'Fixture Engineer 20' })).toBeVisible()

  await page.goBack()
  await expect(page).not.toHaveURL(/page=2/)
  await expect(page.getByRole('heading', { name: 'Fixture Engineer 45' })).toBeVisible()

  const firstRequest = waitForCatalogue(page)
  await page.goto('/#/jobs?page=99')
  await firstRequest
  await expect(page).toHaveURL(/#\/jobs\?page=3$/)
  await expect(page.getByText('Page 3 of 3')).toBeVisible()
  await expect(postingItems(page)).toHaveCount(4)
})

test('offers useful no-result escapes without clearing the query accidentally', async ({ page }) => {
  await openJobs(page)
  const query = page.getByRole('textbox', { name: 'Search postings' })
  await changeAndWait(page, () => query.fill('experiencebeacon'))
  await changeAndWait(page, () =>
    page.getByRole('checkbox', { name: 'Djinni', exact: true }).check(),
  )
  await expect(page.getByText('No postings match this search')).toBeVisible()

  await page.getByRole('button', { name: 'Clear filters, keep query' }).click()
  await expect(page).toHaveURL(/q=experiencebeacon/)
  await expect(page).not.toHaveURL(/source=/)
  await expect(postingItems(page)).toHaveCount(3)

  await changeAndWait(page, () => query.fill('absentbeacon'))
  await expect(page.getByText('No postings match this search')).toBeVisible()
  await page.getByRole('button', { name: 'Clear search' }).click()
  await expect(page).toHaveURL(/#\/jobs$/)
  await expect(page.getByText('jobber — live corpus')).toBeVisible()
})

test('uses an accessible mobile filter dialog and never overflows 320px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openJobs(page)

  const opener = page.getByRole('button', { name: /^Filters/ })
  await opener.click()
  const dialog = page.getByRole('dialog', { name: 'Filter postings' })
  await expect(dialog).toBeVisible()
  await expect(page.getByRole('button', { name: 'Close filters' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(opener).toBeFocused()

  await page.setViewportSize({ width: 320, height: 800 })
  const sizes = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }))
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.client)
})

test('keeps CV identity out of the URL and storage during the preserved pre-Plan-9 flow', async ({ page }) => {
  await openJobs(page)
  await page.locator('input[type=file]').setInputFiles('e2e/fixtures/profile.pdf')
  await expect(page.getByText(/profile\.pdf/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Best matches' })).toHaveAttribute('aria-pressed', 'true')

  const state = await page.evaluate(() => ({
    href: window.location.href,
    storage: { ...window.localStorage },
  }))
  expect(state.href).not.toContain('profile.pdf')
  expect(JSON.stringify(state.storage)).not.toContain('profile.pdf')
})
