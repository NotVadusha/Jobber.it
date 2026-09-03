import type { BestMatchData, BestMatchRequest } from '@/api/search'

export const REVEAL_STEP = 10

export const UNCALIBRATED_SCORE_NOTICE =
  '% match is the raw reranker score for this query. It is uncalibrated: it is not a probability, a hiring prediction, or a guarantee.'

type BestMatchResult = BestMatchData['results'][number]

export function isRankingPending(
  current: BestMatchRequest,
  ran: BestMatchRequest | null,
): boolean {
  if (!ran) return false
  if (current.profile_text !== ran.profile_text) return true
  return (
    JSON.stringify({ query: current.query, filters: current.filters }) !==
    JSON.stringify({ query: ran.query, filters: ran.filters })
  )
}

export function matchPercent(score: number): number {
  return Math.round(score * 100)
}

export function evidenceTerms(result: BestMatchResult): string[] {
  return result.evidence?.literalHits?.map((hit) => hit.term) ?? []
}

export function hasEvidence(result: BestMatchResult): boolean {
  const evidence = result.evidence
  if (!evidence) return false
  return (evidence.literalHits?.length ?? 0) > 0 || (evidence.retrievedSections?.length ?? 0) > 0
}

export function revealLabel(revealed: number, total: number): string {
  const remaining = total - revealed
  const next = Math.min(REVEAL_STEP, remaining)
  return `Show ${next} more (${remaining} remaining)`
}
