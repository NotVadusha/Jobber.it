import { useEffect, useRef, type ReactElement, type ReactNode } from 'react'

import type { ProfileDocument } from '@/features/cv/read-profile'
import type { JobsView } from '@/routing/jobs-url'

export const QUERY_MAX_LENGTH = 500

export function Label({ children }: { children: ReactNode }): ReactElement {
  return (
    <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-tertiary">
      {children}
    </span>
  )
}

export type SearchFormProps = {
  view: JobsView
  query: string
  profile: ProfileDocument | null
  busy: boolean
  onQueryChange(value: string): void
  onProfileSelect(file: File | null): void
  onProfileRemove(): void
  onSubmit(): void
}

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(target.tagName)
}

export function SearchForm({
  view,
  query,
  profile,
  busy,
  onQueryChange,
  onProfileSelect,
  onProfileRemove,
  onSubmit,
}: SearchFormProps): ReactElement {
  const queryRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if (
        event.key !== '/' ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isTextEntryTarget(event.target)
      ) {
        return
      }
      event.preventDefault()
      queryRef.current?.focus()
    }
    document.addEventListener('keydown', focusSearch)
    return () => document.removeEventListener('keydown', focusSearch)
  }, [])

  const buttonLabel = view === 'all'
    ? 'Search all'
    : busy
      ? 'Searching'
      : 'Find matches'

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <label htmlFor="jobs-query" className="sr-only">Search postings</label>
      <div className="flex items-center gap-3 border-b-2 border-strong py-3 transition-colors focus-within:border-accent">
        <span aria-hidden="true" className="font-mono text-lg text-accent">›</span>
        <input
          ref={queryRef}
          id="jobs-query"
          value={query}
          maxLength={QUERY_MAX_LENGTH}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) =>
            onQueryChange(event.currentTarget.value.slice(0, QUERY_MAX_LENGTH))
          }
          placeholder='try "node.js kafka kubernetes"'
          className="min-w-0 flex-1 bg-transparent font-mono text-base text-primary outline-none placeholder:text-tertiary sm:text-xl"
        />
        <kbd className="hidden rounded-sm border border-subtle bg-surface-raised px-2 py-1 font-mono text-[10px] text-tertiary sm:inline">
          /
        </kbd>
        <button
          type="submit"
          disabled={view === 'best' && (busy || (!query.trim() && !profile))}
          className="min-h-10 shrink-0 rounded-sm bg-accent px-3 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-ink transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
        >
          {buttonLabel}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Label>Profile</Label>
        <label className="cursor-pointer rounded-sm border border-dashed border-strong px-3 py-2 font-mono text-xs text-secondary transition-colors hover:border-accent hover:text-accent">
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.md,.pdf,text/plain,text/markdown,application/pdf"
            onChange={(event) => onProfileSelect(event.currentTarget.files?.[0] ?? null)}
            className="sr-only"
          />
          {profile
            ? `${profile.name} · ${profile.text.length.toLocaleString()} chars`
            : 'Attach a CV (.pdf, .txt, .md)'}
        </label>
        {profile && (
          <button
            type="button"
            onClick={() => {
              if (fileRef.current) fileRef.current.value = ''
              onProfileRemove()
            }}
            className="min-h-9 font-mono text-xs text-secondary underline underline-offset-4 hover:text-primary"
          >
            Remove
          </button>
        )}
        <span className="text-xs leading-relaxed text-tertiary">
          Used only for Best matches and never added to a shared link.
        </span>
      </div>
    </form>
  )
}
