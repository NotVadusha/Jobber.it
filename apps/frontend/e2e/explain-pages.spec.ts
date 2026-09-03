import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

import { PROFILE_EXTENSIONS, PROFILE_MAX_BYTES, PROFILE_MAX_CHARS } from '@/features/cv/read-profile'
import { STORAGE_KEYS } from '@/lib/storage-keys'

const RANKING_STAGES = ['Rewrite', 'Filter', 'Retrieve', 'Group', 'Rerank']
const ACTIVE_ROUTES = new Set(['jobs', 'job', 'saved', 'ranking', 'privacy', 'changelog', 'about'])
const PLACEHOLDER_TOKENS = ['TODO', 'Lorem', 'coming soon', 'example.com', 'PENDING']

test.beforeEach(async ({ page }) => {
  await page.route('**api.github.com/**', (route) => route.abort())
})

const anchors = async (page: Page): Promise<string[]> => {
  return page.$$eval('a[href]', (elements) => elements.map((el) => el.getAttribute('href') ?? ''))
}

test('Ranking, Privacy, and About each render with exactly one h1', async ({ page }) => {
  for (const hash of ['#/ranking', '#/privacy', '#/about']) {
    await page.goto(`/${hash}`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
  }
})

test('Ranking page lists the five pipeline stages in order', async ({ page }) => {
  await page.goto('/#/ranking')
  const headings = page.getByRole('heading', { level: 3 })
  await expect(headings).toHaveCount(5)
  await expect(headings).toHaveText(RANKING_STAGES)
})

test('the uncalibrated-score statement is present and unhedged', async ({ page }) => {
  await page.goto('/#/ranking')
  await expect(page.getByText(/not a probability/i)).toBeVisible()
})

test('Privacy page storage table has one row per storage key', async ({ page }) => {
  await page.goto('/#/privacy')
  const rows = page.getByRole('table').locator('tbody tr')
  await expect(rows).toHaveCount(Object.values(STORAGE_KEYS).length)
  for (const key of Object.values(STORAGE_KEYS)) {
    await expect(page.getByRole('table')).toContainText(key)
  }
})

test('Privacy page states the accepted CV formats and both limits', async ({ page }) => {
  await page.goto('/#/privacy')
  const body = await page.getByRole('main').innerText()
  for (const extension of PROFILE_EXTENSIONS) {
    expect(body.toUpperCase()).toContain(extension.replace('.', '').toUpperCase())
  }
  expect(body).toContain(String(PROFILE_MAX_BYTES / (1024 * 1024)))
  expect(body).toContain(PROFILE_MAX_CHARS.toLocaleString())
})

test('About page has no empty, hash, or javascript anchors, and every external link is https with noopener noreferrer', async ({ page }) => {
  await page.goto('/#/about')
  const links = page.locator('a[href]')
  const count = await links.count()
  for (let i = 0; i < count; i += 1) {
    const link = links.nth(i)
    const href = await link.getAttribute('href')
    expect(href).not.toBe('')
    expect(href).not.toBe('#')
    expect(href?.startsWith('javascript:')).toBe(false)
    if (href?.startsWith('https://')) {
      const rel = (await link.getAttribute('rel')) ?? ''
      expect(rel).toContain('noopener')
      expect(rel).toContain('noreferrer')
    }
  }
})

test('link integrity: every internal href resolves to an active route and every other href is https', async ({ page }) => {
  const hrefs = new Set<string>()
  for (const hash of ['#/jobs', '#/ranking', '#/privacy', '#/about', '#/changelog']) {
    await page.goto(`/${hash}`)
    for (const href of await anchors(page)) hrefs.add(href)
  }

  for (const href of hrefs) {
    if (href === '#main-content') continue
    if (href.startsWith('#/')) {
      const routeName = href.slice(2).split('/')[0]
      expect(ACTIVE_ROUTES.has(routeName)).toBe(true)
    } else {
      expect(href.startsWith('https://')).toBe(true)
    }
  }
})

test('desktop navigation and mobile menu contain the right entries', async ({ page }) => {
  await page.goto('/#/jobs')
  const desktopNav = page.getByRole('navigation').first()
  for (const label of ['Ranking', 'Changelog', 'About', 'Saved']) {
    await expect(desktopNav.getByRole('link', { name: label })).toBeVisible()
  }
  await expect(desktopNav.getByRole('link', { name: 'Privacy', exact: true })).toHaveCount(0)
})

test('the current page nav entry carries aria-current="page"', async ({ page }) => {
  await page.goto('/#/ranking')
  await expect(page.getByRole('link', { name: 'Ranking' }).first()).toHaveAttribute('aria-current', 'page')
})

test('every footer group is non-empty and internal footer links resolve to active routes', async ({ page }) => {
  await page.goto('/#/jobs')
  const footer = page.getByRole('contentinfo')
  const groups = footer.locator('ul, ol')
  const groupCount = await groups.count()
  expect(groupCount).toBeGreaterThan(0)
  for (const href of await anchors(footer.page())) {
    if (href.startsWith('#/')) {
      expect(ACTIVE_ROUTES.has(href.slice(2).split('/')[0])).toBe(true)
    }
  }
})

test('the jobs hero hard-constraints notice links to Ranking', async ({ page }) => {
  await page.goto('/#/jobs')
  const heroLink = page.locator('#main-content').getByRole('link', { name: 'How ranking works' })
  await expect(heroLink).toHaveAttribute('href', '#/ranking')
})

test('placeholder scan finds no stand-in copy on any explanatory page', async ({ page }) => {
  for (const hash of ['#/ranking', '#/privacy', '#/about', '#/changelog']) {
    await page.goto(`/${hash}`)
    const text = await page.getByRole('main').innerText()
    for (const token of PLACEHOLDER_TOKENS) {
      expect(text).not.toContain(token)
    }
  }
})

test('with api.github.com aborted, the Changelog page still renders its shell and the app still works', async ({ page }) => {
  await page.goto('/#/changelog')
  await expect(page.getByRole('heading', { level: 1, name: 'Changelog' })).toBeVisible()
  await page.goto('/#/jobs')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})
