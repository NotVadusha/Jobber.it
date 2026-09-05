import { useMemo } from 'react'

export type PaginationItem =
  | { kind: 'page'; page: number }
  | { kind: 'ellipsis'; key: 'left' | 'right' }

const pageItems = (currentPage: number, totalPages: number): PaginationItem[] => {
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

export const usePaginationItems = (currentPage: number, totalPages: number): PaginationItem[] => {
  return useMemo(() => pageItems(currentPage, totalPages), [currentPage, totalPages])
}
