import { Fragment, type ReactElement } from 'react'

type HighlightSegment = {
  start: number
  text: string
  highlighted: boolean
}

export function literalQueryTerms(query: string): string[] {
  const seen = new Set<string>()
  return query
    .trim()
    .split(/\s+/u)
    .map((term) => term.toLowerCase())
    .filter((term) => {
      if (!term || seen.has(term)) return false
      seen.add(term)
      return true
    })
    .sort((left, right) => right.length - left.length)
}

function highlightSegments(text: string, terms: readonly string[]): HighlightSegment[] {
  if (!text || terms.length === 0) {
    return [{ start: 0, text, highlighted: false }]
  }

  const lower = text.toLowerCase()
  const segments: HighlightSegment[] = []
  let cursor = 0

  while (cursor < text.length) {
    let matchIndex = -1
    let matchTerm = ''

    for (const term of terms) {
      const index = lower.indexOf(term, cursor)
      if (
        index !== -1 &&
        (matchIndex === -1 || index < matchIndex ||
          (index === matchIndex && term.length > matchTerm.length))
      ) {
        matchIndex = index
        matchTerm = term
      }
    }

    if (matchIndex === -1) {
      segments.push({ start: cursor, text: text.slice(cursor), highlighted: false })
      break
    }

    if (matchIndex > cursor) {
      segments.push({
        start: cursor,
        text: text.slice(cursor, matchIndex),
        highlighted: false,
      })
    }
    segments.push({
      start: matchIndex,
      text: text.slice(matchIndex, matchIndex + matchTerm.length),
      highlighted: true,
    })
    cursor = matchIndex + matchTerm.length
  }

  return segments
}

export function HighlightedText({
  text,
  terms,
}: {
  text: string
  terms: readonly string[]
}): ReactElement {
  return (
    <>
      {highlightSegments(text, terms).map((segment) => (
        <Fragment key={`${segment.start}:${segment.highlighted ? 'hit' : 'text'}`}>
          {segment.highlighted ? (
            <mark className="rounded-sm bg-accent-soft px-0.5 text-accent">
              {segment.text}
            </mark>
          ) : (
            segment.text
          )}
        </Fragment>
      ))}
    </>
  )
}
