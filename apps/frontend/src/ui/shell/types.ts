import type { ReactNode } from 'react'

export type InternalHref = `#/${string}`
export type ExternalHref = `https://${string}`

export type ShellNavItem = {
  label: string
  href: InternalHref
  active: boolean
  placement: 'desktop' | 'mobile' | 'both'
}

export type FooterLink =
  | { label: string; href: InternalHref; external?: false }
  | { label: string; href: ExternalHref; external: true }

export type FooterGroup = {
  label: string
  links: readonly FooterLink[]
}

export type AppShellProps = {
  children: ReactNode
  homeHref: InternalHref
  navigation: readonly ShellNavItem[]
  footerGroups: readonly FooterGroup[]
  corpusSummary?: string
}
