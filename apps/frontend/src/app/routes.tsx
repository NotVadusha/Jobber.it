import type { ReactElement } from 'react'

import type { Route, RouteName } from '@/routing/route-codec'
import { JobPage } from '@/features/job-detail/JobPage'
import { SavedPage } from '@/features/saved/SavedPage'
import { SearchPage } from '@/features/search/SearchPage'

export const ACTIVE_ROUTE_NAMES: ReadonlySet<RouteName> = new Set(['jobs', 'job', 'saved'])

export const RouteOutlet = ({ route }: { route: Route }): ReactElement => {
  switch (route.name) {
    case 'jobs':
      return <SearchPage urlState={route.state} />
    case 'job':
      return <JobPage key={route.postingId} postingId={route.postingId} />
    case 'saved':
      return <SavedPage />
    default:
      throw new Error(`Inactive route reached RouteOutlet: ${route.name}`)
  }
}
