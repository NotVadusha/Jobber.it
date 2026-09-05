import type { ReactElement } from 'react'

export const JobSection = ({ heading, text }: { heading: string; text: string | null }): ReactElement | null => {
  if (!text) return null
  return (
    <section className="mt-8">
      <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-secondary">
        {heading}
      </h2>
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-secondary [overflow-wrap:anywhere]">
        {text}
      </p>
    </section>
  )
}
