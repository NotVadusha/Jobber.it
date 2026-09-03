import { useState } from 'react'
import { skipToken, useQuery } from '@tanstack/react-query'

import { searchQueryKeys } from '@/api/search'
import type { BestMatchStream } from '@/api/search-stream'
import type { RankedPosting } from '@/features/jobs/ranking-score'
import { jobsReturnContext } from '@/routing/navigation-context'

export type RankingContext = {
  rank: number
  result: RankedPosting
}

export function useRankingContext(postingId: string): RankingContext | null {
  const [originEntryId] = useState(() => jobsReturnContext()?.entryId ?? null)

  const { data } = useQuery<BestMatchStream>({
    queryKey: originEntryId
      ? searchQueryKeys.bestMatch(originEntryId)
      : searchQueryKeys.bestMatchIdle(),
    queryFn: skipToken,
    staleTime: Infinity,
    gcTime: Infinity,
  })

  const results = data?.snapshot?.results
  if (!results) return null

  const index = results.findIndex((result) => result.id === postingId)
  return index === -1 ? null : { rank: index + 1, result: results[index] }
}
