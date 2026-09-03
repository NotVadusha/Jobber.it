import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query'

import { ApiError, apiErrorFrom } from '@/api/client'
import type { KeysToCamelCase } from '@/api/camelize-response'
import { camelizeResponse } from '@/api/camelize-response'
import { readEventStream, type EventStreamFrame } from '@/api/event-stream'
import type { components } from '@/api/schema'
import { searchQueryKeys, type BestMatchData, type BestMatchRequest } from '@/api/search'

type WireStreamEvent =
  | components['schemas']['SearchStarted']
  | components['schemas']['StageStarted']
  | components['schemas']['StageCompleted']
  | components['schemas']['SearchCompleted']
  | components['schemas']['SearchFailed']

type StreamEvent = KeysToCamelCase<WireStreamEvent>

export type RankingStage = components['schemas']['RankingStage']
export type TraceStatus = components['schemas']['TraceStatus']

export const RANKING_STAGES = [
  'rewrite',
  'filter',
  'retrieve',
  'group',
  'rerank',
] as const satisfies readonly RankingStage[]

type AssertNever<Value extends never> = Value
export type StageCoverage = AssertNever<
  Exclude<RankingStage, (typeof RANKING_STAGES)[number]>
>

const STREAM_PATH = '/api/search/stream'
const EVENT_NAMES = new Set<string>([
  'search.started',
  'stage.started',
  'stage.completed',
  'search.completed',
  'search.failed',
])

export type BestMatchSelection = {
  executionId: string
  request: BestMatchRequest
}

export type BestMatchStreamStatus = 'streaming' | 'completed' | 'cancelled'

export type BestMatchStagePhase = 'pending' | 'active' | 'done'

export type BestMatchStageState = {
  stage: RankingStage
  ordinal: number
  phase: BestMatchStagePhase
  status: TraceStatus | null
  detail: string | null
  itemCount: number | null
  durationMs: number | null
}

export type BestMatchStream = {
  status: BestMatchStreamStatus
  requestId: string | null
  stages: BestMatchStageState[]
  snapshot: BestMatchData | null
  tookMs: number | null
}

const pendingStages = (): BestMatchStageState[] => {
  return RANKING_STAGES.map((stage, index) => ({
    stage,
    ordinal: index + 1,
    phase: 'pending',
    status: null,
    detail: null,
    itemCount: null,
    durationMs: null,
  }))
}

const idleStream = (): BestMatchStream => {
  return {
    status: 'streaming',
    requestId: null,
    stages: pendingStages(),
    snapshot: null,
    tookMs: null,
  }
}

const withStage = (
  state: BestMatchStream,
  stage: RankingStage,
  patch: Partial<BestMatchStageState>,
): BestMatchStream => {
  return {
    ...state,
    stages: state.stages.map((entry) =>
      entry.stage === stage ? { ...entry, ...patch } : entry,
    ),
  }
}

export const applyStreamEvent = (
  state: BestMatchStream,
  event: StreamEvent,
): BestMatchStream => {
  switch (event.event) {
    case 'search.started':
      return { ...state, status: 'streaming', requestId: event.requestId }
    case 'stage.started':
      return withStage(state, event.stage, { phase: 'active' })
    case 'stage.completed':
      return withStage(state, event.stage, {
        phase: 'done',
        status: event.status,
        detail: event.detail,
        itemCount: event.itemCount,
        durationMs: event.durationMs,
      })
    case 'search.completed':
      return {
        status: 'completed',
        requestId: event.requestId,
        stages: state.stages.map((entry) => {
          const node = event.snapshot.trace.find((item) => item.node === entry.stage)
          return node
            ? {
                ...entry,
                phase: 'done',
                status: node.status,
                detail: node.detail,
                itemCount: node.count,
                durationMs: node.durationMs,
              }
            : entry
        }),
        snapshot: event.snapshot,
        tookMs: event.tookMs,
      }
    case 'search.failed':
      return state
  }
}

const parseEvent = (frame: EventStreamFrame): StreamEvent | null => {
  let payload: unknown
  try {
    payload = JSON.parse(frame.data)
  } catch {
    return null
  }

  const event = camelizeResponse(payload)
  if (
    typeof event !== 'object' ||
    event === null ||
    !('event' in event) ||
    typeof event.event !== 'string' ||
    !EVENT_NAMES.has(event.event) ||
    (frame.name !== null && frame.name !== event.event)
  ) {
    return null
  }

  return event as StreamEvent
}

const readErrorResponse = async (response: Response): Promise<ApiError> => {
  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  return apiErrorFrom({
    status: response.status,
    payload,
    requestIdHeader: response.headers.get('x-request-id'),
  })
}

async function* streamEvents(
  request: BestMatchRequest,
  signal: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const response = await fetch(STREAM_PATH, {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      accept: 'text/event-stream',
    },
    body: JSON.stringify(request),
  })

  if (!response.ok || !response.body) {
    throw await readErrorResponse(response)
  }

  for await (const frame of readEventStream(response.body)) {
    const event = parseEvent(frame)
    if (event) yield event
  }
}

export const useBestMatchStreamQuery = (selection: BestMatchSelection | null) => {
  const client = useQueryClient()

  return useQuery({
    queryKey: selection
      ? searchQueryKeys.bestMatch(selection.executionId)
      : searchQueryKeys.bestMatchIdle(),
    queryFn: selection
      ? async ({ signal, queryKey }): Promise<BestMatchStream> => {
          let state = idleStream()
          client.setQueryData(queryKey, state)

          for await (const event of streamEvents(selection.request, signal)) {
            if (event.event === 'search.failed') {
              throw new ApiError({
                status: 200,
                code: event.error.code,
                message: event.error.message,
                requestId: event.requestId,
                details: event.error.details,
              })
            }

            state = applyStreamEvent(state, event)
            client.setQueryData(queryKey, state)
          }

          if (state.status !== 'completed') {
            throw new ApiError({
              status: 0,
              code: 'STREAM_INCOMPLETE',
              message: 'The search connection ended before results arrived.',
              requestId: state.requestId,
            })
          }

          return state
        }
      : skipToken,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  })
}

export const useCancelBestMatchStream = () => {
  const client = useQueryClient()

  return async (executionId: string): Promise<void> => {
    const queryKey = searchQueryKeys.bestMatch(executionId)
    await client.cancelQueries({ queryKey, exact: true }, { revert: false })
    client.setQueryData<BestMatchStream>(queryKey, (previous) =>
      previous ? { ...previous, status: 'cancelled' } : previous,
    )
  }
}
