import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '@/index.css'
import { AppShell, type FooterGroup, type ShellNavItem } from '@/ui/AppShell'
import { PageState } from '@/ui/PageState'
import { Skeleton } from '@/ui/Skeleton'
import { ThemeProvider } from '@/ui/theme'

// Playwright-only mount point for AppShell (see e2e/design-system-shell.spec.ts).
// AppShell itself takes no navigation/footer data from real routes yet (Plan 3
// owns routing), so its header/mobile-menu/footer contract can only be
// exercised end-to-end against a fixture like this one, not the real app.
export const FIXTURE_NAVIGATION: readonly ShellNavItem[] = [
  { label: 'Search', href: '#/', active: true, placement: 'both' },
  { label: 'Jobs', href: '#/jobs', active: false, placement: 'mobile' },
  { label: 'About', href: '#/about', active: false, placement: 'desktop' },
]

export const FIXTURE_FOOTER_GROUPS: readonly FooterGroup[] = [
  {
    label: 'Product',
    links: [{ label: 'Search', href: '#/' }],
  },
  {
    label: 'Elsewhere',
    links: [{ label: 'Source', href: 'https://example.com/jobberit', external: true }],
  },
]

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root harness element')

// AppShell no longer mounts its own ThemeProvider (Task 5 moved it to
// src/main.tsx alongside ToastProvider), so this standalone harness entry
// point provides one itself — ThemeToggle in AppShell's header needs it.
//
// PageState's three kinds and a labelled Skeleton are mounted here too:
// 'loading' has no caller in the shipped app yet (Plan 7 owns search-result
// loading UI), and there is no clean way to force a genuine zero-result
// response through the harness's static fixture data, so
// e2e/design-system-shell.spec.ts asserts all three kinds' accessibility
// tree against this isolated mount rather than mixing isolated and
// real-app assertions for the same component.
createRoot(root).render(
  <StrictMode>
    <ThemeProvider>
      <AppShell homeHref="#/" navigation={FIXTURE_NAVIGATION} footerGroups={FIXTURE_FOOTER_GROUPS}>
        <p data-testid="harness-content">Harness content</p>
      </AppShell>
      <div data-testid="page-state-loading">
        <PageState kind="loading" title="Loading results" />
      </div>
      <div data-testid="page-state-empty">
        <PageState
          kind="empty"
          title="Nothing cleared the filters."
          description="Drop a constraint, or search fewer terms."
        />
      </div>
      <div data-testid="page-state-error">
        <PageState
          kind="error"
          title="Best-match search is temporarily unavailable."
          description="reference req-error"
        />
      </div>
      <div data-testid="skeleton-sample">
        <Skeleton className="h-4 w-32" label="Loading results" />
      </div>
    </ThemeProvider>
  </StrictMode>,
)
