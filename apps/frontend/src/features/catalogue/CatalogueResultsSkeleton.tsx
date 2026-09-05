import type { ReactElement } from 'react'

import { Skeleton } from '@/ui/Skeleton'

export const CatalogueResultsSkeleton = (): ReactElement => {
  return (
    <div role="status" aria-live="polite" aria-label="Loading postings" className="space-y-3">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="rounded-md border border-subtle bg-surface p-5">
          <Skeleton className="h-5 w-3/5" />
          <Skeleton className="mt-3 h-3 w-4/5" />
          <Skeleton className="mt-4 h-7 w-2/3" />
        </div>
      ))}
    </div>
  )
}
