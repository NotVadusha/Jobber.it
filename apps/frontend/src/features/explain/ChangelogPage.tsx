import type { ReactElement } from 'react'

import { releaseUrl, useChangelogQuery, type Release } from '@/features/explain/changelog-data'
import { RELEASES_URL } from '@/features/explain/project'
import { formatAbsoluteDate } from '@/lib/format'
import { PageState } from '@/ui/PageState'
import { Prose, ProseSection } from '@/ui/Prose'
import { Skeleton } from '@/ui/Skeleton'

const ACTION_CLASS =
  'min-h-10 rounded-sm border border-subtle px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-secondary hover:border-strong hover:text-primary'

const ReleaseEntry = ({ release }: { release: Release }): ReactElement => {
  const published = formatAbsoluteDate(release.publishedAt)

  return (
    <li className="rounded-md border border-subtle bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-base font-semibold leading-snug text-primary">{release.name}</h3>
        <span className="font-mono text-[11px] text-tertiary">{release.tag}</span>
        {release.prerelease && (
          <span className="rounded-full border border-strong px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-secondary">
            Prerelease
          </span>
        )}
        {published && (
          <time dateTime={published.dateTime} className="font-mono text-[11px] text-tertiary">
            {published.label}
          </time>
        )}
      </div>

      {release.body && (
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-secondary [overflow-wrap:anywhere]">
          {release.body}
        </p>
      )}

      <a
        className="mt-3 inline-block font-mono text-[11px] uppercase tracking-[0.12em] text-accent underline underline-offset-4"
        href={releaseUrl(release.tag)}
        target="_blank"
        rel="noopener noreferrer"
      >
        Read on GitHub
        <span className="sr-only">{` — ${release.name} (opens in a new tab)`}</span>
      </a>
    </li>
  )
}

export function ChangelogPage(): ReactElement {
  const changelog = useChangelogQuery()
  const state = changelog.data ?? null
  const staleAt = state?.source === 'cache' ? formatAbsoluteDate(state.fetchedAt) : null

  return (
    <Prose
      title="Changelog"
      lead="Releases published for this project, read from GitHub when you open this page."
    >
      <ProseSection title="Releases">
        {changelog.isPending && (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-24 w-full" label="Loading releases" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {changelog.isError && !state && (
          <PageState
            kind="error"
            title="Releases could not be loaded"
            description="GitHub could not be reached from this browser, and there is no saved copy on this device."
            compact
            action={
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void changelog.refetch()} className={ACTION_CLASS}>
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
              onClick={() => void changelog.refetch()}
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
