import type { ReactElement } from 'react'

import type { Route, RouteName } from '@/routing/route-codec'
import { AboutPage } from '@/features/explain/AboutPage'
import { ChangelogPage } from '@/features/explain/ChangelogPage'
import { PrivacyPage } from '@/features/explain/PrivacyPage'
import { RankingPage } from '@/features/explain/RankingPage'
import { JobPage } from '@/features/job-detail/JobPage'
import { SavedPage } from '@/features/saved/SavedPage'
import { SearchPage } from '@/features/search/SearchPage'

export const ACTIVE_ROUTE_NAMES: ReadonlySet<RouteName> = new Set([
  'jobs',
  'job',
  'saved',
  'ranking',
  'privacy',
  'changelog',
  'about',
])

export const RouteOutlet = ({ route }: { route: Route }): ReactElement => {
  switch (route.name) {
    case 'jobs':
      return <SearchPage urlState={route.state} />
    case 'job':
      return <JobPage key={route.postingId} postingId={route.postingId} />
    case 'saved':
      return <SavedPage />
    case 'ranking':
      return <RankingPage />
    case 'privacy':
      return <PrivacyPage />
    case 'changelog':
      return <ChangelogPage />
    case 'about':
      return <AboutPage />
    default:
      throw new Error('Inactive route reached RouteOutlet')
  }
}
