import { useMemo, type ReactElement } from 'react'

import type { PostgresSearchResponse } from '@/api/search'
import { ApiError } from '@/api/client'
import { CataloguePagination } from '@/features/catalogue/CataloguePagination'
import { CataloguePostingCard } from '@/features/catalogue/CataloguePostingCard'
import { CatalogueResultsSkeleton } from '@/features/catalogue/CatalogueResultsSkeleton'
import { CompensationPeriodToggle } from '@/features/jobs/CompensationPeriodToggle'
import { literalQueryTerms } from '@/features/jobs/HighlightedText'
import type { BrowseSort } from '@/routing/jobs-model'
import { PageState } from '@/ui/PageState'

export type CatalogueResultsProps = {
  query: string
  activeFilterCount: number
  sort: BrowseSort
  response: PostgresSearchResponse | undefined
  error: Error | null
  pending: boolean
  fetching: boolean
  placeholder: boolean
  onSortChange(sort: BrowseSort): void
  onPageChange(page: number): void
  onClearFilters(): void
  onClearQuery(): void
  onRetry(): void
}

const actionButtonClass =
  'min-h-10 rounded-sm border border-subtle bg-surface px-3 font-mono text-xs text-secondary hover:border-accent hover:text-accent'

export const CatalogueResults = ({
  query,
  activeFilterCount,
  sort,
  response,
  error,
  pending,
  fetching,
  placeholder,
  onSortChange,
  onPageChange,
  onClearFilters,
  onClearQuery,
  onRetry,
}: CatalogueResultsProps): ReactElement => {
  const terms = useMemo(() => literalQueryTerms(query), [query])

  if (error) {
    const description = error instanceof ApiError
      ? error.message
      : 'Could not load postings.'
    return (
      <PageState
        kind="error"
        title={
          error instanceof ApiError && error.code === 'CATALOGUE_UNAVAILABLE'
            ? 'The postings catalogue is temporarily unavailable'
            : 'Could not load postings'
        }
        description={description}
        action={(
          <button type="button" onClick={onRetry} className={actionButtonClass}>
            Retry
          </button>
        )}
      />
    )
  }

  if (pending && !response) return <CatalogueResultsSkeleton />

  const pagination = response?.meta.pagination
  if (!response || !pagination) {
    return (
      <PageState
        kind="error"
        title="Could not read catalogue pagination"
        description="The server response did not include the required page metadata."
        action={(
          <button type="button" onClick={onRetry} className={actionButtonClass}>
            Retry
          </button>
        )}
      />
    )
  }

  if (response.data.length === 0) {
    if (pagination.totalItems === 0 && activeFilterCount === 0 && !query) {
      return (
        <PageState
          kind="empty"
          title="No live postings are available yet"
          description="The catalogue currently contains no live postings."
        />
      )
    }

    const action = activeFilterCount > 0
      ? (
          <button type="button" onClick={onClearFilters} className={actionButtonClass}>
            Clear filters, keep query
          </button>
        )
      : query
        ? (
            <button type="button" onClick={onClearQuery} className={actionButtonClass}>
              Clear search
            </button>
          )
        : undefined

    return (
      <PageState
        kind="empty"
        title="No postings match this search"
        description="Try fewer exact terms or remove a hard constraint."
        action={action}
      />
    )
  }

  const first = (pagination.page - 1) * pagination.pageSize + 1
  const last = first + response.data.length - 1

  return (
    <section aria-labelledby="catalogue-results-title" aria-busy={fetching}>
      <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-secondary">
        <h2 id="catalogue-results-title" className="font-normal">
          Showing <strong className="font-semibold text-primary">{first}–{last}</strong>
          {' '}of <strong className="font-semibold text-primary">{pagination.totalItems}</strong>
          {query && <> for <strong className="font-semibold text-primary">“{query}”</strong></>}
          <span className="text-tertiary">
            {' '}· {sort === 'newest' ? 'latest first' : 'highest disclosed minimum first'}
          </span>
        </h2>
        <span className="flex-1" />
        <CompensationPeriodToggle />
        <label className="flex items-center gap-2 font-mono text-[11px] text-tertiary">
          Sort
          <select
            value={sort}
            onChange={(event) => onSortChange(event.currentTarget.value as BrowseSort)}
            className="min-h-9 rounded-sm border border-subtle bg-surface-raised px-2 text-xs text-primary"
          >
            <option value="newest">Newest</option>
            <option value="salary">Highest salary</option>
          </select>
        </label>
      </div>

      {fetching && (
        <p role="status" aria-live="polite" className="mb-3 font-mono text-[11px] text-accent">
          Updating postings…{placeholder ? ' showing the previous page meanwhile' : ''}
        </p>
      )}

      <ol aria-label="All postings results" className="space-y-3">
        {response.data.map((posting, index) => (
          <CataloguePostingCard
            key={posting.id}
            posting={posting}
            resultNumber={first + index}
            terms={terms}
          />
        ))}
      </ol>

      <CataloguePagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        disabled={fetching}
        onPageChange={onPageChange}
      />
    </section>
  )
}
