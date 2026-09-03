import type { ReactElement } from 'react'

import { SiteFooter } from '@/ui/shell/SiteFooter'
import { SiteHeader } from '@/ui/shell/SiteHeader'
import type { AppShellProps } from '@/ui/shell/types'

export function AppShell({
  children,
  homeHref,
  navigation,
  footerGroups,
  corpusSummary,
}: AppShellProps): ReactElement {
  return (
    <div className="min-h-dvh bg-canvas text-primary">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:border focus:border-accent focus:bg-surface focus:px-4 focus:py-2 focus:font-mono focus:text-xs focus:text-primary"
      >
        Skip to content
      </a>
      <SiteHeader homeHref={homeHref} navigation={navigation} corpusSummary={corpusSummary} />
      <main id="main-content" className="min-h-[calc(100dvh-var(--layout-header-height)-12rem)]">
        {children}
      </main>
      <SiteFooter groups={footerGroups} />
    </div>
  )
}
