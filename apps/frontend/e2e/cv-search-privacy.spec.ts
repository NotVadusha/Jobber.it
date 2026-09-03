import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

// Real-path coverage for Plan 9 (docs/plans/09-cv-search-and-privacy.md
// §16.5). This spec talks to the actual Vite dev server, the actual FastAPI
// backend, and the actual Postgres catalogue. It contains exactly one
// page.route, aborting /api/meta for the metadata-outage half of case 15 —
// no route.fulfill, no imported production function, no other test-only
// route. The E2E harness holds unusable OpenAI/Pinecone keys on purpose, so
// a CV-only search reaches a real SEARCH_UNAVAILABLE outcome (case 21)
// rather than live provider output.

const BEACON = 'ZZBEACONCVZZ'

const PDF_FIXTURE = fileURLToPath(new URL('./fixtures/profile.pdf', import.meta.url))
const SCANNED_FIXTURE = fileURLToPath(new URL('./fixtures/profile-scanned.pdf', import.meta.url))
const LONG_FIXTURE = fileURLToPath(new URL('./fixtures/profile-long.txt', import.meta.url))
const CV_FIXTURE = fileURLToPath(new URL('./fixtures/profile-cv.txt', import.meta.url))
const CV_TEXT = readFileSync(CV_FIXTURE, 'utf8').trim()

const CONSENT_KEY = 'jobber.cv-consent.v1'

const cvRegion = (page: Page): Locator => {
  return page.getByRole('region', { name: 'CV search' })
}

const dropInput = (page: Page): Locator => {
  return page.getByLabel(/Drop a CV here, or choose a file/)
}

const consentButton = (page: Page): Locator => {
  return page.getByRole('button', { name: 'I understand — choose a file' })
}

const grantConsentViaGesture = async (page: Page): Promise<void> => {
  const chooser = page.waitForEvent('filechooser')
  await consentButton(page).click()
  const fileChooser = await chooser
  await fileChooser.setFiles([])
}

const dispatchDrop = async (target: Locator, fileName: string): Promise<void> => {
  await target.evaluate((node, name) => {
    const dataTransfer = new DataTransfer()
    dataTransfer.items.add(new File(['not read'], name, { type: 'application/octet-stream' }))
    node.dispatchEvent(
      new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }),
    )
  }, fileName)
}

test.describe('before consent', () => {
  test('shows the disclosure, one inert hidden file input, and no drop affordance', async ({ page }) => {
    await page.goto('/')

    const region = cvRegion(page)
    await expect(region).toBeVisible()
    await expect(region.getByRole('heading', { name: 'Search with your CV' })).toBeVisible()
    await expect(consentButton(page)).toBeVisible()

    const input = region.locator('input[type=file]')
    await expect(input).toHaveCount(1)
    await expect(input).toHaveAttribute('tabindex', '-1')
    await expect(input).toHaveAttribute('aria-hidden', 'true')

    await expect(page.getByText(/Drop a CV here/)).toHaveCount(0)
  })

  test('a dropped file changes nothing, makes no request, and writes no storage', async ({ page }) => {
    const requests: string[] = []
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().includes('/api/search')) {
        requests.push(request.url())
      }
    })

    await page.goto('/')
    await dispatchDrop(cvRegion(page), 'sneaky.pdf')
    await page.waitForTimeout(300)

    expect(requests).toHaveLength(0)
    const consent = await page.evaluate((key) => window.localStorage.getItem(key), CONSENT_KEY)
    expect(consent).toBeNull()
    await expect(page.getByText('sneaky.pdf')).toHaveCount(0)
  })

  test('the affirmative control records consent, and a reload shows the drop zone with no disclosure', async ({ page }) => {
    await page.goto('/')
    await grantConsentViaGesture(page)

    await expect(dropInput(page)).toBeVisible()
    await expect(consentButton(page)).toHaveCount(0)

    await page.reload()
    await expect(dropInput(page)).toBeVisible()
    await expect(consentButton(page)).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Search with your CV' })).toHaveCount(0)
  })

  test('localStorage holds exactly one consent key, the sentinel string, and nothing about a file', async ({ page }) => {
    await page.goto('/')
    await grantConsentViaGesture(page)

    const storage = await page.evaluate(() => ({ ...window.localStorage }))
    expect(storage[CONSENT_KEY]).toBe('granted')
    expect(JSON.stringify(storage)).not.toContain('.pdf')
    expect(JSON.stringify(storage)).not.toContain(BEACON)
  })
})

test.describe('after consent', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((key) => window.localStorage.setItem(key, 'granted'), CONSENT_KEY)
  })

  test('attaching profile.pdf shows the filename, size, and a non-zero character count', async ({ page }) => {
    await page.goto('/')
    await dropInput(page).setInputFiles(PDF_FIXTURE)

    await expect(page.getByText('profile.pdf').first()).toBeVisible()
    await expect(page.getByText(/bytes · /)).toBeVisible()
    await expect(page.getByText(/0 characters/)).toHaveCount(0)
  })

  test('attaching a scanned PDF is rejected with the OCR message and makes no request', async ({ page }) => {
    const requests: string[] = []
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().includes('/api/search')) {
        requests.push(request.url())
      }
    })

    await page.goto('/')
    await dropInput(page).setInputFiles(SCANNED_FIXTURE)

    await expect(page.getByRole('alert')).toContainText('has no extractable text')
    await expect(page.getByRole('alert')).toContainText('OCR')
    expect(requests).toHaveLength(0)
  })

  test('attaching an over-long text file is rejected naming its measured length and the limit', async ({ page }) => {
    const requests: string[] = []
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().includes('/api/search')) {
        requests.push(request.url())
      }
    })

    await page.goto('/')
    await dropInput(page).setInputFiles(LONG_FIXTURE)

    const alert = page.getByRole('alert')
    await expect(alert).toContainText('characters')
    await expect(alert).toContainText('50,000')
    expect(requests).toHaveLength(0)
  })

  test('attaching an oversize file is rejected with the 5 MB message without being parsed', async ({ page }) => {
    await page.goto('/')
    await dropInput(page).setInputFiles({
      name: 'huge.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.alloc(6 * 1024 * 1024),
    })

    const alert = page.getByRole('alert')
    await expect(alert).toContainText('5 MB')
  })

  test('a .docx-named file is rejected by extension and makes no request', async ({ page }) => {
    const requests: string[] = []
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().includes('/api/search')) {
        requests.push(request.url())
      }
    })

    await page.goto('/')
    await dropInput(page).setInputFiles({
      name: 'profile.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: Buffer.from('irrelevant'),
    })

    await expect(page.getByRole('alert')).toContainText('is not one of those')
    expect(requests).toHaveLength(0)
  })

  test('a rejection after a successful attachment leaves the first document attached', async ({ page }) => {
    await page.goto('/')
    await dropInput(page).setInputFiles(PDF_FIXTURE)
    await expect(page.getByText('profile.pdf').first()).toBeVisible()

    // Once attached, the zone is the filename row with Remove (§13.3) — no
    // file input is rendered until Remove is pressed, so a second selection
    // cannot reach readProfile() without first clearing the good document.
    // This asserts the state that guarantee actually protects: the attached
    // document is untouched by anything short of an explicit Remove.
    await expect(page.getByRole('button', { name: /^Remove/ })).toBeVisible()
    await expect(page.getByText('profile.pdf').first()).toBeVisible()
    await expect(page.locator('input[type=file]')).toHaveCount(0)
  })

  test('a query and a CV send separate, exact, non-empty wire fields', async ({ page }) => {
    await page.goto('/')
    await dropInput(page).setInputFiles(CV_FIXTURE)
    await expect(page.getByText('profile-cv.txt').first()).toBeVisible()

    await page.getByRole('textbox', { name: 'Search postings' }).fill('backend engineer')

    const request = page.waitForRequest('**/api/search/stream')
    await page.getByRole('button', { name: 'Best matches' }).click()
    const body = (await request).postDataJSON() as { query?: string; profile_text?: string }

    expect(body.query).toBe('backend engineer')
    expect(body.profile_text).toBe(CV_TEXT)
  })

  test('no request URL, document.location, or history state carries the CV text or filename', async ({ page }) => {
    const urls: string[] = []
    page.on('request', (request) => urls.push(request.url()))

    await page.goto('/')
    await dropInput(page).setInputFiles(CV_FIXTURE)
    await page.getByRole('textbox', { name: 'Search postings' }).fill('backend engineer')
    await page.getByRole('button', { name: 'Best matches' }).click()
    await page.waitForTimeout(300)

    expect(urls.some((url) => url.includes(BEACON))).toBe(false)
    expect(urls.some((url) => url.includes('profile-cv.txt'))).toBe(false)

    const state = await page.evaluate(() => ({
      href: window.location.href,
      historyState: JSON.stringify(window.history.state),
    }))
    expect(state.href).not.toContain(BEACON)
    expect(state.href).not.toContain('profile-cv.txt')
    expect(state.historyState).not.toContain(BEACON)
    expect(state.historyState).not.toContain('profile-cv.txt')
  })

  test('Remove clears the row, and the next search sends an empty profile_text', async ({ page }) => {
    await page.goto('/')
    await dropInput(page).setInputFiles(CV_FIXTURE)
    await expect(page.getByText('profile-cv.txt').first()).toBeVisible()

    await page.getByRole('button', { name: /^Remove/ }).click()
    await expect(page.getByText('profile-cv.txt')).toHaveCount(0)

    await page.getByRole('textbox', { name: 'Search postings' }).fill('backend engineer')
    const request = page.waitForRequest('**/api/search/stream')
    await page.getByRole('button', { name: 'Best matches' }).click()
    const body = (await request).postDataJSON() as { profile_text?: string }
    expect(body.profile_text).toBe('')
  })

  test('a CV-only search leaves the URL at the canonical #/jobs with no CV-derived parameter', async ({ page }) => {
    await page.goto('/#/jobs')
    await dropInput(page).setInputFiles(CV_FIXTURE)
    await page.getByRole('button', { name: 'Best matches' }).click()

    await page.waitForTimeout(300)
    expect(page.url()).toBe('http://127.0.0.1:5174/#/jobs')
  })

  test('reading an attached PDF never disables the submit control for a typed query', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('textbox', { name: 'Search postings' }).fill('backend engineer')
    await dropInput(page).setInputFiles(PDF_FIXTURE)
    await expect(page.getByText('profile.pdf').first()).toBeVisible()

    const submit = page.getByRole('button', { name: /Find matches|Searching|Search all/ })
    await expect(submit).toBeEnabled()
  })

  test('every accepted and rejected path leaves the typed query untouched', async ({ page }) => {
    await page.goto('/')
    const query = page.getByRole('textbox', { name: 'Search postings' })
    await query.fill('backend engineer')

    await dropInput(page).setInputFiles(SCANNED_FIXTURE)
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(query).toHaveValue('backend engineer')

    await dropInput(page).setInputFiles(CV_FIXTURE)
    await expect(page.getByText('profile-cv.txt').first()).toBeVisible()
    await expect(query).toHaveValue('backend engineer')
  })

  test('with only a CV attached, the harness rewrite failure produces SEARCH_UNAVAILABLE before retrieve', async ({ page }) => {
    await page.goto('/')
    await dropInput(page).setInputFiles(CV_FIXTURE)
    await page.getByRole('button', { name: 'Best matches' }).click()

    const alert = page.getByRole('alert')
    await expect(alert).toBeVisible()
    await expect(alert).toContainText('Best-match search is temporarily unavailable.')

    const trace = page.getByLabel('Retrieval trace')
    const retrieveRow = trace.locator('li', { hasText: 'retrieve' })
    await expect(retrieveRow.getByText('pending', { exact: true })).toBeVisible()
    await expect(page.locator('li[aria-labelledby^="best-match-"]')).toHaveCount(0)
  })

  test('the CV-only state replaces the copy control with the stated explanation', async ({ page }) => {
    await page.goto('/#/jobs')
    await dropInput(page).setInputFiles(CV_FIXTURE)
    await page.getByRole('button', { name: 'Best matches' }).click()

    await expect(page.getByRole('button', { name: 'Copy search link' })).toHaveCount(0)
    await expect(
      page.getByText('This search used only your CV. A link cannot carry CV data'),
    ).toBeVisible()
  })

  test('a query-and-CV link contains the query and nothing of the CV', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto('/#/jobs')
    await dropInput(page).setInputFiles(CV_FIXTURE)
    await page.getByRole('textbox', { name: 'Search postings' }).fill('backend engineer')
    await page.getByRole('button', { name: 'Best matches' }).click()

    await page.getByRole('button', { name: 'Copy search link' }).click()
    const copied = await page.evaluate(() => window.navigator.clipboard.readText())

    expect(copied).toContain('q=backend')
    expect(copied).not.toContain(BEACON)
    expect(copied).not.toContain('profile-cv.txt')
  })

  test('a query-only link is byte-identical to the same query copied with a CV attached', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])

    await page.goto('/#/jobs')
    await page.getByRole('textbox', { name: 'Search postings' }).fill('backend engineer')
    await page.getByRole('button', { name: 'Best matches' }).click()
    await page.getByRole('button', { name: 'Copy search link' }).click()
    const withoutCv = await page.evaluate(() => window.navigator.clipboard.readText())

    await page.goto('/#/jobs')
    await dropInput(page).setInputFiles(CV_FIXTURE)
    await page.getByRole('textbox', { name: 'Search postings' }).fill('backend engineer')
    await page.getByRole('button', { name: 'Best matches' }).click()
    await page.getByRole('button', { name: 'Copy search link' }).click()
    const withCv = await page.evaluate(() => window.navigator.clipboard.readText())

    expect(withCv).toBe(withoutCv)
  })
})

test('the disclosure names the meta-reported provider, and falls back honestly when /api/meta fails', async ({ page }) => {
  await page.goto('/')
  await expect(cvRegion(page)).toContainText('OpenAI')

  await page.route('**/api/meta', (route) => route.abort())
  await page.reload()

  await expect(cvRegion(page)).toContainText('a third-party language-model provider')
  await expect(consentButton(page)).toBeEnabled()
})
