import type { ReactElement } from 'react'
import { Markdown } from '@/ui/Markdown'

export const JobSection = ({ heading, text, markdown = false }: {
  heading: string
  text: string | null
  markdown?: boolean
}): ReactElement | null => {
  if (!text) return null
  return (
    <section className="mt-10 border-t border-subtle pt-6">
      <h2 className="mb-5 text-xl font-semibold tracking-tight text-primary">
        {heading}
      </h2>
      {markdown ? <Markdown text={text} /> : (
        <div className="markdown-body">
          {text.split(/\n\s*\n/).map((paragraph, index) => (
            <p key={index} className="whitespace-pre-line">{paragraph}</p>
          ))}
        </div>
      )}
    </section>
  )
}
