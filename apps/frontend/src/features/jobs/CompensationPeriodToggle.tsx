import type { ReactElement } from 'react'

import { useCompensationPeriod } from '@/features/jobs/compensation'

export const CompensationPeriodToggle = (): ReactElement => {
  const { period, setPeriod } = useCompensationPeriod()

  return (
    <fieldset className="flex items-center gap-2">
      <legend className="sr-only">Salary display period</legend>
      <span aria-hidden="true" className="font-mono text-[11px] text-tertiary">
        salary
      </span>
      <div className="inline-flex rounded-sm border border-subtle bg-surface-raised p-0.5">
        {(['annual', 'monthly'] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={period === value}
            onClick={() => setPeriod(value)}
            className={`min-h-8 rounded-sm px-2.5 font-mono text-[11px] transition-colors ${
              period === value
                ? 'bg-accent text-accent-ink'
                : 'text-secondary hover:text-primary'
            }`}
          >
            {value === 'annual' ? 'annual' : 'monthly'}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
