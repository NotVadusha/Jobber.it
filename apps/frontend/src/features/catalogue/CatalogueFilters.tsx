import {
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'

import { formatCompensationFloor, useCompensationPeriod } from '@/features/jobs/compensation'
import { sourceLabel, type PostingSource } from '@/features/jobs/source-labels'
import {
  POSTED_VALUES,
  SENIORITY_VALUES,
  SOURCE_VALUES,
  WORKPLACE_VALUES,
  type JobsUrlFilters,
} from '@/routing/jobs-url'

import './catalogue.css'

type Workplace = JobsUrlFilters['remote_policy'][number]
type Seniority = JobsUrlFilters['seniority'][number]
type PostedWithin = NonNullable<JobsUrlFilters['posted_within']>

const WORKPLACE_LABELS: Record<Workplace, string> = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'On-site',
}

const SENIORITY_LABELS: Record<Seniority, string> = {
  intern: 'Intern',
  junior: 'Junior',
  mid: 'Mid',
  senior: 'Senior',
  lead: 'Lead',
  principal: 'Principal',
}

const POSTED_LABELS: Record<PostedWithin, string> = {
  '24h': '24 hours',
  '7d': '7 days',
  '30d': '30 days',
}

export type CatalogueFiltersProps = {
  filters: JobsUrlFilters
  activeCount: number
  onChange(filters: JobsUrlFilters): void
  onClear(): void
}

function selectedValues<T extends string>(
  values: readonly T[],
  value: T,
  order: readonly T[],
): T[] {
  const selected = new Set(values)
  if (selected.has(value)) selected.delete(value)
  else selected.add(value)
  return order.filter((item) => selected.has(item))
}

function FilterGroup({
  title,
  output,
  children,
}: {
  title: string
  output?: string
  children: ReactNode
}): ReactElement {
  return (
    <fieldset>
      <legend className="flex w-full items-center justify-between gap-3 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-tertiary">
        <span>{title}</span>
        {output && <span className="normal-case tracking-normal text-accent">{output}</span>}
      </legend>
      <div className="mt-2.5">{children}</div>
    </fieldset>
  )
}

function Pill({
  pressed,
  children,
  onClick,
}: {
  pressed: boolean
  children: ReactNode
  onClick(): void
}): ReactElement {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`min-h-9 rounded-full border px-3 font-mono text-xs transition-colors ${
        pressed
          ? 'border-accent bg-accent-soft font-semibold text-accent'
          : 'border-subtle bg-surface-raised text-secondary hover:border-strong hover:text-primary'
      }`}
    >
      {children}
    </button>
  )
}

function FilterFields({
  idPrefix,
  filters,
  activeCount,
  onChange,
  onClear,
}: CatalogueFiltersProps & { idPrefix: string }): ReactElement {
  const { period } = useCompensationPeriod()
  const experienceValue = filters.experience_years ?? 61
  const salaryValue = filters.min_salary ?? 0
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

      <FilterGroup title="Candidate experience" output={experienceOutput}>
        <input
          id={`${idPrefix}-experience`}
          type="range"
          min="0"
          max="61"
          step="1"
          value={experienceValue}
          aria-label="Candidate experience"
          aria-valuetext={experienceOutput}
          onChange={(event) => {
            const value = Number(event.currentTarget.value)
            onChange({
              ...filters,
              experience_years: value === 61 ? null : value,
            })
          }}
          className="w-full accent-accent"
        />
        <div aria-hidden="true" className="mt-1.5 flex justify-between font-mono text-[10px] text-tertiary">
          <span>0 years</span><span>Any</span>
        </div>
      </FilterGroup>

      <FilterGroup title="Minimum salary" output={salaryOutput}>
        <input
          id={`${idPrefix}-salary`}
          type="range"
          min="0"
          max="1000000"
          step="5000"
          value={salaryValue}
          aria-label="Minimum salary"
          aria-valuetext={salaryOutput}
          onChange={(event) => {
            const value = Number(event.currentTarget.value)
            onChange({
              ...filters,
              min_salary: value === 0 ? null : value,
              include_undisclosed_salary:
                value === 0 ? false : filters.include_undisclosed_salary,
            })
          }}
          className="w-full accent-accent"
        />
        <div aria-hidden="true" className="mt-1.5 flex justify-between font-mono text-[10px] text-tertiary">
          <span>Any</span><span>$1m/yr</span>
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
            Include postings with undisclosed salary
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

      <FilterGroup title="Source adapter">
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

export function CatalogueFilters({
  filters,
  activeCount,
  onChange,
  onClear,
}: CatalogueFiltersProps): ReactElement {
  const [open, setOpen] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const openerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    const media = window.matchMedia('(min-width: 64rem)')
    const closeAtDesktop = () => {
      if (media.matches) setOpen(false)
    }
    media.addEventListener('change', closeAtDesktop)
    return () => media.removeEventListener('change', closeAtDesktop)
  }, [])

  const fields = { filters, activeCount, onChange, onClear }

  return (
    <>
      <div className="col-span-full lg:hidden">
        <button
          ref={openerRef}
          type="button"
          aria-expanded={open}
          aria-controls="catalogue-filter-drawer"
          onClick={() => setOpen(true)}
          className="min-h-10 rounded-sm border border-subtle bg-surface px-3 font-mono text-xs text-secondary hover:border-accent hover:text-accent"
        >
          Filters{activeCount ? ` (${activeCount})` : ''}
        </button>
      </div>

      <aside
        aria-label="Posting filters"
        className="sticky top-[calc(var(--layout-header-height)+1.5rem)] hidden max-h-[calc(100dvh-var(--layout-header-height)-3rem)] overflow-y-auto rounded-lg border border-subtle bg-surface p-5 lg:block"
      >
        <FilterFields idPrefix="desktop-filter" {...fields} />
      </aside>

      <dialog
        ref={dialogRef}
        id="catalogue-filter-drawer"
        aria-labelledby="catalogue-filter-drawer-title"
        onCancel={(event) => {
          event.preventDefault()
          setOpen(false)
        }}
        onClose={() => {
          setOpen(false)
          window.requestAnimationFrame(() => openerRef.current?.focus())
        }}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpen(false)
        }}
        className="catalogue-filter-drawer"
      >
        <div className="min-h-full bg-surface p-5 text-primary">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2
              id="catalogue-filter-drawer-title"
              className="font-mono text-sm font-semibold text-primary"
            >
              Filter postings
            </h2>
            <button
              type="button"
              autoFocus
              aria-label="Close filters"
              onClick={() => setOpen(false)}
              className="grid size-10 place-items-center rounded-sm border border-subtle text-secondary hover:border-accent hover:text-accent"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
          <FilterFields idPrefix="mobile-filter" {...fields} />
        </div>
      </dialog>
    </>
  )
}
