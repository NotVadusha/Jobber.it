import type { BestMatchResponse } from '@/api/search'
import { formatPostedMonth, formatSalary, splitTerms } from '@/lib/format'

type BestMatchData = BestMatchResponse['data']
type BestMatchPosting = BestMatchData['results'][number]

export type SearchResultsProps = {
  data: BestMatchData | null
  busy: boolean
}

function Result({ result, rank, tokens }: {
  result: BestMatchPosting
  rank: number
  tokens: string[]
}) {
  const place = result.location
  const policy = result.remotePolicy !== 'unknown' && result.remotePolicy
  const facts = [
    place,
    policy && policy !== place?.toLowerCase() && policy,
    result.seniority !== 'unknown' && result.seniority,
    result.yearsRequired != null && `${result.yearsRequired}y+`,
    formatSalary(result.salaryMin, result.salaryMax),
    result.source,
    formatPostedMonth(result.postedAt),
  ].filter(Boolean)

  return (
    <li
      className="rise grid grid-cols-[2rem_1fr] gap-x-4 border-b border-line py-6"
      style={{ animationDelay: `${Math.min(rank, 12) * 45}ms` }}
    >
      <span className="pt-1 font-mono text-sm tabular-nums text-muted">
        {String(rank + 1).padStart(2, '0')}
      </span>

      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="text-lg font-medium leading-snug">
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-lex"
            >
              {result.title}
              <span aria-hidden="true" className="ml-1.5 text-xs text-muted">↗</span>
            </a>
          </h3>
          <div className="flex shrink-0 items-center gap-2 pt-1">
            <div className="h-[3px] w-14 bg-line" aria-hidden="true">
              <div className="h-full bg-lex" style={{ width: `${result.score * 100}%` }} />
            </div>
            <span className="font-mono text-xs tabular-nums text-muted">
              {result.score.toFixed(2)}
            </span>
          </div>
        </div>

        <p className="mt-1.5 font-mono text-xs text-muted">
          <span className="text-paper">{result.company}</span>
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
                    hit ? 'border-lex/60 bg-lex/10 text-lex' : 'border-line text-muted'
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

export function SearchResults({ data, busy }: SearchResultsProps) {
  if (!data) return null

  const tokens = data.terms.flatMap(splitTerms)

  if (data.results.length === 0) {
    return (
      <p className="mt-10 font-mono text-sm text-muted">
        Nothing cleared the filters. Drop a constraint, or search fewer terms.
      </p>
    )
  }

  return (
    <ol className="mt-4 border-t border-line" aria-busy={busy}>
      {data.results.map((result, rank) => (
        <Result key={result.id} result={result} rank={rank} tokens={tokens} />
      ))}
    </ol>
  )
}
