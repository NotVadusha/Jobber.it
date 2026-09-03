import type { ReactElement } from 'react'

import { useCorpusMetaQuery } from '@/api/search'
import { buildFooterGroups, buildShellNavigation } from '@/app/navigation'
import { ACTIVE_ROUTE_NAMES, RouteOutlet } from '@/app/routes'
import { CompensationPeriodProvider } from '@/features/jobs/compensation'
import { useHashRoute } from '@/routing/hash-router'
import { AppShell } from '@/ui/shell/AppShell'

export default function App(): ReactElement {
  const { route } = useHashRoute(ACTIVE_ROUTE_NAMES)
  const metaQuery = useCorpusMetaQuery()
  const corpusSummary = metaQuery.data
    ? `${metaQuery.data.data.corpusSize.toLocaleString()} live postings`
    : undefined

  return (
    <CompensationPeriodProvider>
      <AppShell
        homeHref="#/jobs"
        navigation={buildShellNavigation(route, ACTIVE_ROUTE_NAMES)}
        footerGroups={buildFooterGroups(ACTIVE_ROUTE_NAMES)}
        corpusSummary={corpusSummary}
      >
        <RouteOutlet route={route} />
      </AppShell>
    </CompensationPeriodProvider>
  )
}
