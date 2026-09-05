import { expect, test } from '@playwright/test'

// Exercises production routing exclusively through direct URLs, visible
// controls, native anchors, Back/Forward, and browser history — this spec
// imports no routing module directly (see docs/plans/03-routing-and-shareable-state.md §18).

const metaWire = {
  data: { corpus_size: 321, sources: ['greenhouse', 'djinni'], retrieval: 'hybrid+rerank' },
  meta: { request_id: 'req-meta' },
}

const searchWire = {
  data: {
    query: 'postgres',
    terms: ['postgres'],
    results: [],
    filters_applied: [],
    corpus_size: 321,
    trace: [],
  },
  meta: { request_id: 'req-search', took_ms: 12.5 },
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/meta', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', json: metaWire })
  })
})

async function mockSearch(page: import('@playwright/test').Page) {
  let requests = 0
  await page.route('**/api/search', async (route) => {
    requests += 1
    await route.fulfill({ status: 200, contentType: 'application/json', json: searchWire })
  })
  return () => requests
}

test.describe('canonical jobs URL', () => {
  test('bare root canonicalizes to #/jobs', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/#\/jobs$/)
  })

  test('the #/ alias canonicalizes to #/jobs', async ({ page }) => {
    await page.goto('/#/')
    await expect(page).toHaveURL(/#\/jobs$/)
  })

  test('a bare query defaults to best matches and omits view', async ({ page }) => {
    await page.goto('/#/jobs?q=python')
    await expect(page).toHaveURL('http://127.0.0.1:5173/#/jobs?q=python')
  })

  test('view=best with no query collapses to plain jobs', async ({ page }) => {
    await page.goto('/#/jobs?view=best')
    await expect(page).toHaveURL(/#\/jobs$/)
  })

  test('explicit view=all is preserved alongside a query', async ({ page }) => {
    await page.goto('/#/jobs?view=all&q=python')
    await expect(page).toHaveURL('http://127.0.0.1:5173/#/jobs?view=all&q=python')
  })

  test('duplicate and unordered multi-values canonicalize into fixed order', async ({ page }) => {
    await page.goto('/#/jobs?workplace=onsite,remote&workplace=remote,hybrid')
    await expect(page).toHaveURL(/#\/jobs\?workplace=remote,hybrid,onsite$/)
  })

  test('unknown parameters and invalid enum values are dropped', async ({ page }) => {
    await page.goto('/#/jobs?bogus=1&view=weird&seniority=wizard')
    await expect(page).toHaveURL(/#\/jobs$/)
  })

  test('a 501-character query truncates to 500', async ({ page }) => {
    await page.goto(`/#/jobs?q=${'x'.repeat(501)}`)
    await expect(page.getByRole('textbox', { name: 'Query' })).toHaveValue('x'.repeat(500))
    await expect(page).toHaveURL(new RegExp(`q=${'x'.repeat(500)}$`))
  })

  test('an undisclosed-salary flag without a floor is dropped', async ({ page }) => {
    await page.goto('/#/jobs?undisclosedSalary=1')
    await expect(page).toHaveURL(/#\/jobs$/)
  })

  test('an undisclosed-salary flag with a valid floor is kept in order', async ({ page }) => {
    await page.goto('/#/jobs?undisclosedSalary=1&minSalary=90000')
    await expect(page).toHaveURL(/#\/jobs\?minSalary=90000&undisclosedSalary=1$/)
  })

  test('sort and page are stripped from best-match state', async ({ page }) => {
    await page.goto('/#/jobs?q=python&sort=salary&page=3')
    await expect(page).toHaveURL('http://127.0.0.1:5173/#/jobs?q=python')
  })

  test('the full parameter table round-trips in canonical order', async ({ page }) => {
    await page.goto(
      '/#/jobs?source=linkedin,djinni&posted=7d&undisclosedSalary=1&minSalary=90000' +
        '&experience=5&seniority=lead,senior&workplace=hybrid,remote&q=postgres%20kafka&view=all',
    )
    await expect(page).toHaveURL(
      'http://127.0.0.1:5173/#/jobs?view=all&q=postgres%20kafka&workplace=remote,hybrid' +
        '&seniority=senior,lead&experience=5&minSalary=90000&undisclosedSalary=1' +
        '&posted=7d&source=djinni,linkedin',
    )
  })

  const numericCases = [
    {
      name: 'zero experience and the minimum salary remain valid',
      query: 'experience=0&minSalary=1&page=1',
      expected: '#/jobs?experience=0&minSalary=1',
    },
    {
      name: 'inclusive upper numeric bounds remain valid',
      query: 'experience=60&minSalary=1000000&page=9007199254740991',
      expected: '#/jobs?experience=60&minSalary=1000000&page=9007199254740991',
    },
    {
      name: 'values above numeric bounds are dropped',
      query: 'experience=61&minSalary=1000001&page=9007199254740992',
      expected: '#/jobs',
    },
    {
      name: 'values below numeric bounds are dropped',
      query: 'experience=-1&minSalary=0&page=0',
      expected: '#/jobs',
    },
    {
      name: 'decimal and exponent syntax are rejected in integer parameters',
      query: 'experience=1.5&minSalary=1e3&page=2.0',
      expected: '#/jobs',
    },
  ]

  for (const { name, query, expected } of numericCases) {
    test(name, async ({ page }) => {
      await page.goto(`/#/jobs?${query}`)
      await expect(page).toHaveURL(`http://127.0.0.1:5173/${expected}`)
    })
  }

  test('invalid repeated scalar values are skipped and the first valid value wins', async ({ page }) => {
    await page.goto(
      '/#/jobs?view=invalid&view=all&view=best&experience=bad&experience=0&experience=5' +
        '&minSalary=0&minSalary=100&minSalary=200&posted=invalid&posted=7d&posted=30d' +
        '&page=0&page=2&page=3',
    )
    await expect(page).toHaveURL(
      'http://127.0.0.1:5173/#/jobs?experience=0&minSalary=100&posted=7d&page=2',
    )
  })

  test('Unicode and reserved query characters survive canonicalization and submission', async ({ page }) => {
    await mockSearch(page)
    await page.goto('/#/jobs?q=%20C%2B%2B+%C4%8Desk%C3%BD+%3F+%26+%2F%20')
    const expectedUrl = 'http://127.0.0.1:5173/#/jobs?q=C%2B%2B%20%C4%8Desk%C3%BD%20%3F%20%26%20%2F'

    await expect(page.getByRole('textbox', { name: 'Query' })).toHaveValue('C++ český ? & /')
    await expect(page).toHaveURL(expectedUrl)
    await page.getByRole('button', { name: 'Search' }).click()
    await expect(page).toHaveURL(expectedUrl)
  })
})

test.describe('route matrix', () => {
  test('a recognized but inactive job route falls back to jobs', async ({ page }) => {
    await page.goto('/#/job/greenhouse%3A123')
    await expect(page).toHaveURL(/#\/jobs$/)
  })

  test('a job id with an unrecognized source falls back to jobs', async ({ page }) => {
    await page.goto('/#/job/unknown%3A1')
    await expect(page).toHaveURL(/#\/jobs$/)
  })

  test('malformed percent-encoding falls back to jobs', async ({ page }) => {
    await page.goto('/#/job/%E0%A4%A')
    await expect(page).toHaveURL(/#\/jobs$/)
  })

  for (const name of ['saved', 'ranking', 'privacy', 'changelog', 'about']) {
    test(`the recognized-but-inactive static route "${name}" falls back to jobs`, async ({ page }) => {
      await page.goto(`/#/${name}`)
      await expect(page).toHaveURL(/#\/jobs$/)
    })
  }

  test('a wholly unknown route falls back to jobs', async ({ page }) => {
    await page.goto('/#/does-not-exist')
    await expect(page).toHaveURL(/#\/jobs$/)
  })
})

test.describe('history', () => {
  test('canonical replacements and search pushes preserve unrelated history state', async ({ page }) => {
    await mockSearch(page)
    await page.goto('/')
    await expect(page).toHaveURL(/#\/jobs$/)
    const originalEntryId = await page.evaluate(() => {
      const state = window.history.state
      window.history.replaceState(
        { ...state, anotherApp: { expanded: true } },
        '',
        '#/jobs?bogus=1',
      )
      window.dispatchEvent(new PopStateEvent('popstate'))
      return state.jobber.entryId
    })

    await expect(page).toHaveURL(/#\/jobs$/)
    expect(await page.evaluate(() => window.history.state)).toMatchObject({
      anotherApp: { expanded: true },
      jobber: { entryId: originalEntryId },
    })

    await page.getByRole('textbox', { name: 'Query' }).fill('postgres')
    await page.getByRole('button', { name: 'Search' }).click()
    await expect(page).toHaveURL(/q=postgres$/)
    const pushedState = await page.evaluate(() => window.history.state)
    expect(pushedState.anotherApp).toEqual({ expanded: true })
    expect(pushedState.jobber.entryId).not.toBe(originalEntryId)

    await page.goBack()
    await expect(page).toHaveURL(/#\/jobs$/)
    expect(await page.evaluate(() => window.history.state)).toMatchObject({
      anotherApp: { expanded: true },
      jobber: { entryId: originalEntryId },
    })
  })

  test('a direct in-page hash edit is picked up and canonicalized once', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      window.location.hash = '#/jobs?workplace=onsite,remote'
    })
    await expect(page).toHaveURL(/#\/jobs\?workplace=remote,onsite$/)
  })

  test('inactive-route canonicalization does not add a back entry', async ({ page }) => {
    const requests = await mockSearch(page)
    await page.goto('/#/about')
    await expect(page).toHaveURL(/#\/jobs$/)

    await page.getByRole('textbox', { name: 'Query' }).fill('postgres')
    await page.getByRole('button', { name: 'Search' }).click()
    await expect(page).toHaveURL(/#\/jobs\?q=postgres$/)
    expect(requests()).toBe(1)

    await page.goBack()
    // The #/about -> #/jobs canonicalization replaced rather than pushed, so
    // one Back reaches the plain jobs route, not the rejected #/about hash.
    await expect(page).toHaveURL(/#\/jobs$/)
    expect(page.url()).not.toContain('about')
  })

  test('resubmitting the same query renews the execution id without a new entry', async ({ page }) => {
    await mockSearch(page)
    await page.goto('/#/jobs?q=postgres')
    const beforeId = await page.evaluate(() => (window.history.state as { jobber?: { entryId?: string } })?.jobber?.entryId)
    const beforeLength = await page.evaluate(() => window.history.length)

    await page.getByRole('button', { name: 'Search' }).click()

    await expect(page).toHaveURL(/#\/jobs\?q=postgres$/)
    const afterId = await page.evaluate(() => (window.history.state as { jobber?: { entryId?: string } })?.jobber?.entryId)
    const afterLength = await page.evaluate(() => window.history.length)
    expect(afterId).not.toBe(beforeId)
    expect(afterLength).toBe(beforeLength)
  })

  test('back and forward move between distinct searches', async ({ page }) => {
    await mockSearch(page)
    await page.goto('/')
    const input = page.getByRole('textbox', { name: 'Query' })
    const submit = page.getByRole('button', { name: 'Search' })

    await input.fill('postgres')
    await submit.click()
    await expect(page).toHaveURL(/q=postgres$/)

    await input.fill('kafka')
    await submit.click()
    await expect(page).toHaveURL(/q=kafka$/)

    await page.goBack()
    await expect(page).toHaveURL(/q=postgres$/)
    await expect(input).toHaveValue('postgres')

    await page.goForward()
    await expect(page).toHaveURL(/q=kafka$/)
    await expect(input).toHaveValue('kafka')
  })
})

test.describe('search integration', () => {
  test('direct-opening a shared query and filters URL hydrates and reruns automatically', async ({ page }) => {
    const requests = await mockSearch(page)

    await page.goto('/#/jobs?q=postgres&workplace=remote,hybrid&seniority=senior')

    await expect(page.getByRole('textbox', { name: 'Query' })).toHaveValue('postgres')
    await expect(page.getByRole('button', { name: 'remote' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('button', { name: 'hybrid' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('button', { name: 'onsite' })).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByRole('combobox')).toHaveValue('senior')
    await expect.poll(() => requests()).toBe(1)
  })

  test('submitting sends query, filters and profile as separate wire fields', async ({ page }) => {
    let body: unknown
    await page.route('**/api/search', async (route) => {
      body = route.request().postDataJSON()
      await route.fulfill({ status: 200, contentType: 'application/json', json: searchWire })
    })

    await page.goto('/')
    await page.getByRole('button', { name: 'remote' }).click()
    await page.getByRole('textbox', { name: 'Query' }).fill('postgres')
    await page.getByRole('button', { name: 'Search' }).click()

    await expect(page).toHaveURL(/#\/jobs\?q=postgres&workplace=remote$/)
    expect(body).toMatchObject({
      query: 'postgres',
      profile_text: '',
      filters: { remote_policy: ['remote'] },
    })
  })

  test('a CV-only search never touches the URL', async ({ page }) => {
    await mockSearch(page)
    await page.goto('/')
    await page.getByLabel(/Attach a CV/).setInputFiles({
      name: 'profile.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Python postgres experience'),
    })
    await page.getByRole('button', { name: 'Search' }).click()

    await expect(page).toHaveURL(/#\/jobs$/)
    expect(page.url()).not.toContain('profile')
    expect(page.url()).not.toContain('q=')
  })

  test('combined query and CV shares only the query in the URL', async ({ page }) => {
    let body: { profile_text?: string } | undefined
    await page.route('**/api/search', async (route) => {
      body = route.request().postDataJSON()
      await route.fulfill({ status: 200, contentType: 'application/json', json: searchWire })
    })

    await page.goto('/')
    await page.getByLabel(/Attach a CV/).setInputFiles({
      name: 'profile.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Python postgres experience'),
    })
    await page.getByRole('textbox', { name: 'Query' }).fill('postgres')
    await page.getByRole('button', { name: 'Search' }).click()

    await expect(page).toHaveURL(/#\/jobs\?q=postgres$/)
    expect(page.url()).not.toContain('profile')
    expect(body?.profile_text).toContain('Python postgres experience')
  })
})

test.describe('entry-scoped result restoration', () => {
  test('back to a prior same-tab entry restores its result without refetching; reload reruns', async ({ page }) => {
    const requests = await mockSearch(page)
    await page.goto('/')
    const input = page.getByRole('textbox', { name: 'Query' })
    const submit = page.getByRole('button', { name: 'Search' })

    await input.fill('postgres')
    await submit.click()
    await expect(page).toHaveURL(/q=postgres$/)
    await expect(page.getByText('Nothing cleared the filters.')).toBeVisible()
    expect(requests()).toBe(1)

    await input.fill('kafka')
    await submit.click()
    await expect(page).toHaveURL(/q=kafka$/)
    expect(requests()).toBe(2)

    await page.goBack()
    await expect(page).toHaveURL(/q=postgres$/)
    await expect(page.getByText('Nothing cleared the filters.')).toBeVisible()
    expect(requests()).toBe(2)

    await page.reload()
    await expect(page).toHaveURL(/q=postgres$/)
    await expect.poll(() => requests()).toBe(3)
  })
})

test.describe('native link behavior', () => {
  test('the logo is a native anchor that navigates back to jobs', async ({ page }) => {
    await mockSearch(page)
    await page.goto('/')
    await page.getByRole('textbox', { name: 'Query' }).fill('postgres')
    await page.getByRole('button', { name: 'Search' }).click()
    await expect(page).toHaveURL(/q=postgres$/)

    await page.getByRole('link', { name: 'jobber.it' }).click()
    await expect(page).toHaveURL(/#\/jobs$/)
  })

  test('middle-click on the logo opens a new tab and leaves the current entry untouched', async ({ page, context }) => {
    await page.goto('/#/jobs?q=postgres')
    const before = await page.evaluate(() => window.location.hash)

    const popupPromise = context.waitForEvent('page')
    await page.getByRole('link', { name: 'jobber.it' }).click({ button: 'middle' })
    const popup = await popupPromise
    await popup.waitForLoadState()

    expect(await popup.evaluate(() => window.location.hash)).toBe('#/jobs')
    expect(await page.evaluate(() => window.location.hash)).toBe(before)
    await popup.close()
  })
})
