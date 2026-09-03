import type { components } from '@/api/schema'

type Schemas = components['schemas']

export type WireStreamEvent =
  | Schemas['SearchStarted']
  | Schemas['StageStarted']
  | Schemas['StageCompleted']
  | Schemas['SearchCompleted']
  | Schemas['SearchFailed']

const REQUEST_ID = 'req-stream-fixture'

const STAGES: ReadonlyArray<[Schemas['RankingStage'], number, string, number]> = [
  ['rewrite', 1, 'gpt-5.6-luna', 3],
  ['filter', 2, '3 of 5 pushed to the index', 5],
  ['retrieve', 3, 'hybrid dense+sparse, rrf top 100', 100],
  ['group', 4, 'live candidates resolved', 46],
  ['rerank', 5, 'bge-reranker-v2-m3', 0],
]

export function posting(index: number, score: number): Schemas['BestMatchPosting'] {
  return {
    id: `greenhouse:${index}`,
    source: 'greenhouse',
    url: `https://example.com/jobs/${index}`,
    title: `Senior Platform Engineer ${index}`,
    company: 'Acme',
    posted_at: '2026-08-30T09:00:00Z',
    first_seen_at: '2026-08-30T09:12:00Z',
    seniority: 'senior',
    years_required: 5,
    remote_policy: 'remote',
    location: 'Berlin',
    salary_min: 95000,
    salary_max: 130000,
    stack: ['Python', 'Kubernetes'],
    score,
    evidence: {
      literal_hits: [{ term: 'python', fields: ['stack', 'requirements'] }],
      retrieved_sections: ['requirements', 'responsibilities'],
    },
  }
}

export function completedStream(results: Schemas['BestMatchPosting'][]): WireStreamEvent[] {
  return [
    { event: 'search.started', request_id: REQUEST_ID },
    ...STAGES.flatMap(([stage, ordinal, detail, count]): WireStreamEvent[] => [
      { event: 'stage.started', request_id: REQUEST_ID, stage, ordinal },
      {
        event: 'stage.completed',
        request_id: REQUEST_ID,
        stage,
        ordinal,
        status: 'ran',
        detail,
        item_count: stage === 'rerank' ? results.length : count,
        duration_ms: 12.5,
      },
    ]),
    {
      event: 'search.completed',
      request_id: REQUEST_ID,
      took_ms: 3067.1,
      snapshot: {
        query: 'python platform engineer',
        terms: ['kubernetes', 'python'],
        results,
        filters_applied: [{ field: 'remote_policy', label: 'remote', note: null }],
        corpus_size: 321,
        trace: STAGES.map(([stage, , detail, count]) => ({
          node: stage,
          status: 'ran',
          detail,
          count: stage === 'rerank' ? results.length : count,
          duration_ms: 12.5,
        })),
      },
    },
  ]
}

export function encodeStream(
  events: readonly WireStreamEvent[],
  extra = '',
): string {
  const frames = events.map(
    (event) => `event: ${event.event}\ndata: ${JSON.stringify(event)}\n\n`,
  )
  return `${frames.join('')}${extra}`
}
