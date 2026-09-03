import { skipToken, useQuery } from '@tanstack/react-query'

import type { KeysToCamelCase } from '@/api/camelize-response'
import { api } from '@/api/client'
import type { components, paths } from '@/api/schema'

type WireMetaResponse = components['schemas']['SuccessResponse_MetaData_']
type WireBestMatchResponse = components['schemas']['SuccessResponse_BestMatchData_']

export type BestMatchRequest = components['schemas']['BestMatchRequest']
export type MetaResponse = KeysToCamelCase<WireMetaResponse>
export type BestMatchResponse = KeysToCamelCase<WireBestMatchResponse>
export type MetaData = MetaResponse['data']
export type BestMatchData = BestMatchResponse['data']

type PostgresSearchOperation = paths['/api/postings/query']['post']
type WirePostgresSearchRequest =
  NonNullable<PostgresSearchOperation['requestBody']>['content']['application/json']
type WirePostgresSearchResponse =
  PostgresSearchOperation['responses'][200]['content']['application/json']

export type PostgresSearchRequest = WirePostgresSearchRequest
export type PostgresSearchResponse = KeysToCamelCase<WirePostgresSearchResponse>

export const searchQueryKeys = {
  all: ['search'] as const,
  corpusMeta: () => [...searchQueryKeys.all, 'corpus-meta'] as const,
  postgres: (request: PostgresSearchRequest) =>
    [...searchQueryKeys.all, 'postgres', request] as const,
  postgresIdle: () => [...searchQueryKeys.all, 'postgres', 'idle'] as const,
  bestMatch: (executionId: string) =>
    [...searchQueryKeys.all, 'best-match', executionId] as const,
  bestMatchIdle: () => [...searchQueryKeys.all, 'best-match', 'idle'] as const,
}

async function fetchCorpusMeta(signal?: AbortSignal): Promise<MetaResponse> {
  const response = await api.get<MetaResponse>('/meta', { signal })
  return response.data
}

async function fetchPostgresSearch(
  request: PostgresSearchRequest,
  signal?: AbortSignal,
): Promise<PostgresSearchResponse> {
  const response = await api.post<PostgresSearchResponse>(
    '/postings/query',
    request,
    { signal },
  )
  return response.data
}

export function useCorpusMetaQuery() {
  return useQuery({
    queryKey: searchQueryKeys.corpusMeta(),
    queryFn: ({ signal }) => fetchCorpusMeta(signal),
    staleTime: 60_000,
    retry: 1,
  })
}

export function usePostgresSearchQuery(
  request: PostgresSearchRequest | null,
) {
  return useQuery({
    queryKey: request
      ? searchQueryKeys.postgres(request)
      : searchQueryKeys.postgresIdle(),
    queryFn: request
      ? ({ signal }) => fetchPostgresSearch(request, signal)
      : skipToken,
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
  })
}

