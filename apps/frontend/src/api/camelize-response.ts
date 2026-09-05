type CamelCase<S extends string> =
  S extends `${infer P1}_${infer P2}${infer P3}`
    ? `${Lowercase<P1>}${Uppercase<P2>}${CamelCase<P3>}`
    : Lowercase<S>

export type KeysToCamelCase<Value> =
  Value extends readonly (infer Item)[]
    ? KeysToCamelCase<Item>[]
    : Value extends object
      ? {
          [Key in keyof Value as Key extends string ? CamelCase<Key> : Key]:
            KeysToCamelCase<Value[Key]>
        }
      : Value

const camelizeKey = (key: string): string => {
  return key
    .toLowerCase()
    .replace(/_([a-z0-9])/g, (_match, letter: string) => letter.toUpperCase())
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export const camelizeResponse = <Value>(value: Value): KeysToCamelCase<Value> => {
  if (Array.isArray(value)) {
    return value.map((item) => camelizeResponse(item)) as KeysToCamelCase<Value>
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        camelizeKey(key),
        camelizeResponse(item),
      ]),
    ) as KeysToCamelCase<Value>
  }

  return value as KeysToCamelCase<Value>
}
