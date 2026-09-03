import type { ReactElement } from 'react'

import type { InternalHref } from '@/ui/shell/types'

export function LogoMark({ homeHref }: { homeHref: InternalHref }): ReactElement {
  return (
    <a href={homeHref} className="font-mono text-sm font-semibold tracking-tight">
      jobber<span className="text-accent">.</span>it
    </a>
  )
}
