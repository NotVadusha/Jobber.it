import type { Route, RouteName } from '@/routing/route-codec'
import type { FooterGroup, ShellNavItem } from '@/ui/shell/types'

export function buildShellNavigation(
  _current: Route,
  _active: ReadonlySet<RouteName>,
): readonly ShellNavItem[] {
  return []
}

export function buildFooterGroups(
  _active: ReadonlySet<RouteName>,
): readonly FooterGroup[] {
  return []
}
