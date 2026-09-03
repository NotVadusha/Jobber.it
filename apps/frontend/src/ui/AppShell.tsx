import {
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'

import { ThemeToggle } from '@/ui/theme'

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

const NAV_LINK_CLASS =
  'font-mono text-xs text-secondary transition-colors hover:text-primary aria-[current=page]:text-accent-text'

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

function LogoMark({ homeHref }: { homeHref: InternalHref }): ReactElement {
  return (
    <a href={homeHref} className="font-mono text-sm font-semibold tracking-tight">
      jobber<span className="text-accent">.</span>it
    </a>
  )
}

function SiteHeader({
  homeHref,
  navigation,
  corpusSummary,
}: {
  homeHref: InternalHref
  navigation: readonly ShellNavItem[]
  corpusSummary?: string
}): ReactElement {
  const desktopItems = navigation.filter(
    (item) => item.placement === 'desktop' || item.placement === 'both',
  )
  const mobileItems = navigation.filter(
    (item) => item.placement === 'mobile' || item.placement === 'both',
  )

  const [menuOpen, setMenuOpen] = useState(false)
  const headerRef = useRef<HTMLElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!menuOpen) return

    function close(): void {
      setMenuOpen(false)
    }

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key !== 'Escape') return
      setMenuOpen(false)
      menuButtonRef.current?.focus()
    }

    function onPointerDown(event: PointerEvent): void {
      if (headerRef.current?.contains(event.target as Node)) return
      setMenuOpen(false)
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('hashchange', close)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('hashchange', close)
    }
  }, [menuOpen])

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-40 border-b border-subtle bg-canvas/80 backdrop-blur supports-[backdrop-filter]:bg-canvas/60"
    >
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-4 md:px-6">
        <LogoMark homeHref={homeHref} />

        <div className="flex items-center gap-4">
          {corpusSummary && (
            <span className="hidden font-mono text-[11px] uppercase tracking-[0.2em] text-secondary lg:inline">
              {corpusSummary}
            </span>
          )}

          {desktopItems.length > 0 && (
            <nav aria-label="Primary" className="hidden md:block">
              <ul className="flex items-center gap-4">
                {desktopItems.map((item) => (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      aria-current={item.active ? 'page' : undefined}
                      className={NAV_LINK_CLASS}
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          <ThemeToggle />

          {mobileItems.length > 0 && (
            <button
              ref={menuButtonRef}
              type="button"
              aria-expanded={menuOpen}
              aria-controls="shell-mobile-menu"
              onClick={() => setMenuOpen((open) => !open)}
              className="grid size-9 place-items-center rounded-sm border border-transparent text-secondary transition-colors hover:border-strong hover:bg-surface-raised hover:text-primary md:hidden"
            >
              <MenuIcon open={menuOpen} />
              <span className="sr-only">{menuOpen ? 'Close menu' : 'Open menu'}</span>
            </button>
          )}
        </div>
      </div>

      {menuOpen && mobileItems.length > 0 && (
        <MobileMenu items={mobileItems} onSelect={() => setMenuOpen(false)} />
      )}
    </header>
  )
}

function MobileMenu({
  items,
  onSelect,
}: {
  items: readonly ShellNavItem[]
  onSelect: () => void
}): ReactElement {
  return (
    <div
      id="shell-mobile-menu"
      className="absolute inset-x-0 top-full border-b border-subtle bg-canvas md:hidden"
    >
      <nav aria-label="Mobile" className="mx-auto max-w-4xl px-4 py-3 md:px-6">
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <li key={item.href}>
              <a
                href={item.href}
                aria-current={item.active ? 'page' : undefined}
                onClick={onSelect}
                className="block py-2 font-mono text-sm text-secondary transition-colors hover:text-primary aria-[current=page]:text-accent-text"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

function SiteFooter({ groups }: { groups: readonly FooterGroup[] }): ReactElement {
  const nonEmptyGroups = groups.filter((group) => group.links.length > 0)
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-subtle">
      <div className="mx-auto max-w-4xl px-4 py-8 md:px-6">
        {nonEmptyGroups.length > 0 && (
          <div className="grid gap-8 pb-8 sm:grid-cols-3">
            {nonEmptyGroups.map((group) => (
              <div key={group.label}>
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-secondary">
                  {group.label}
                </p>
                <ul className="mt-3 flex flex-col gap-2">
                  {group.links.map((link) =>
                    link.external ? (
                      <li key={link.href}>
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs text-secondary transition-colors hover:text-primary"
                        >
                          {link.label}
                        </a>
                      </li>
                    ) : (
                      <li key={link.href}>
                        <a
                          href={link.href}
                          className="font-mono text-xs text-secondary transition-colors hover:text-primary"
                        >
                          {link.label}
                        </a>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            ))}
          </div>
        )}

        <p className="font-mono text-[11px] leading-relaxed text-tertiary">
          jobber.it aggregates public postings and links to the original source — apply there,
          not here. © {year} jobber.it
        </p>
      </div>
    </footer>
  )
}

function MenuIcon({ open }: { open: boolean }): ReactElement {
  if (open) {
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M4 4l10 10M14 4L4 14" />
      </svg>
    )
  }

  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3 5h12M3 9h12M3 13h12" />
    </svg>
  )
}
