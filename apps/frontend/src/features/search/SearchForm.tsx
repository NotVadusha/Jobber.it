import { useEffect, useRef, type ReactElement, type ReactNode } from 'react'

import type { JobsView } from '@/routing/jobs-model'

export const QUERY_MAX_LENGTH = 500

export type SearchFormProps = {
  view: JobsView
  query: string
  hasProfile: boolean
  cvSlot: ReactNode
  busy: boolean
  onQueryChange(value: string): void
  onSubmit(): void
}

const isTextEntryTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(target.tagName)
}

export const SearchForm = ({
  view,
  query,
  hasProfile,
  cvSlot,
  busy,
  onQueryChange,
  onSubmit,
}: SearchFormProps): ReactElement => {
  const queryRef = useRef<HTMLInputElement>(null)

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
          disabled={view === 'best' && (busy || (!query.trim() && !hasProfile))}
          className="min-h-10 shrink-0 rounded-sm bg-accent px-3 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-ink transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
        >
          {buttonLabel}
        </button>
      </div>

      <div className="mt-4">{cvSlot}</div>
    </form>
  )
}
