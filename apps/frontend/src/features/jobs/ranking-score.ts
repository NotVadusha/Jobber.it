import type { BestMatchData } from '@/api/search'

export type RankedPosting = BestMatchData['results'][number]

export const UNCALIBRATED_SCORE_NOTICE =
  '% match is the raw reranker score for this query. It is uncalibrated: it is not a probability, a hiring prediction, or a guarantee.'

export function matchPercent(score: number): number {
  return Math.round(score * 100)
}

export function evidenceTerms(result: RankedPosting): string[] {
  return result.evidence?.literalHits?.map((hit) => hit.term) ?? []
}

export function hasEvidence(result: RankedPosting): boolean {
  const evidence = result.evidence
  if (!evidence) return false
  return (evidence.literalHits?.length ?? 0) > 0 || (evidence.retrievedSections?.length ?? 0) > 0
}
