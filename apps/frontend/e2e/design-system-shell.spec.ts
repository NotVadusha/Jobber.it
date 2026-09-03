import { expect, test, type Page } from '@playwright/test'

import { grantCvConsent } from './harness/cv-consent'

const THEME_KEY = 'jobber.theme.v1'

const readThemeState = async (page: { evaluate: <T>(fn: () => T) => Promise<T> }) => {
  return page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    source: document.documentElement.dataset.themeSource,
  }))
}

test('stored light theme wins on the first visible page', async ({ page }) => {
  await page.addInitScript(
    ([key]) => window.localStorage.setItem(key, 'light'),
    [THEME_KEY],
  )
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')

  expect(await readThemeState(page)).toEqual({ theme: 'light', source: 'stored' })
})

test('stored dark theme wins on the first visible page', async ({ page }) => {
  await page.addInitScript(
    ([key]) => window.localStorage.setItem(key, 'dark'),
    [THEME_KEY],
  )
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')

  expect(await readThemeState(page)).toEqual({ theme: 'dark', source: 'stored' })
})

test('missing preference follows light OS preference', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')

  expect(await readThemeState(page)).toEqual({ theme: 'light', source: 'system' })
})

test('missing preference follows dark OS preference', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')

  expect(await readThemeState(page)).toEqual({ theme: 'dark', source: 'system' })
})

test('invalid and inaccessible storage fall back safely', async ({ page, context }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.addInitScript(
    ([key]) => window.localStorage.setItem(key, 'purple'),
    [THEME_KEY],
  )
  await page.goto('/')

  expect(await readThemeState(page)).toEqual({ theme: 'dark', source: 'system' })

  const unavailablePage = await context.newPage()
  await unavailablePage.emulateMedia({ colorScheme: 'light' })
  await unavailablePage.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('storage unavailable')
      },
    })
  })
  await unavailablePage.goto('/')

  expect(await readThemeState(unavailablePage)).toEqual({ theme: 'light', source: 'system' })
  await unavailablePage.close()
})

test('system theme changes apply until the user chooses explicitly', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')
  expect(await readThemeState(page)).toEqual({ theme: 'dark', source: 'system' })

  await page.emulateMedia({ colorScheme: 'light' })
  await page.reload()
  expect(await readThemeState(page)).toEqual({ theme: 'light', source: 'system' })

  await page.evaluate(([key]) => window.localStorage.setItem(key, 'dark'), [THEME_KEY])
  await page.emulateMedia({ colorScheme: 'light' })
  await page.reload()
  expect(await readThemeState(page)).toEqual({ theme: 'dark', source: 'stored' })
})

test('theme toggle persists and updates its accessible name', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')

  const toggle = page.getByRole('button', { name: 'Switch to light theme' })
  await expect(toggle).toBeVisible()

  await toggle.click()

  const toggledBack = page.getByRole('button', { name: 'Switch to dark theme' })
  await expect(toggledBack).toBeVisible()
  expect(await readThemeState(page)).toEqual({ theme: 'light', source: 'stored' })
  expect(await page.evaluate(([key]) => window.localStorage.getItem(key), [THEME_KEY])).toBe(
    'light',
  )

  await page.reload()
  expect(await readThemeState(page)).toEqual({ theme: 'light', source: 'stored' })
  await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toBeVisible()
})

const THEME_VARS = [
  '--theme-canvas',
  '--theme-canvas-soft',
  '--theme-surface-1',
  '--theme-surface-2',
  '--theme-surface-3',
  '--theme-border-subtle',
  '--theme-border-strong',
  '--theme-text-primary',
  '--theme-text-secondary',
  '--theme-text-tertiary',
  '--theme-accent',
  '--theme-accent-hover',
  '--theme-accent-ink',
  '--theme-accent-text',
  '--theme-accent-soft',
  '--theme-accent-border',
  '--theme-positive',
  '--theme-danger',
  '--theme-shadow',
] as const

const readThemeVars = async (page: Page): Promise<Record<string, string>> => {
  return page.evaluate((vars) => {
    const style = getComputedStyle(document.documentElement)
    const out: Record<string, string> = {}
    for (const name of vars) out[name] = style.getPropertyValue(name).trim()
    return out
  }, THEME_VARS as unknown as string[])
}

const srgbToLinear = (channel: number): number => {
  const c = channel / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

const relativeLuminance = (hex: string): number => {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
}

const contrastRatio = (hexA: string, hexB: string): number => {
  const l1 = relativeLuminance(hexA)
  const l2 = relativeLuminance(hexB)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

test('both themes expose complete readable semantic tokens', async ({ page }) => {
  for (const theme of ['dark', 'light'] as const) {
    await page.addInitScript(
      ([key, value]) => window.localStorage.setItem(key, value),
      [THEME_KEY, theme],
    )
    await page.goto('/')
    expect(await readThemeState(page)).toEqual({ theme, source: 'stored' })

    const vars = await readThemeVars(page)
    for (const name of THEME_VARS) {
      expect(vars[name], `${name} in ${theme} theme`).toBeTruthy()
    }

    // --theme-shadow is a shadow value, not a color; the rest are hex/rgb colors.
    const canvas = vars['--theme-canvas']
    const textPrimary = vars['--theme-text-primary']
    const textSecondary = vars['--theme-text-secondary']
    const textTertiary = vars['--theme-text-tertiary']
    const accent = vars['--theme-accent']
    const accentText = vars['--theme-accent-text']

    expect(contrastRatio(textPrimary, canvas), `text-primary vs canvas in ${theme}`)
      .toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(textSecondary, canvas), `text-secondary vs canvas in ${theme}`)
      .toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(accentText, canvas), `accent-text vs canvas in ${theme}`)
      .toBeGreaterThanOrEqual(4.5)

    // --theme-accent is the fill/border token (decorative elements, large
    // controls), not body text — it only needs the 3:1 non-text floor. Text
    // at normal sizes must use accent-text (asserted at 4.5:1 above) instead.
    expect(contrastRatio(accent, canvas), `accent vs canvas in ${theme}`)
      .toBeGreaterThanOrEqual(3)

    // --theme-text-tertiary is supplemental-only copy, never a form label,
    // error, or the sole carrier of meaningful data (see SearchResults'
    // rank/score, which use text-secondary instead) — it only needs the 3:1
    // non-text floor, not the 4.5:1 body-text target.
    expect(contrastRatio(textTertiary, canvas), `text-tertiary vs canvas in ${theme}`)
      .toBeGreaterThanOrEqual(3)
  }
})

const REQUIRED_VIEWPORTS = [320, 768, 1024, 1440] as const

test('no horizontal overflow and focused content clears the sticky header across required widths', async ({
  page,
}) => {
  for (const width of REQUIRED_VIEWPORTS) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const innerWidth = await page.evaluate(() => window.innerWidth)
    expect(scrollWidth, `scrollWidth <= innerWidth at ${width}px`).toBeLessThanOrEqual(innerWidth)

    const queryField = page.getByRole('textbox', { name: 'Search postings' })
    await queryField.focus()
    await expect(queryField).toBeFocused()

    const headerBox = await page.locator('header').boundingBox()
    const fieldBox = await queryField.boundingBox()
    expect(headerBox, `header bounding box at ${width}px`).not.toBeNull()
    expect(fieldBox, `focused field bounding box at ${width}px`).not.toBeNull()

    expect(
      fieldBox!.y,
      `focused query field clears the sticky header at ${width}px`,
    ).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height)
  }
})

// App.tsx passes navigation={[]} footerGroups={[]} in this task, so the real
// app can't exercise the mobile-menu/active-link contract. e2e/harness/app-shell.tsx
// mounts AppShell directly with a fixed nav/footer fixture, served as its own
// Vite HTML entry point — no production code under src/ references it.
const HARNESS_URL = '/e2e/harness/app-shell.html'

test('mobile menu closes with Escape and restores focus', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto(HARNESS_URL)

  const menuButton = page.getByRole('button', { name: /menu/i })
  await expect(menuButton).toHaveAccessibleName('Open menu')

  await menuButton.click()
  await expect(menuButton).toHaveAttribute('aria-expanded', 'true')
  await expect(menuButton).toHaveAccessibleName('Close menu')
  const mobileLink = page.getByRole('link', { name: 'Jobs' })
  await expect(mobileLink).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(menuButton).toHaveAttribute('aria-expanded', 'false')
  await expect(menuButton).toHaveAccessibleName('Open menu')
  await expect(mobileLink).toBeHidden()
  await expect(menuButton).toBeFocused()
})

test('mobile menu closes on outside press and navigation', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto(HARNESS_URL)

  const menuButton = page.getByRole('button', { name: /menu/i })

  await menuButton.click()
  await expect(menuButton).toHaveAttribute('aria-expanded', 'true')
  await page.mouse.click(200, 700)
  await expect(menuButton).toHaveAttribute('aria-expanded', 'false')

  await menuButton.click()
  await expect(menuButton).toHaveAttribute('aria-expanded', 'true')
  await page.getByRole('link', { name: 'Jobs' }).click()
  await expect(menuButton).toHaveAttribute('aria-expanded', 'false')
  await expect(page).toHaveURL(/#\/jobs$/)
})

test('shell emits only real links and one active link', async ({ page }) => {
  await page.goto(HARNESS_URL)

  const hrefs = await page.locator('a').evaluateAll((anchors) =>
    anchors.map((anchor) => anchor.getAttribute('href')),
  )
  expect(hrefs.length).toBeGreaterThan(0)
  for (const href of hrefs) {
    expect(href).toBeTruthy()
    expect(href).not.toBe('#')
    expect(href).not.toMatch(/^javascript:/)
  }

  const activeLinks = page.locator('a[aria-current="page"]')
  await expect(activeLinks).toHaveCount(1)
  await expect(activeLinks.first()).toHaveText('Search')
})

test('mobile menu button appears only below the 768px breakpoint', async ({ page }) => {
  await page.goto(HARNESS_URL)

  await page.setViewportSize({ width: 767, height: 800 })
  await expect(page.getByRole('button', { name: /menu/i })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeHidden()

  await page.setViewportSize({ width: 768, height: 800 })
  await expect(page.getByRole('button', { name: /menu/i })).toBeHidden()
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
})

test('navigation and footer groups contain only active routes', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('navigation', { name: 'Primary' }).getByRole('link')).toHaveText([
    'Ranking',
    'Changelog',
    'About',
    'Saved',
  ])
  await expect(page.getByRole('button', { name: /Switch to (dark|light) theme/ })).toHaveCount(1)

  await expect(page.locator('footer').getByRole('link', { name: 'Saved' })).toHaveAttribute(
    'href',
    '#/saved',
  )
  await expect(page.locator('footer').getByText('aggregates public postings')).toBeVisible()
  for (const [name, href] of [
    ['How ranking works', '#/ranking'],
    ['CV parsing and privacy', '#/privacy'],
    ['Changelog', '#/changelog'],
    ['About', '#/about'],
  ] as const) {
    await expect(page.locator('footer').getByRole('link', { name, exact: true }).first()).toHaveAttribute(
      'href',
      href,
    )
  }
})

// Task 5: ThemeProvider moved from AppShell.tsx into main.tsx alongside the
// new ToastProvider. The theme suite above already re-verifies toggling
// end-to-end against '/', so it doubles as the regression check for that move.

const attachAndRemoveProfile = async (page: Page): Promise<void> => {
  await page.getByLabel(/Drop a CV here, or choose a file/).setInputFiles({
    name: 'profile.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('PostgreSQL and Python experience'),
  })
  await expect(page.getByText('profile.txt').first()).toBeVisible()
  await page.getByRole('button', { name: 'Remove' }).click()
}

test('toast replacement and close use one polite live region', async ({ page }) => {
  await grantCvConsent(page)
  await page.goto('/')

  await attachAndRemoveProfile(page)

  // role="status" doesn't compute its accessible name from content per the
  // ARIA spec (unlike role="alert" or "button"), so the message is asserted
  // via toContainText rather than a getByRole name filter.
  // Scoped to the toast viewport because the catalogue's loading state is a
  // second, legitimate polite region on this page.
  const toasts = page.locator('#toast-viewport').getByRole('status')
  await expect(toasts).toBeVisible()
  await expect(toasts).toContainText('Profile removed')
  await expect(toasts).toHaveAttribute('aria-live', 'polite')
  await expect(toasts).toHaveAttribute('aria-atomic', 'true')
  await expect(toasts).toHaveCount(1)

  // A second real trigger must replace the toast, never stack a second one.
  await attachAndRemoveProfile(page)
  await expect(toasts).toHaveCount(1)
  await expect(toasts).toContainText('Profile removed')

  await page.getByRole('button', { name: 'Dismiss notification' }).click()
  await expect(toasts).toHaveCount(0)
})

// PageState's 'empty' kind is already exercised live via '/' in
// architecture-contracts.spec.ts ("Nothing cleared the filters."), and
// 'error' via the 500-char/EMPTY_SEARCH and search-failure tests there. The
// 'loading' kind has no caller anywhere in the shipped app yet (Plan 7 owns
// search-result loading UI, per the task brief's resolution), so it can only
// be observed through e2e/harness/app-shell.tsx. This test asserts all three
// kinds plus a labelled Skeleton against that single isolated harness mount
// instead of splitting the same component's accessibility contract across
// two different testing strategies.
test('page states and skeletons expose the expected accessibility tree', async ({ page }) => {
  await page.goto(HARNESS_URL)

  const loading = page.getByTestId('page-state-loading').getByRole('status')
  await expect(loading).toHaveAttribute('aria-live', 'polite')
  await expect(loading).toHaveAttribute('aria-busy', 'true')
  await expect(loading).toContainText('Loading results')

  const empty = page
    .getByTestId('page-state-empty')
    .getByRole('region', { name: 'Nothing cleared the filters.' })
  await expect(empty).toBeVisible()
  expect(await empty.getAttribute('aria-live')).toBeNull()
  expect(await empty.getAttribute('aria-busy')).toBeNull()

  const error = page.getByTestId('page-state-error').getByRole('alert')
  await expect(error).toContainText('temporarily unavailable')
  await expect(error).toContainText('req-error')

  const skeletonBlock = page.getByTestId('skeleton-sample').locator('.ui-skeleton')
  await expect(skeletonBlock).toHaveAttribute('aria-hidden', 'true')
  const skeletonStatus = page.getByTestId('skeleton-sample').getByRole('status')
  await expect(skeletonStatus).toHaveText('Loading results')
  await expect(skeletonStatus).toHaveClass(/sr-only/)
})

const parseCssDurationMs = (value: string): number => {
  const trimmed = value.trim()
  if (trimmed.endsWith('ms')) return parseFloat(trimmed)
  if (trimmed.endsWith('s')) return parseFloat(trimmed) * 1000
  return parseFloat(trimmed)
}

test('reduced motion disables nonessential transition and animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await grantCvConsent(page)
  await page.goto('/')

  await attachAndRemoveProfile(page)
  const toast = page.getByRole('status')
  await expect(toast).toBeVisible()
  await expect(toast).toContainText('Profile removed')

  const toastStyle = await toast.evaluate((el) => {
    const computed = getComputedStyle(el)
    return { animationDuration: computed.animationDuration, opacity: computed.opacity }
  })
  expect(parseCssDurationMs(toastStyle.animationDuration)).toBeLessThan(1)
  expect(toastStyle.opacity).toBe('1')

  await page.goto(HARNESS_URL)
  const skeleton = page.getByTestId('skeleton-sample').locator('.ui-skeleton')
  const skeletonStyle = await skeleton.evaluate((el) => {
    const computed = getComputedStyle(el)
    return { animationDuration: computed.animationDuration, backgroundImage: computed.backgroundImage }
  })
  expect(parseCssDurationMs(skeletonStyle.animationDuration)).toBeLessThan(1)
  expect(skeletonStyle.backgroundImage).not.toContain('gradient')
})
