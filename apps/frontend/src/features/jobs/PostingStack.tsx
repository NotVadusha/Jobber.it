import type { ReactElement } from 'react'

import { HighlightedText } from '@/features/jobs/HighlightedText'

export const PostingStack = ({
  stack,
  terms,
}: {
  stack: readonly string[]
  terms: readonly string[]
}): ReactElement | null => {
  if (stack.length === 0) return null

  return (
    <ul aria-label="Technologies" className="mt-3 flex flex-wrap gap-1.5">
      {stack.map((technology, index) => (
        <li
          key={`${technology}:${index}`}
          className="rounded-sm border border-subtle bg-surface-raised px-2 py-1 font-mono text-[11px] text-secondary"
        >
          <HighlightedText text={technology} terms={terms} />
        </li>
      ))}
    </ul>
  )
}
