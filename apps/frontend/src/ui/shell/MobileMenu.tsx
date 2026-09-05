import type { ReactElement } from 'react'

import type { ShellNavItem } from '@/ui/shell/types'

export const MobileMenu = ({
  items,
  onSelect,
}: {
  items: readonly ShellNavItem[]
  onSelect: () => void
}): ReactElement => {
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
