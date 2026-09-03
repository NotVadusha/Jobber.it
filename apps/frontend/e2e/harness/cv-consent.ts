import type { Page } from '@playwright/test'

const CV_CONSENT_STORAGE_KEY = 'jobber.cv-consent.v1'

export const grantCvConsent = async (page: Page): Promise<void> => {
  await page.addInitScript(
    (key) => window.localStorage.setItem(key, 'granted'),
    CV_CONSENT_STORAGE_KEY,
  )
}
