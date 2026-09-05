import type { ReactElement, ReactNode } from 'react'

export const ProseSection = ({
  title,
  children,
}: {
  title: string
  children: ReactNode
}): ReactElement => {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-secondary">
        {title}
      </h2>
      <div className="flex flex-col gap-3 text-sm leading-relaxed text-secondary [overflow-wrap:anywhere]">
        {children}
      </div>
    </section>
  )
}
