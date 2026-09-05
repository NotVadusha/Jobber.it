import type { ReactElement, ReactNode } from 'react'

export const Prose = ({
  title,
  lead,
  children,
}: {
  title: string
  lead?: string
  children: ReactNode
}): ReactElement => {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 lg:py-12">
      <h1 className="text-xl font-semibold leading-tight text-primary sm:text-2xl">{title}</h1>
      {lead && <p className="mt-3 text-sm leading-relaxed text-secondary">{lead}</p>}
      <div className="mt-8 flex flex-col gap-8">{children}</div>
    </div>
  )
}
