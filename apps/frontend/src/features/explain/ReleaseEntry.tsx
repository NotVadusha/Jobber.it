import type { ReactElement } from 'react'

import { releaseUrl, type Release } from '@/features/explain/changelog-data'
import { formatAbsoluteDate } from '@/lib/format'

export const ReleaseEntry = ({ release }: { release: Release }): ReactElement => {
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
