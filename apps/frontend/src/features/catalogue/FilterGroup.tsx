import type { ReactElement, ReactNode } from 'react'

export type FilterGroupProps = {
  title: string
  output?: string
  children: ReactNode
}

export const FilterGroup = ({ title, output, children }: FilterGroupProps): ReactElement => {
  return (
    <fieldset>
      <legend className="flex w-full items-center justify-between gap-3 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-tertiary">
        <span>{title}</span>
        {output && <span className="normal-case tracking-normal text-accent">{output}</span>}
      </legend>
      <div className="mt-2.5">{children}</div>
    </fieldset>
  )
}
