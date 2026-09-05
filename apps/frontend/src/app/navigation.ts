import { CREATOR_LINKS } from '@/features/explain/project'
import type { Route, RouteName } from '@/routing/route-codec'
import type { FooterGroup, ShellNavItem } from '@/ui/shell/types'

export const buildShellNavigation = (
  current: Route,
  active: ReadonlySet<RouteName>,
): readonly ShellNavItem[] => {
  const items: ShellNavItem[] = []

  if (active.has('ranking')) {
    items.push({ label: 'Ranking', href: '#/ranking', active: current.name === 'ranking', placement: 'both' })
  }
  if (active.has('privacy')) {
    items.push({ label: 'Privacy', href: '#/privacy', active: current.name === 'privacy', placement: 'mobile' })
  }
  if (active.has('changelog')) {
    items.push({ label: 'Changelog', href: '#/changelog', active: current.name === 'changelog', placement: 'both' })
  }
  if (active.has('about')) {
    items.push({ label: 'About', href: '#/about', active: current.name === 'about', placement: 'both' })
  }
  if (active.has('saved')) {
    items.push({ label: 'Saved', href: '#/saved', active: current.name === 'saved', placement: 'both' })
  }

  return items
}

export const buildFooterGroups = (
  active: ReadonlySet<RouteName>,
): readonly FooterGroup[] => {
  const groups: FooterGroup[] = []

  if (active.has('saved')) {
    groups.push({ label: 'Jobs', links: [{ label: 'Saved', href: '#/saved' }] })
  }

  const aboutLinks: FooterGroup['links'][number][] = []
  if (active.has('ranking')) aboutLinks.push({ label: 'How ranking works', href: '#/ranking' })
  if (active.has('privacy')) aboutLinks.push({ label: 'CV parsing and privacy', href: '#/privacy' })
  if (active.has('changelog')) aboutLinks.push({ label: 'Changelog', href: '#/changelog' })
  if (active.has('about')) aboutLinks.push({ label: 'About', href: '#/about' })
  if (aboutLinks.length > 0) groups.push({ label: 'About', links: aboutLinks })

  if (active.has('about') && CREATOR_LINKS.length > 0) {
    groups.push({
      label: 'Elsewhere',
      links: CREATOR_LINKS.map((link) => ({ ...link, external: true as const })),
    })
  }

  return groups
}
