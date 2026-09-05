import type { ReactElement } from 'react'

const disclosureFacts = (provider: string | null): readonly string[] => {
  const named = provider ?? 'a third-party language-model provider'
  return [
    'The file is read in this browser. The file itself is never uploaded.',
    'Only the text extracted from it is sent, inside the search request.',
    `That text is sent to ${named} to be rewritten into a retrieval query.`,
    'Only the rewritten query is used to search the posting index. The CV text is not sent to the index.',
    `Jobber stores neither the file nor its text. What ${named} does with it is governed by their policy, not Jobber's.`,
    'CV text, the filename, and a CV-only search are never put into a shareable link.',
    "This choice is remembered in this browser and is cleared with the site's data.",
  ]
}

export const CvDisclosureFacts = ({ provider }: { provider: string | null }): ReactElement => {
  return (
    <ul className="mt-3 flex flex-col gap-1.5 text-xs leading-relaxed text-tertiary">
      {disclosureFacts(provider).map((fact) => (
        <li key={fact} className="flex gap-2">
          <span aria-hidden="true">·</span>
          <span>{fact}</span>
        </li>
      ))}
    </ul>
  )
}
