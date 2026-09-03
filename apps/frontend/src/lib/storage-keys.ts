export const STORAGE_KEYS = {
  theme: 'jobber.theme.v1',
  compensationPeriod: 'jobber.compensation-period.v1',
  savedJobs: 'jobber.saved-jobs.v1',
  cvConsent: 'jobber.cv-consent.v1',
  changelog: 'jobber.changelog.v1',
} as const

export type StorageKeyName = keyof typeof STORAGE_KEYS

export type DeviceStorageEntry = {
  key: (typeof STORAGE_KEYS)[StorageKeyName]
  holds: string
  written: string
}

export const DEVICE_STORAGE: readonly DeviceStorageEntry[] = [
  {
    key: STORAGE_KEYS.theme,
    holds: 'Light or dark, once you choose one explicitly.',
    written: 'When you use the theme toggle.',
  },
  {
    key: STORAGE_KEYS.compensationPeriod,
    holds: 'Whether salaries are shown per year or per month.',
    written: 'When you change the display period.',
  },
  {
    key: STORAGE_KEYS.savedJobs,
    holds:
      'The postings you saved: their identifier, title, company, source, and when you saved them.',
    written: 'When you save a posting.',
  },
  {
    key: STORAGE_KEYS.cvConsent,
    holds: 'That the CV disclosure was shown and accepted. Nothing about any file.',
    written: 'When you first use CV upload.',
  },
  {
    key: STORAGE_KEYS.changelog,
    holds: 'A copy of the published release notes and when it was fetched.',
    written: 'When you open the Changelog page.',
  },
]
