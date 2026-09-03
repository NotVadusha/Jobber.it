import type { ReactElement } from 'react'

import { CREATOR, CREATOR_LINKS } from '@/features/explain/project'
import { Prose, ProseSection } from '@/ui/Prose'

export function AboutPage(): ReactElement {
  return (
    <Prose
      title="About Jobber"
      lead="Jobber aggregates public engineering job postings from several sources, makes them searchable by meaning as well as by text, and links back to the original posting. It hosts nothing and represents no employer."
    >
      <ProseSection title="Who built it">
        <p>{`${CREATOR.name} — ${CREATOR.role}`}</p>
        <p>{CREATOR.motivation}</p>
      </ProseSection>

      <ProseSection title="Elsewhere">
        <ul className="flex flex-col gap-2">
          {CREATOR_LINKS.map((link) => (
            <li key={link.href}>
              <a
                className="text-accent underline underline-offset-4"
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {link.label}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
      </ProseSection>

      <ProseSection title="Getting in touch">
        <p>
          There is no contact form here. Anything about the product — a broken posting, a source
          worth adding, a bug — belongs in the repository’s issues, where it is public and gets
          tracked.
        </p>
      </ProseSection>
    </Prose>
  )
}
