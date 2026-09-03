import type { ReactElement } from 'react'

type PaginationItem =
  | { kind: 'page'; page: number }
  | { kind: 'ellipsis'; key: 'left' | 'right' }

function pageItems(currentPage: number, totalPages: number): PaginationItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => ({
      kind: 'page' as const,
      page: index + 1,
    }))
  }
  if (currentPage <= 4) {
    return [
      ...[1, 2, 3, 4, 5].map((page): PaginationItem => ({ kind: 'page', page })),
      { kind: 'ellipsis', key: 'right' },
      { kind: 'page', page: totalPages },
    ]
  }
  if (currentPage >= totalPages - 3) {
    return [
      { kind: 'page', page: 1 },
      { kind: 'ellipsis', key: 'left' },
      ...Array.from({ length: 5 }, (_, index) => ({
        kind: 'page' as const,
        page: totalPages - 4 + index,
      })),
    ]
  }
  return [
    { kind: 'page', page: 1 },
    { kind: 'ellipsis', key: 'left' },
    { kind: 'page', page: currentPage - 1 },
    { kind: 'page', page: currentPage },
    { kind: 'page', page: currentPage + 1 },
    { kind: 'ellipsis', key: 'right' },
    { kind: 'page', page: totalPages },
  ]
}

export function CataloguePagination({
  page,
  totalPages,
  disabled,
  onPageChange,
}: {
  page: number
  totalPages: number
  disabled: boolean
  onPageChange(page: number): void
}): ReactElement | null {
  if (totalPages <= 1) return null

  const buttonClass =
    'grid min-h-9 min-w-9 place-items-center rounded-sm border border-subtle bg-surface px-2 font-mono text-xs text-secondary transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <nav aria-label="Postings pagination" className="mt-7 flex flex-wrap items-center justify-center gap-1.5">
      <button
        type="button"
        aria-label="Previous page"
        disabled={disabled || page === 1}
        onClick={() => onPageChange(page - 1)}
        className={buttonClass}
      >
        ←
      </button>
      {pageItems(page, totalPages).map((item) =>
        item.kind === 'ellipsis' ? (
          <span key={item.key} aria-hidden="true" className="px-1 text-tertiary">…</span>
        ) : (
          <button
            key={item.page}
            type="button"
            aria-label={`Page ${item.page}`}
            aria-current={item.page === page ? 'page' : undefined}
            disabled={disabled}
            onClick={() => onPageChange(item.page)}
            className={`${buttonClass} ${
              item.page === page ? 'border-accent bg-accent text-accent-ink' : ''
            }`}
          >
            {item.page}
          </button>
        ),
      )}
      <button
        type="button"
        aria-label="Next page"
        disabled={disabled || page === totalPages}
        onClick={() => onPageChange(page + 1)}
        className={buttonClass}
      >
        →
      </button>
      <span className="ml-2 font-mono text-[11px] text-tertiary">
        Page {page} of {totalPages}
      </span>
    </nav>
  )
}
