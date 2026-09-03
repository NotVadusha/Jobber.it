import type { BestMatchResponse } from '@/api/search'
import { Label } from '@/features/search/SearchForm'

export type SearchTraceProps = {
  data: BestMatchResponse['data']
  tookMs: number | null | undefined
  busy: boolean
}

export function SearchTrace({ data, tookMs, busy }: SearchTraceProps) {
  return (
    <section className="mt-10 border border-line bg-panel" aria-label="Retrieval trace">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-line px-5 py-3">
        <Label>Retrieval trace</Label>
        <p className="font-mono text-[11px] tabular-nums text-muted">
          {busy ? 'running…' : `${data.results.length} of ${data.corpusSize} · ${tookMs} ms`}
        </p>
      </div>

      <div className="relative px-5 py-6">
        <div className="absolute inset-x-5 top-[30px] h-px" aria-hidden="true">
          <div className="mx-[16.6%] h-px bg-edge" />
        </div>
        <ol className="relative grid grid-cols-3 gap-1">
          {data.trace.map((node) => {
            const ran = node.status === 'ran'
            return (
              <li key={node.node} className="flex flex-col items-center text-center">
                <span className="inline-flex bg-panel px-3">
                  <span
                    className={`block size-3 rotate-45 ${
                      ran ? 'bg-lex' : 'border border-sem/60 bg-panel'
                    }`}
                  />
                </span>
                <span
                  className={`mt-3 font-mono text-[11px] uppercase tracking-[0.14em] ${
                    ran ? 'text-paper' : 'text-muted'
                  }`}
                >
                  {node.node}
                </span>
                {node.count != null && (
                  <span className="mt-1 font-mono text-[11px] tabular-nums text-lex">
                    {node.count}
                  </span>
                )}
                {/* Detail is what a phone drops; the name and count are the rail. */}
                <span className="mt-1 hidden max-w-[16ch] font-mono text-[10px] leading-relaxed text-muted sm:block">
                  {node.detail}
                </span>
                {!ran && (
                  <span className="mt-1 font-mono text-[10px] text-sem/70">not wired yet</span>
                )}
              </li>
            )
          })}
        </ol>
      </div>

      <dl className="flex flex-col gap-3 border-t border-line px-5 py-3 sm:flex-row sm:gap-8">
        <div className="flex flex-wrap items-center gap-2">
          <dt><Label>Terms</Label></dt>
          {data.terms.length ? (
            data.terms.map((term) => (
              <dd key={term} className="font-mono text-xs text-lex">{term}</dd>
            ))
          ) : (
            <dd className="font-mono text-xs text-muted">none — no stack tokens extracted</dd>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <dt><Label>Filters</Label></dt>
          {data.filtersApplied.length ? (
            data.filtersApplied.map((filter) => (
              <dd
                key={filter.field}
                title={filter.note ?? undefined}
                className="border border-edge px-2 py-0.5 font-mono text-xs text-paper"
              >
                {filter.field.replace(/_/g, ' ')} = {filter.label}
              </dd>
            ))
          ) : (
            <dd className="font-mono text-xs text-muted">none — full corpus in scope</dd>
          )}
        </div>
      </dl>
    </section>
  )
}
