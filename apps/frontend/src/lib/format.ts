export function splitTerms(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9+#.]+/).filter(Boolean)
}

export function formatSalary(
  minimum: number | null | undefined,
  maximum: number | null | undefined,
): string | null {
  if (!minimum && !maximum) return null

  const compact = (value: number): string => `$${Math.round(value / 1000)}k`
  if (minimum && maximum && minimum !== maximum) {
    return `${compact(minimum)}–${compact(maximum)}`
  }
  return compact(maximum ?? minimum ?? 0)
}

export function formatPostedMonth(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return null
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}
