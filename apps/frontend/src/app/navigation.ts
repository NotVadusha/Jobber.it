import type { Route, RouteName } from '@/routing/route-codec'
import type { FooterGroup, ShellNavItem } from '@/ui/shell/types'

export const buildShellNavigation = (
  current: Route,
  active: ReadonlySet<RouteName>,
): readonly ShellNavItem[] => {
  if (!active.has('saved')) return []
  return [
    { label: 'Saved', href: '#/saved', active: current.name === 'saved', placement: 'both' },
  ]
}

export const buildFooterGroups = (
  active: ReadonlySet<RouteName>,
): readonly FooterGroup[] => {
  if (!active.has('saved')) return []
  return [{ label: 'Jobs', links: [{ label: 'Saved', href: '#/saved' }] }]
}
