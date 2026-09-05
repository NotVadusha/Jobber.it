import type { BestMatchResponse } from '@/api/search'
import { formatCompensation, useCompensationPeriod } from '@/features/jobs/compensation'
import { formatPostedMonth, splitTerms } from '@/lib/format'
import { PageState } from '@/ui/PageState'

type BestMatchData = BestMatchResponse['data']
type BestMatchPosting = BestMatchData['results'][number]

export type SearchResultsProps = {
  data: BestMatchData | null
  busy: boolean
}

const Result = ({ result, rank, tokens }: {
  result: BestMatchPosting
  rank: number
  tokens: string[]
}) => {
  const { period } = useCompensationPeriod()
  const place = result.location
  const policy = result.remotePolicy !== 'unknown' && result.remotePolicy
  const facts = [
    place,
    policy && policy !== place?.toLowerCase() && policy,
    result.seniority !== 'unknown' && result.seniority,
    result.yearsRequired != null && `${result.yearsRequired}y+`,
    formatCompensation(result.salaryMin, result.salaryMax, period),
    result.source,
    formatPostedMonth(result.postedAt),
  ].filter(Boolean)

  return (
    <li
      className="rise grid grid-cols-[2rem_1fr] gap-x-4 border-b border-subtle py-6"
      style={{ animationDelay: `${Math.min(rank, 12) * 45}ms` }}
    >
      <span className="pt-1 font-mono text-sm tabular-nums text-secondary">
        {String(rank + 1).padStart(2, '0')}
      </span>

      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="text-lg font-medium leading-snug">
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-accent-text"
            >
              {result.title}
              <span aria-hidden="true" className="ml-1.5 text-xs text-tertiary">↗</span>
            </a>
          </h3>
          <div className="flex shrink-0 items-center gap-2 pt-1">
            <div className="h-[3px] w-14 bg-subtle" aria-hidden="true">
              <div className="h-full bg-accent" style={{ width: `${result.score * 100}%` }} />
            </div>
            <span className="font-mono text-xs tabular-nums text-secondary">
              {result.score.toFixed(2)}
            </span>
          </div>
        </div>

        <p className="mt-1.5 font-mono text-xs text-secondary">
          <span className="text-primary">{result.company}</span>
          {facts.map((fact) => (
            <span key={String(fact)}> · {fact}</span>
          ))}
        </p>

        {result.stack && result.stack.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {result.stack.map((tech) => {
              const hit = splitTerms(tech).some((token) => tokens.includes(token))
              return (
                <li
                  key={tech}
                  className={`border px-2 py-0.5 font-mono text-xs ${
                    hit ? 'border-accent/60 bg-accent/10 text-accent' : 'border-subtle text-secondary'
                  }`}
                >
                  {tech}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </li>
  )
}

export const SearchResults = ({ data, busy }: SearchResultsProps) => {
  if (!data) return null

  const tokens = data.terms.flatMap(splitTerms)

  if (data.results.length === 0) {
    return (
      <PageState
        kind="empty"
        title="Nothing cleared the filters."
        description="Drop a constraint, or search fewer terms."
        compact
      />
    )
  }

  return (
    <ol className="mt-4 border-t border-subtle" aria-busy={busy}>
      {data.results.map((result, rank) => (
        <Result key={result.id} result={result} rank={rank} tokens={tokens} />
      ))}
    </ol>
  )
}
