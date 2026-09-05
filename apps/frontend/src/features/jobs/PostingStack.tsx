import { useState, type ReactElement } from 'react'

import { HighlightedText } from '@/features/jobs/HighlightedText'

export const PostingStack = ({
  stack,
  terms,
  expanded = false,
}: {
  stack: readonly string[]
  terms: readonly string[]
  expanded?: boolean
}): ReactElement | null => {
  const [showAll, setShowAll] = useState(false)
  if (stack.length === 0) return null
  const visible = expanded || showAll ? stack : stack.slice(0, 6)

  return (
    <ul aria-label="Technologies" className="mt-3 flex flex-wrap gap-1.5">
      {visible.map((technology, index) => (
        <li
          key={`${technology}:${index}`}
          className="rounded-sm border border-subtle bg-surface-raised px-2 py-1 font-mono text-[11px] text-secondary"
        >
          <HighlightedText text={technology} terms={terms} />
        </li>
      ))}
      {!expanded && stack.length > 6 && (
        <li>
          <button type="button" aria-expanded={showAll} onClick={() => setShowAll(!showAll)} className="min-h-8 px-2 text-xs text-accent-text underline underline-offset-4">
            {showAll ? 'Show fewer technologies' : `+${stack.length - 6} more technologies`}
          </button>
        </li>
      )}
    </ul>
  )
}
