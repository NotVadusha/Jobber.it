import { keepPreviousData, skipToken, useQuery } from '@tanstack/react-query'

import type { KeysToCamelCase } from '@/api/camelize-response'
import { ApiError, api } from '@/api/client'
import type { paths } from '@/api/schema'

type DetailOperation = paths['/api/postings/{posting_id}']['get']
type LookupOperation = paths['/api/postings/lookup']['post']

type WireDetailResponse =
  DetailOperation['responses'][200]['content']['application/json']
type WireLookupResponse =
  LookupOperation['responses'][200]['content']['application/json']
type WireLookupRequest =
  NonNullable<LookupOperation['requestBody']>['content']['application/json']

export type PostingDetailResponse = KeysToCamelCase<WireDetailResponse>
export type PostingLookupResponse = KeysToCamelCase<WireLookupResponse>
export type PostingDetail = PostingDetailResponse['data']
export type ResolvedPosting = PostingLookupResponse['data'][number]

export const POSTING_LOOKUP_MAX_IDS = 100

export const postingQueryKeys = {
  all: ['postings'] as const,
  detail: (postingId: string) => [...postingQueryKeys.all, 'detail', postingId] as const,
  lookup: (ids: readonly string[]) =>
    [...postingQueryKeys.all, 'lookup', [...ids].sort()] as const,
  lookupIdle: () => [...postingQueryKeys.all, 'lookup', 'idle'] as const,
}

async function fetchPostingDetail(
  postingId: string,
  signal?: AbortSignal,
): Promise<PostingDetailResponse> {
  const response = await api.get<PostingDetailResponse>(
    `/postings/${encodeURIComponent(postingId)}`,
    { signal },
  )
  return response.data
}

async function fetchPostingLookup(
  ids: readonly string[],
  signal?: AbortSignal,
): Promise<PostingLookupResponse> {
  const body: WireLookupRequest = { ids: [...ids] }
  const response = await api.post<PostingLookupResponse>('/postings/lookup', body, { signal })
  return response.data
}

export function isPostingNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'POSTING_NOT_FOUND'
}

export function usePostingDetailQuery(postingId: string) {
  return useQuery({
    queryKey: postingQueryKeys.detail(postingId),
    queryFn: ({ signal }) => fetchPostingDetail(postingId, signal),
    staleTime: 60_000,
    retry: (failureCount, error) => failureCount < 1 && !isPostingNotFound(error),
    refetchOnWindowFocus: false,
  })
}

export function usePostingLookupQuery(ids: readonly string[]) {
  const requested = ids.slice(0, POSTING_LOOKUP_MAX_IDS)
  return useQuery({
    queryKey: requested.length
      ? postingQueryKeys.lookup(requested)
      : postingQueryKeys.lookupIdle(),
    queryFn: requested.length
      ? ({ signal }) => fetchPostingLookup(requested, signal)
      : skipToken,
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  })
}
