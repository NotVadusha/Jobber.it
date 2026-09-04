import type { ReactElement } from 'react'

import type { BestMatchData } from '@/api/search'
import type { BestMatchStageState, BestMatchStreamStatus } from '@/api/search-stream'
import { Label } from '@/features/search/SearchForm'
import '@/features/search/best-match.css'

type StagePresentation = {
  marker: string
  text: string
  state: string
}

const present = (
  stage: BestMatchStageState,
  failed: boolean,
): StagePresentation => {
  if (stage.phase === 'active') {
    return failed
      ? { marker: 'border border-danger bg-surface', text: 'text-danger', state: 'failed' }
      : {
          marker: 'bg-accent best-match-stage-active',
          text: 'text-primary',
          state: 'running',
        }
  }

  if (stage.phase === 'pending') {
    return { marker: 'border border-subtle bg-surface', text: 'text-tertiary', state: 'pending' }
  }

  return stage.status === 'skipped'
    ? { marker: 'border border-accent bg-accent-soft', text: 'text-secondary', state: 'skipped' }
    : { marker: 'bg-accent', text: 'text-primary', state: 'ran' }
}

export const BestMatchTrace = ({
  stages,
  status,
  failed,
  snapshot,
  tookMs,
}: {
  stages: readonly BestMatchStageState[]
  status: BestMatchStreamStatus
  failed: boolean
  snapshot: BestMatchData | null
  tookMs: number | null
}): ReactElement => {
  const streaming = status === 'streaming' && !failed
  const summary = snapshot && tookMs !== null
    ? `${snapshot.results.length} of ${snapshot.corpusSize} · ${tookMs} ms`
    : streaming
      ? 'running…'
      : 'stopped'

  return (
    <section
      className="mt-10 rounded-md border border-subtle bg-surface"
      aria-label="Retrieval trace"
      aria-busy={streaming}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-subtle px-5 py-3">
        <Label>Retrieval trace</Label>
        <p className="font-mono text-[11px] tabular-nums text-tertiary" role="status">
          {summary}
        </p>
      </div>

      <ol className="grid grid-cols-3 gap-2 px-5 py-6 sm:grid-cols-5">
        {stages.map((stage) => {
          const presentation = present(stage, failed)
          return (
            <li key={stage.stage} className="flex flex-col items-center text-center">
              <span
                className={`block size-3 rotate-45 rounded-[1px] ${presentation.marker}`}
                aria-hidden="true"
              />
              <span
                className={`mt-3 font-mono text-[11px] uppercase tracking-[0.14em] ${presentation.text}`}
              >
                {stage.stage}
              </span>
              <span className="sr-only">{presentation.state}</span>
              <span
                aria-hidden={stage.itemCount === null}
                className="mt-1 font-mono text-[11px] tabular-nums text-accent"
              >
                {stage.itemCount ?? '\u00a0'}
              </span>
              <span
                aria-hidden={stage.durationMs === null}
                className="mt-0.5 font-mono text-[10px] tabular-nums text-tertiary"
              >
                {stage.durationMs === null ? '\u00a0' : `${stage.durationMs} ms`}
              </span>
              <span
                aria-hidden={!stage.detail}
                className="mt-1 hidden max-w-[18ch] font-mono text-[10px] leading-relaxed text-tertiary sm:block sm:min-h-[2.5rem]"
              >
                {stage.detail ?? '\u00a0'}
              </span>
            </li>
          )
        })}
      </ol>

      {snapshot && (
        <dl className="flex flex-col gap-3 border-t border-subtle px-5 py-3 sm:flex-row sm:gap-8">
          <div className="flex flex-wrap items-center gap-2">
            <dt><Label>Terms</Label></dt>
            {snapshot.terms.length ? (
              snapshot.terms.map((term) => (
                <dd key={term} className="font-mono text-xs text-accent">{term}</dd>
              ))
            ) : (
              <dd className="font-mono text-xs text-tertiary">
                none — no stack tokens extracted
              </dd>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <dt><Label>Filters</Label></dt>
            {snapshot.filtersApplied.length ? (
              snapshot.filtersApplied.map((filter) => (
                <dd
                  key={filter.field}
                  title={filter.note ?? undefined}
                  className="rounded-sm border border-subtle px-2 py-0.5 font-mono text-xs text-secondary"
                >
                  {filter.field.replace(/_/g, ' ')} = {filter.label}
                </dd>
              ))
            ) : (
              <dd className="font-mono text-xs text-tertiary">none — full corpus in scope</dd>
            )}
          </div>
        </dl>
      )}
    </section>
  )
}
