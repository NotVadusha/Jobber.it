import type { ReactElement } from 'react'

import { FilterGroup } from '@/features/catalogue/FilterGroup'
import { Pill } from '@/features/catalogue/Pill'
import { formatCompensationFloor, useCompensationPeriod } from '@/features/jobs/compensation'
import {
  POSTED_LABELS,
  SENIORITY_LABELS,
  WORKPLACE_LABELS,
} from '@/features/jobs/posting-labels'
import { sourceLabel, type PostingSource } from '@/features/jobs/source-labels'
import {
  POSTED_VALUES,
  SENIORITY_VALUES,
  SOURCE_VALUES,
  WORKPLACE_VALUES,
  type JobsUrlFilters,
} from '@/routing/jobs-model'

export type FilterFieldsProps = {
  idPrefix: string
  filters: JobsUrlFilters
  activeCount: number
  onChange(filters: JobsUrlFilters): void
  onClear(): void
}

const selectedValues = <T extends string>(
  values: readonly T[],
  value: T,
  order: readonly T[],
): T[] => {
  const selected = new Set(values)
  if (selected.has(value)) selected.delete(value)
  else selected.add(value)
  return order.filter((item) => selected.has(item))
}

export const FilterFields = ({
  idPrefix,
  filters,
  activeCount,
  onChange,
  onClear,
}: FilterFieldsProps): ReactElement => {
  const { period } = useCompensationPeriod()
  const experienceValue = filters.experience_years ?? ''
  const salaryValue = filters.min_salary ?? ''
  const experienceOutput = filters.experience_years === null
    ? 'Any experience'
    : `I have ${filters.experience_years} ${filters.experience_years === 1 ? 'year' : 'years'}`
  const salaryOutput = formatCompensationFloor(
    filters.min_salary,
    filters.include_undisclosed_salary,
    period,
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-secondary">
            Filters
          </h2>
          <p className="mt-1 font-mono text-[10px] text-tertiary">
            {activeCount} active
          </p>
        </div>
        <button
          type="button"
          disabled={activeCount === 0}
          onClick={onClear}
          className="min-h-9 rounded-sm px-2 font-mono text-xs text-accent hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
        >
          Clear all
        </button>
      </div>

      <FilterGroup title="Workplace">
        <div className="flex flex-wrap gap-1.5">
          {WORKPLACE_VALUES.map((value) => (
            <Pill
              key={value}
              pressed={filters.remote_policy.includes(value)}
              onClick={() => onChange({
                ...filters,
                remote_policy: selectedValues(
                  filters.remote_policy,
                  value,
                  WORKPLACE_VALUES,
                ),
              })}
            >
              {WORKPLACE_LABELS[value]}
            </Pill>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Seniority">
        <div className="flex flex-wrap gap-1.5">
          {SENIORITY_VALUES.map((value) => (
            <Pill
              key={value}
              pressed={filters.seniority.includes(value)}
              onClick={() => onChange({
                ...filters,
                seniority: selectedValues(filters.seniority, value, SENIORITY_VALUES),
              })}
            >
              {SENIORITY_LABELS[value]}
            </Pill>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Candidate experience">
        <div className="relative">
          <input
            id={`${idPrefix}-experience`}
            type="number"
            min="0"
            max="60"
            step="1"
            value={experienceValue}
            aria-label="Candidate experience"
            aria-valuetext={experienceOutput}
            aria-describedby={`${idPrefix}-experience-summary`}
            onChange={(event) => {
              const raw = event.currentTarget.value
              const value = Number(raw)
              if (!Number.isInteger(value) || value < 0 || value > 60) return
              onChange({
                ...filters,
                experience_years: raw === '' ? null : value,
              })
            }}
            placeholder="Any"
            className="min-h-10 w-full appearance-textfield rounded-sm border border-strong bg-canvas pl-3 pr-10 text-sm text-primary [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          {filters.experience_years !== null && (
            <button
              type="button"
              aria-label="Clear candidate experience"
              onClick={() => onChange({ ...filters, experience_years: null })}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center border-0 bg-transparent text-secondary hover:text-primary"
            >
              <span aria-hidden="true" className="text-xl leading-none">×</span>
            </button>
          )}
        </div>
        <p id={`${idPrefix}-experience-summary`} className="mt-2 text-xs text-secondary">
          {experienceOutput}
        </p>
      </FilterGroup>

      <FilterGroup title="Minimum salary · USD/year">
        <div className="relative">
          <input
            id={`${idPrefix}-salary`}
            type="number"
            min="0"
            max="1000000"
            step="1"
            value={salaryValue}
            aria-label="Minimum salary"
            aria-valuetext={salaryOutput}
            onChange={(event) => {
              const raw = event.currentTarget.value
              const value = Number(raw)
              if (!Number.isInteger(value) || value < 0 || value > 1_000_000) return
              onChange({
                ...filters,
                min_salary: raw === '' || value === 0 ? null : value,
                include_undisclosed_salary:
                  value === 0 ? false : filters.include_undisclosed_salary,
              })
            }}
            placeholder="Any"
            className="min-h-10 w-full appearance-textfield rounded-sm border border-strong bg-canvas pl-3 pr-10 text-sm text-primary [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          {filters.min_salary !== null && (
            <button
              type="button"
              aria-label="Clear minimum salary"
              onClick={() => onChange({ ...filters, min_salary: null, include_undisclosed_salary: false })}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center border-0 bg-transparent text-secondary hover:text-primary"
            >
              <span aria-hidden="true" className="text-xl leading-none">×</span>
            </button>
          )}
        </div>
        {filters.min_salary !== null && (
          <label className="mt-3 flex min-h-9 cursor-pointer items-center gap-2 text-xs leading-snug text-secondary">
            <input
              type="checkbox"
              checked={filters.include_undisclosed_salary}
              onChange={(event) => onChange({
                ...filters,
                include_undisclosed_salary: event.currentTarget.checked,
              })}
              className="size-4 accent-accent"
            />
            Include undisclosed salaries
          </label>
        )}
      </FilterGroup>

      <FilterGroup title="Posted within">
        <div className="flex flex-wrap gap-1.5">
          <Pill
            pressed={filters.posted_within === null}
            onClick={() => onChange({ ...filters, posted_within: null })}
          >
            Any time
          </Pill>
          {POSTED_VALUES.map((value) => (
            <Pill
              key={value}
              pressed={filters.posted_within === value}
              onClick={() => onChange({ ...filters, posted_within: value })}
            >
              {POSTED_LABELS[value]}
            </Pill>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Source">
        <div className="flex flex-col gap-1">
          {SOURCE_VALUES.map((source) => {
            const inputId = `${idPrefix}-source-${source}`
            return (
              <label
                key={source}
                htmlFor={inputId}
                className="flex min-h-9 cursor-pointer items-center gap-2 rounded-sm px-1 text-xs text-secondary hover:bg-surface-raised hover:text-primary"
              >
                <input
                  id={inputId}
                  type="checkbox"
                  checked={filters.source.includes(source)}
                  onChange={() => onChange({
                    ...filters,
                    source: selectedValues(
                      filters.source,
                      source,
                      SOURCE_VALUES,
                    ),
                  })}
                  className="size-4 accent-accent"
                />
                {sourceLabel(source as PostingSource)}
              </label>
            )
          })}
        </div>
      </FilterGroup>
    </div>
  )
}
