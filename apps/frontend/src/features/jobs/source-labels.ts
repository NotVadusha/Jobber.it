import type { PostgresSearchResponse } from '@/api/search'

export type PostingSource = PostgresSearchResponse['data'][number]['source']

const SOURCE_LABELS: Record<PostingSource, string> = {
  ashby: 'Ashby company boards',
  djinni: 'Djinni',
  dou: 'DOU',
  greenhouse: 'Greenhouse company boards',
  jobico: 'Jobico',
  lever: 'Lever company boards',
  linkedin: 'LinkedIn Jobs',
}

export const sourceLabel = (source: string): string => {
  return SOURCE_LABELS[source as PostingSource] ?? source
}
