import type { ReactElement } from 'react'

import type { FooterGroup } from '@/ui/shell/types'

export const SiteFooter = ({ groups }: { groups: readonly FooterGroup[] }): ReactElement => {
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
