import type { BestMatchRequest } from '@/api/search'

export const REVEAL_STEP = 10

export const isRankingPending = (
  current: BestMatchRequest,
  ran: BestMatchRequest | null,
): boolean => {
  if (!ran) return false
  if (current.profile_text !== ran.profile_text) return true
  return (
    JSON.stringify({ query: current.query, filters: current.filters }) !==
    JSON.stringify({ query: ran.query, filters: ran.filters })
  )
}

export const revealLabel = (revealed: number, total: number): string => {
  const remaining = total - revealed
  const next = Math.min(REVEAL_STEP, remaining)
  return `Show ${next} more (${remaining} remaining)`
}
