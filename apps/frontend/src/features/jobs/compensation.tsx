import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'

import { STORAGE_KEYS } from '@/lib/storage-keys'

export type CompensationPeriod = 'annual' | 'monthly'

type CompensationContextValue = {
  period: CompensationPeriod
  setPeriod(period: CompensationPeriod): void
}

export const COMPENSATION_PERIOD_STORAGE_KEY = STORAGE_KEYS.compensationPeriod

const CompensationContext = createContext<CompensationContextValue | null>(null)

const decodeCompensationPeriod = (value: unknown): CompensationPeriod | null => {
  return value === 'annual' || value === 'monthly' ? value : null
}

const readCompensationPeriod = (): CompensationPeriod => {
  try {
    return decodeCompensationPeriod(
      window.localStorage.getItem(COMPENSATION_PERIOD_STORAGE_KEY),
    ) ?? 'annual'
  } catch {
    return 'annual'
  }
}

const persistCompensationPeriod = (period: CompensationPeriod): void => {
  try {
    window.localStorage.setItem(COMPENSATION_PERIOD_STORAGE_KEY, period)
  } catch {
    // The current document still honors the choice when storage is unavailable.
  }
}

const displayedAmount = (value: number, period: CompensationPeriod): number => {
  return period === 'annual' ? value : value / 12
}

const compactUsd = (value: number): string => {
  if (value >= 1_000) {
    const thousands = value / 1_000
    const digits = thousands >= 100 || Number.isInteger(thousands) ? 0 : 1
    return `$${thousands.toFixed(digits)}k`
  }
  return `$${Math.round(value).toLocaleString('en-US')}`
}

export const compensationSuffix = (period: CompensationPeriod): '/yr' | '/mo' => {
  return period === 'annual' ? '/yr' : '/mo'
}

export const formatCompensationValue = (
  value: number,
  period: CompensationPeriod,
): string => {
  return `${compactUsd(displayedAmount(value, period))}${compensationSuffix(period)}`
}

export const formatCompensation = (
  minimum: number | null | undefined,
  maximum: number | null | undefined,
  period: CompensationPeriod,
): string | null => {
  const hasMinimum = minimum !== null && minimum !== undefined
  const hasMaximum = maximum !== null && maximum !== undefined
  if (!hasMinimum && !hasMaximum) return null

  if (hasMinimum && hasMaximum && minimum !== maximum) {
    const low = compactUsd(displayedAmount(minimum, period))
    const high = compactUsd(displayedAmount(maximum, period))
    return `${low}–${high}${compensationSuffix(period)}`
  }
  if (hasMinimum && !hasMaximum) {
    return `From ${formatCompensationValue(minimum, period)}`
  }
  if (!hasMinimum && hasMaximum) {
    return `Up to ${formatCompensationValue(maximum, period)}`
  }
  return formatCompensationValue(minimum ?? maximum ?? 0, period)
}

export const formatCompensationFloor = (
  minimum: number | null,
  includeUndisclosed: boolean,
  period: CompensationPeriod,
): string => {
  if (minimum === null) return 'Any salary'
  return `At least ${formatCompensationValue(minimum, period)}${
    includeUndisclosed ? ' or undisclosed' : ''
  }`
}

export function CompensationPeriodProvider({
  children,
}: {
  children: ReactNode
}): ReactElement {
  const [period, setStoredPeriod] = useState<CompensationPeriod>(readCompensationPeriod)

  const setPeriod = useCallback((next: CompensationPeriod) => {
    persistCompensationPeriod(next)
    setStoredPeriod(next)
  }, [])

  const value = useMemo(() => ({ period, setPeriod }), [period, setPeriod])

  return (
    <CompensationContext.Provider value={value}>
      {children}
    </CompensationContext.Provider>
  )
}

export const useCompensationPeriod = (): CompensationContextValue => {
  const value = useContext(CompensationContext)
  if (!value) {
    throw new Error(
      'useCompensationPeriod must be used inside CompensationPeriodProvider',
    )
  }
  return value
}
