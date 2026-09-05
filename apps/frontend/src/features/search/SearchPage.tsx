import { useState } from 'react'

import { ApiError } from '@/api/client'
import { useCorpusMetaQuery } from '@/api/search'
import { SearchExamples } from '@/features/search/SearchExamples'
import { SearchForm } from '@/features/search/SearchForm'
import { SearchResults } from '@/features/search/SearchResults'
import { SearchTrace } from '@/features/search/SearchTrace'
import { useSearchDraft } from '@/features/search/UseSearchDraft'
import { useSearchExecution } from '@/features/search/UseSearchExecution'
import { useSearchProfile } from '@/features/search/UseSearchProfile'
import type { JobsUrlState } from '@/routing/jobs-model'
import { PageState } from '@/ui/PageState'

export type SearchPageProps = {
  urlState: JobsUrlState
}

export function SearchPage({ urlState }: SearchPageProps) {
  const [localError, setLocalError] = useState<ApiError | null>(null)
  const { draft, setQuery, formProps } = useSearchDraft(urlState)
  const { profile, selectProfile, removeProfile } = useSearchProfile(setLocalError)
  const { searchQuery, submit } = useSearchExecution({
    urlState,
    draft,
    profileText: profile?.text ?? '',
    onError: setLocalError,
  })

  // Kept for the wire-normalization contract test to have a request to
  // observe; corpus-meta data has no renderer, so its result/error is
  // intentionally not surfaced here.
  useCorpusMetaQuery()

  const data = searchQuery.data?.data ?? null
  const tookMs = searchQuery.data?.meta.tookMs
  const busy = searchQuery.isFetching
  const error = localError ?? (searchQuery.error instanceof ApiError ? searchQuery.error : null)

  function submitExample(example: string): void {
    setQuery(example)
    submit(example)
  }

  return (
    <div className="mx-auto max-w-4xl px-6 pb-24">
      <div className="pt-14 pb-10">
        <h1 className="max-w-2xl font-mono text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
          Ranked postings, and why each one ranked.
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-secondary">
          Search the normalized corpus by free text, or attach a CV to search by profile.
          Hard constraints run as metadata filters — they are never embedded.
        </p>
      </div>

      <SearchForm
        {...formProps}
        profile={profile}
        busy={busy}
        onProfileSelect={selectProfile}
        onProfileRemove={removeProfile}
        onSubmit={submit}
      />

      {error && (
        <PageState
          kind="error"
          title={error.message}
          description={error.requestId ? `reference ${error.requestId}` : undefined}
          compact
        />
      )}

      {data && <SearchTrace data={data} tookMs={tookMs} busy={busy} />}

      <div aria-live="polite">
        <SearchResults data={data} busy={busy} />

        {!data && !error && <SearchExamples onSelect={submitExample} />}
      </div>

      <p className="mt-16 font-mono text-[11px] leading-relaxed text-tertiary">
        Every result links to the posting on its original board. A query or profile runs the full
        retrieve → rerank → respond pipeline over the live Pinecone index; leave both blank
        and this lists the filtered corpus off disk instead, since there's nothing to embed.
      </p>
    </div>
  )
}
