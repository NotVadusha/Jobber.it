import type { ReactElement } from 'react'

import { useChangelogQuery } from '@/features/explain/changelog-data'
import { RELEASES_URL } from '@/features/explain/project'
import { ReleaseEntry } from '@/features/explain/ReleaseEntry'
import { formatAbsoluteDate } from '@/lib/format'
import { PageState } from '@/ui/PageState'
import { Prose } from '@/ui/Prose'
import { ProseSection } from '@/ui/ProseSection'
import { Skeleton } from '@/ui/Skeleton'

const ACTION_CLASS =
  'min-h-10 rounded-sm border border-subtle px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-secondary hover:border-strong hover:text-primary'

export function ChangelogPage(): ReactElement {
  const { data, isPending, isError, refetch } = useChangelogQuery()
  const state = data ?? null
  const staleAt = state?.source === 'cache' ? formatAbsoluteDate(state.fetchedAt) : null

  return (
    <Prose
      title="Changelog"
      lead="Releases published for this project, read from GitHub when you open this page."
    >
      <ProseSection title="Releases">
        {isPending && (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-24 w-full" label="Loading releases" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {isError && !state && (
          <PageState
            kind="error"
            title="Releases could not be loaded"
            description="GitHub could not be reached from this browser, and there is no saved copy on this device."
            compact
            action={
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void refetch()} className={ACTION_CLASS}>
                  Try again
                </button>
                <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer" className={ACTION_CLASS}>
                  Open releases on GitHub
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </div>
            }
          />
        )}

        {staleAt && (
          <p role="status" className="text-xs text-tertiary">
            {'GitHub could not be reached. Showing the copy saved on this device on '}
            <time dateTime={staleAt.dateTime}>{staleAt.label}</time>
            {'. '}
            <button
              type="button"
              onClick={() => void refetch()}
              className="underline underline-offset-4 hover:text-primary"
            >
              Try again
            </button>
          </p>
        )}

        {state && state.releases.length === 0 && (
          <PageState
            kind="empty"
            title="No releases published yet"
            description="The first entry appears when Release 1 ships. Until then there is nothing to list."
            compact
            action={
              <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer" className={ACTION_CLASS}>
                Open releases on GitHub
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            }
          />
        )}

        {state && state.releases.length > 0 && (
          <ul className="flex flex-col gap-3">
            {state.releases.map((release) => (
              <ReleaseEntry key={release.tag} release={release} />
            ))}
          </ul>
        )}
      </ProseSection>
    </Prose>
  )
}
