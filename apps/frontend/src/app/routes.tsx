import type { ReactElement } from 'react'

import type { Route, RouteName } from '@/routing/hash-router'
import { SearchPage } from '@/features/search/SearchPage'

export const ACTIVE_ROUTE_NAMES: ReadonlySet<RouteName> = new Set(['jobs'])

export function RouteOutlet({ route }: { route: Route }): ReactElement {
  switch (route.name) {
    case 'jobs':
      return <SearchPage urlState={route.state} />
    default:
      throw new Error(`Inactive route reached RouteOutlet: ${route.name}`)
  }
}
