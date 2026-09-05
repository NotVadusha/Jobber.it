import type { ReactElement } from 'react'

import { CloseIcon } from '@/ui/icons/CloseIcon'
import { MenuIcon } from '@/ui/icons/MenuIcon'
import { LogoMark } from '@/ui/shell/LogoMark'
import { MobileMenu } from '@/ui/shell/MobileMenu'
import { useMobileMenu } from '@/ui/shell/useMobileMenu'
import type { InternalHref, ShellNavItem } from '@/ui/shell/types'
import { ThemeToggle } from '@/ui/ThemeToggle'

const NAV_LINK_CLASS =
  'font-mono text-xs text-secondary transition-colors hover:text-primary aria-[current=page]:text-accent-text'

export const SiteHeader = ({
  homeHref,
  navigation,
  corpusSummary,
}: {
  homeHref: InternalHref
  navigation: readonly ShellNavItem[]
  corpusSummary?: string
}): ReactElement => {
  const desktopItems = navigation.filter(
    (item) => item.placement === 'desktop' || item.placement === 'both',
  )
  const mobileItems = navigation.filter(
    (item) => item.placement === 'mobile' || item.placement === 'both',
  )

  const { open, toggle, close, headerRef, buttonRef } = useMobileMenu()

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
              ref={buttonRef}
              type="button"
              aria-expanded={open}
              aria-controls="shell-mobile-menu"
              onClick={toggle}
              className="grid size-9 place-items-center rounded-sm border border-transparent text-secondary transition-colors hover:border-strong hover:bg-surface-raised hover:text-primary md:hidden"
            >
              {open ? <CloseIcon /> : <MenuIcon />}
              <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
            </button>
          )}
        </div>
      </div>

      {open && mobileItems.length > 0 && (
        <MobileMenu items={mobileItems} onSelect={close} />
      )}
    </header>
  )
}
