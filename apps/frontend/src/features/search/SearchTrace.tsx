import type { BestMatchResponse } from '@/api/search'
import { Label } from '@/features/search/SearchForm'

export type SearchTraceProps = {
  data: BestMatchResponse['data']
  tookMs: number | null | undefined
  busy: boolean
}

export function SearchTrace({ data, tookMs, busy }: SearchTraceProps) {
  return (
    <section className="mt-10 border border-subtle bg-surface" aria-label="Retrieval trace">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-subtle px-5 py-3">
        <Label>Retrieval trace</Label>
        <p className="font-mono text-[11px] tabular-nums text-secondary">
          {busy ? 'running…' : `${data.results.length} of ${data.corpusSize} · ${tookMs} ms`}
        </p>
      </div>

      <div className="relative px-5 py-6">
        <div className="absolute inset-x-5 top-[30px] h-px" aria-hidden="true">
          <div className="mx-[16.6%] h-px bg-strong" />
        </div>
        <ol className="relative grid grid-cols-3 gap-1">
          {data.trace.map((node) => {
            const ran = node.status === 'ran'
            return (
              <li key={node.node} className="flex flex-col items-center text-center">
                <span className="inline-flex bg-surface px-3">
                  <span
                    className={`block size-3 rotate-45 ${
                      ran ? 'bg-accent' : 'border border-strong/60 bg-surface'
                    }`}
                  />
                </span>
                <span
                  className={`mt-3 font-mono text-[11px] uppercase tracking-[0.14em] ${
                    ran ? 'text-primary' : 'text-secondary'
                  }`}
                >
                  {node.node}
                </span>
                {node.count != null && (
                  <span className="mt-1 font-mono text-[11px] tabular-nums text-accent-text">
                    {node.count}
                  </span>
                )}
                {/* Detail is what a phone drops; the name and count are the rail. */}
                <span className="mt-1 hidden max-w-[16ch] font-mono text-[10px] leading-relaxed text-tertiary sm:block">
                  {node.detail}
                </span>
                {!ran && (
                  <span className="mt-1 font-mono text-[10px] text-tertiary/70">not wired yet</span>
                )}
              </li>
            )
          })}
        </ol>
      </div>

      <dl className="flex flex-col gap-3 border-t border-subtle px-5 py-3 sm:flex-row sm:gap-8">
        <div className="flex flex-wrap items-center gap-2">
          <dt><Label>Terms</Label></dt>
          {data.terms.length ? (
            data.terms.map((term) => (
              <dd key={term} className="font-mono text-xs text-accent-text">{term}</dd>
            ))
          ) : (
            <dd className="font-mono text-xs text-secondary">none — no stack tokens extracted</dd>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <dt><Label>Filters</Label></dt>
          {data.filtersApplied.length ? (
            data.filtersApplied.map((filter) => (
              <dd
                key={filter.field}
                title={filter.note ?? undefined}
                className="border border-strong px-2 py-0.5 font-mono text-xs text-primary"
              >
                {filter.field.replace(/_/g, ' ')} = {filter.label}
              </dd>
            ))
          ) : (
            <dd className="font-mono text-xs text-secondary">none — full corpus in scope</dd>
          )}
        </div>
      </dl>
    </section>
  )
}
