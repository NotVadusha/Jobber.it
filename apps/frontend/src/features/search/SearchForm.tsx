import type { ReactNode } from 'react'

import type { components } from '@/api/schema'
import type { ProfileDocument } from '@/features/cv/read-profile'

type RemoteFilter = components['schemas']['RemoteFilter']
type SeniorityFilter = components['schemas']['SeniorityFilter']

const REMOTE: RemoteFilter[] = ['remote', 'hybrid', 'onsite']
const SENIORITY: SeniorityFilter[] = ['intern', 'junior', 'mid', 'senior', 'lead', 'principal']

export const QUERY_MAX_LENGTH = 500

export type SearchFormProps = {
  query: string
  remote: RemoteFilter[]
  seniority: SeniorityFilter | ''
  experienceYears: string
  minSalary: string
  profile: ProfileDocument | null
  busy: boolean
  onQueryChange: (value: string) => void
  onRemoteToggle: (value: RemoteFilter) => void
  onSeniorityChange: (value: SeniorityFilter | '') => void
  onExperienceYearsChange: (value: string) => void
  onMinSalaryChange: (value: string) => void
  onProfileSelect: (file: File | null) => void
  onProfileRemove: () => void
  onSubmit: () => void
}

// Plan 2 owns reusable UI extraction; these stay feature-local until then.
export function Label({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">{children}</span>
  )
}

function Toggle({ on, onClick, children }: {
  on: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`border px-2.5 py-1 font-mono text-xs transition-colors ${
        on
          ? 'border-lex bg-lex/10 text-lex'
          : 'border-line text-muted hover:border-edge hover:text-paper'
      }`}
    >
      {children}
    </button>
  )
}

function NumberField({ label, value, onChange, placeholder }: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="font-mono text-xs text-muted">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min="0"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-24 border border-line bg-transparent px-2 py-1 font-mono text-xs text-paper
                   placeholder:text-muted/60 hover:border-edge focus:border-lex focus:outline-none"
      />
    </label>
  )
}

export function SearchForm({
  query,
  remote,
  seniority,
  experienceYears,
  minSalary,
  profile,
  busy,
  onQueryChange,
  onRemoteToggle,
  onSeniorityChange,
  onExperienceYearsChange,
  onMinSalaryChange,
  onProfileSelect,
  onProfileRemove,
  onSubmit,
}: SearchFormProps) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <label htmlFor="q" className="sr-only">Query</label>
      <div className="flex items-center gap-3 border-b-2 border-edge py-3 transition-colors focus-within:border-lex">
        <span aria-hidden="true" className="font-mono text-lg text-lex">›</span>
        <input
          id="q"
          value={query}
          autoFocus
          maxLength={QUERY_MAX_LENGTH}
          onChange={(event) =>
            onQueryChange(event.currentTarget.value.slice(0, QUERY_MAX_LENGTH))
          }
          placeholder="node.js kafka kubernetes"
          className="min-w-0 flex-1 bg-transparent font-mono text-lg outline-none placeholder:text-muted/50 sm:text-xl"
        />
        <button
          type="submit"
          disabled={busy || (!query.trim() && !profile)}
          className="shrink-0 bg-lex px-4 py-2 font-mono text-xs font-semibold uppercase tracking-[0.14em]
                     text-ink transition-opacity hover:opacity-85 disabled:opacity-50"
        >
          {busy ? 'Searching' : 'Search'}
        </button>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-4">
        <div className="flex items-center gap-2">
          <Label>Remote</Label>
          {REMOTE.map((value) => (
            <Toggle key={value} on={remote.includes(value)} onClick={() => onRemoteToggle(value)}>
              {value}
            </Toggle>
          ))}
        </div>

        <label className="flex items-center gap-2">
          <Label>Seniority</Label>
          <select
            value={seniority}
            onChange={(event) =>
              onSeniorityChange(event.currentTarget.value as SeniorityFilter | '')
            }
            className="border border-line bg-transparent px-2 py-1 font-mono text-xs text-paper
                       hover:border-edge focus:border-lex focus:outline-none"
          >
            <option value="">any</option>
            {SENIORITY.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>

        <NumberField
          label="max yrs"
          value={experienceYears}
          onChange={onExperienceYearsChange}
          placeholder="any"
        />
        <NumberField
          label="min $"
          value={minSalary}
          onChange={onMinSalaryChange}
          placeholder="any"
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Label>Profile</Label>
        <label className="cursor-pointer border border-dashed border-line px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:border-edge hover:text-paper">
          <input
            type="file"
            accept=".txt,.md,.pdf,text/plain,text/markdown,application/pdf"
            onChange={(event) => onProfileSelect(event.currentTarget.files?.[0] ?? null)}
            className="sr-only"
          />
          {profile ? `${profile.name} · ${profile.text.length} chars` : 'Attach a CV (.pdf, .txt, .md)'}
        </label>
        {profile && (
          <button
            type="button"
            onClick={onProfileRemove}
            className="font-mono text-xs text-muted underline underline-offset-4 hover:text-paper"
          >
            Remove
          </button>
        )}
        <span className="font-mono text-[11px] text-muted">
          read in your browser · stage 3 compresses it into a requirements block before search
        </span>
      </div>
    </form>
  )
}
