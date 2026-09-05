import type { ReactElement } from 'react'

import { usePaginationItems } from '@/features/catalogue/usePaginationItems'

export type CataloguePaginationProps = {
  page: number
  totalPages: number
  disabled: boolean
  onPageChange(page: number): void
}

export function CataloguePagination({
  page,
  totalPages,
  disabled,
  onPageChange,
}: CataloguePaginationProps): ReactElement | null {
  const items = usePaginationItems(page, totalPages)
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
      {items.map((item) =>
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
