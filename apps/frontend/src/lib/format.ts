export const splitTerms = (text: string): string[] => {
  return text.toLowerCase().split(/[^a-z0-9+#.]+/).filter(Boolean)
}

export const formatPostedMonth = (value: string | null | undefined): string | null => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return null
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export type PostingDatePresentation = {
  dateTime: string
  label: string
}

const postingDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

export const formatPostingDate = (
  postedAt: string | null | undefined,
  firstSeenAt: string | null | undefined,
): PostingDatePresentation | null => {
  const value = postedAt ?? firstSeenAt
  if (!value) return null

  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return null

  return {
    dateTime: value,
    label: `${postedAt ? 'Posted' : 'Discovered'} ${postingDateFormatter.format(date)}`,
  }
}

const absoluteDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

export const formatAbsoluteDate = (
  value: string | null | undefined,
): PostingDatePresentation | null => {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.valueOf())) return null
  return {
    label: absoluteDateFormatter.format(parsed),
    dateTime: parsed.toISOString(),
  }
}
