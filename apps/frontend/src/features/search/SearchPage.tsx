import { useState } from 'react'

import { ApiError } from '@/api/client'
import type { components } from '@/api/schema'
import type { BestMatchRequest, PineconeSearchSelection } from '@/api/search'
import { useCorpusMetaQuery, usePineconeSearchQuery } from '@/api/search'
import type { ProfileDocument } from '@/features/cv/read-profile'
import { ProfileReadError, readProfile } from '@/features/cv/read-profile'
import { Label, SearchForm } from '@/features/search/SearchForm'
import { SearchResults } from '@/features/search/SearchResults'
import { SearchTrace } from '@/features/search/SearchTrace'

type RemoteFilter = components['schemas']['RemoteFilter']
type SeniorityFilter = components['schemas']['SeniorityFilter']
type ProfileState = ProfileDocument | null

// Verified against the indexed corpus; an example returning nothing misleads.
const EXAMPLES = ['python aws terraform', 'node.js typescript nestjs', 'distributed systems scala']

export function SearchPage() {
  const [query, setQuery] = useState('')
  const [remote, setRemote] = useState<RemoteFilter[]>([])
  const [seniority, setSeniority] = useState<SeniorityFilter | ''>('')
  const [experienceYears, setExperienceYears] = useState('')
  const [minSalary, setMinSalary] = useState('')
  const [profile, setProfile] = useState<ProfileState>(null)
  const [selection, setSelection] = useState<PineconeSearchSelection | null>(null)
  const [localError, setLocalError] = useState<ApiError | null>(null)

  const metaQuery = useCorpusMetaQuery()
  const bestMatchQuery = usePineconeSearchQuery(selection)

  const meta = metaQuery.data?.data ?? null
  const data = bestMatchQuery.data?.data ?? null
  const tookMs = bestMatchQuery.data?.meta.tookMs
  const busy = bestMatchQuery.isFetching

  const error =
    localError ??
    (bestMatchQuery.error instanceof ApiError ? bestMatchQuery.error : null) ??
    (metaQuery.error instanceof ApiError ? metaQuery.error : null)

  function buildRequest(searchQuery: string): BestMatchRequest {
    return {
      query: searchQuery.trim(),
      profile_text: profile?.text ?? '',
      filters: {
        remote_policy: remote,
        seniority: seniority ? [seniority] : [],
        source: [],
        experience_years: experienceYears === '' ? null : Number(experienceYears),
        min_salary: minSalary === '' ? null : Number(minSalary),
        include_undisclosed_salary: false,
        posted_within: null,
      },
    }
  }

  function submit(searchQuery = query): void {
    const request = buildRequest(searchQuery)
    if (!request.query && !request.profile_text) {
      setLocalError(new ApiError({
        status: 400,
        code: 'EMPTY_SEARCH',
        message: 'Enter a query or attach a CV.',
      }))
      return
    }

    setLocalError(null)
    setSelection({
      executionId: crypto.randomUUID(),
      request,
    })
  }

  async function selectProfile(file: File | null): Promise<void> {
    if (!file) return

    try {
      setProfile(await readProfile(file))
      setLocalError(null)
    } catch (failure) {
      setProfile(null)
      setLocalError(new ApiError({
        status: 0,
        code: failure instanceof ProfileReadError ? failure.code : 'READ_FAILED',
        message:
          failure instanceof Error ? failure.message : 'Could not read the selected file.',
      }))
    }
  }

  const toggleRemote = (value: RemoteFilter) =>
    setRemote((current) =>
      current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
    )

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-4xl flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-6 py-4">
          <span className="font-mono text-sm font-semibold tracking-tight">
            jobber<span className="text-lex">.</span>it
          </span>
          <Label>
            {meta
              ? `${meta.corpusSize} postings · ${meta.sources.length} boards · ${meta.retrieval} retrieval`
              : 'connecting'}
          </Label>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 pb-24">
        <div className="pt-14 pb-10">
          <h1 className="max-w-2xl font-mono text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
            Ranked postings, and why each one ranked.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
            Search the normalized corpus by free text, or attach a CV to search by profile.
            Hard constraints run as metadata filters — they are never embedded.
          </p>
        </div>

        <SearchForm
          query={query}
          remote={remote}
          seniority={seniority}
          experienceYears={experienceYears}
          minSalary={minSalary}
          profile={profile}
          busy={busy}
          onQueryChange={setQuery}
          onRemoteToggle={toggleRemote}
          onSeniorityChange={setSeniority}
          onExperienceYearsChange={setExperienceYears}
          onMinSalaryChange={setMinSalary}
          onProfileSelect={selectProfile}
          onProfileRemove={() => setProfile(null)}
          onSubmit={() => submit()}
        />

        {error && (
          <p role="alert" className="mt-8 border border-lex/50 bg-lex/5 px-4 py-3 font-mono text-xs text-lex">
            {error.message}
            {error.requestId && (
              <span className="ml-2 text-muted">reference {error.requestId}</span>
            )}
          </p>
        )}

        {data && <SearchTrace data={data} tookMs={tookMs} busy={busy} />}

        <div aria-live="polite">
          <SearchResults data={data} busy={busy} />

          {!data && !error && (
            <section className="mt-16">
              <Label>Try</Label>
              <ul className="mt-3 flex flex-wrap gap-2">
                {EXAMPLES.map((example) => (
                  <li key={example}>
                    <button
                      type="button"
                      onClick={() => {
                        setQuery(example)
                        submit(example)
                      }}
                      className="border border-line px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:border-lex hover:text-lex"
                    >
                      {example}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </main>

      <footer className="border-t border-line">
        <p className="mx-auto max-w-4xl px-6 py-5 font-mono text-[11px] leading-relaxed text-muted">
          Every result links to the posting on its original board. A query or profile runs the full
          retrieve → rerank → respond pipeline over the live Pinecone index; leave both blank
          and this lists the filtered corpus off disk instead, since there's nothing to embed.
        </p>
      </footer>
    </div>
  )
}
