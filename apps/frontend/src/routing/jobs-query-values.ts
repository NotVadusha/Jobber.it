export function firstValid<T>(
  params: URLSearchParams,
  name: string,
  decode: (value: string) => T | null,
): T | null {
  for (const value of params.getAll(name)) {
    const decoded = decode(value)
    if (decoded !== null) return decoded
  }
  return null
}

export function canonicalList<T extends string>(
  params: URLSearchParams,
  name: string,
  order: readonly T[],
): T[] {
  const values = params.getAll(name).flatMap(value => value.split(','))
  return orderedValues(values, order)
}

export function orderedValues<T extends string>(values: readonly string[], order: readonly T[]): T[] {
  const selected = new Set(values)
  return order.filter(value => selected.has(value))
}

export function integerInRange(
  value: number | null,
  minimum: number,
  maximum: number,
): number | null {
  if (value === null || !Number.isSafeInteger(value)) return null
  return value >= minimum && value <= maximum ? value : null
}

export function parseIntegerInRange(value: string, minimum: number, maximum: number): number | null {
  if (!/^\d+$/.test(value)) return null
  return integerInRange(Number(value), minimum, maximum)
}
