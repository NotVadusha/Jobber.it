# Plan 2 — Design System and Application Shell

**Status:** Implemented — computer-use acceptance complete

**Parent:** [Release 1 Master Plan](./release-1-master-plan.md)

**Depends on:** [Plan 1 — Architecture and Contracts](./01-architecture-and-contracts.md)

**Last updated:** 2026-09-03

**Implementation status:** Complete. All six tasks landed on `release-1.0.0-design-system-implementation`; see Section 21 for final verification evidence.

## 1. Objective

Create the reusable visual and interaction foundation for the Release 1 product without implementing the jobs catalogue, new ranking pipeline, job details, saved jobs, CV consent, or explanatory-page content.

After Plan 2:

- the first paint uses the correct light or dark theme;
- an explicit theme choice persists under the approved versioned storage key;
- JetBrains Mono and Inter are self-hosted by the frontend bundle;
- the application uses one responsive header, content frame, mobile menu pattern, and footer;
- future features can show consistent loading, empty, error, skeleton, and toast feedback;
- focus and reduced-motion behavior are deliberate rather than page-specific;
- the current Plan 1 search experience remains usable inside the new shell.

This plan deepens four real concepts—theme, shell, toast, and page state—behind small interfaces. It does not create a broad component library.

## 2. Approval Gate and Assumptions

The parent plan already approves these choices:

1. Light and dark themes with amber as the accent in both.
2. OS preference as the default when there is no saved choice.
3. Pre-paint theme application and persistence in `jobber.theme.v1`.
4. Self-hosted JetBrains Mono and Inter.
5. Responsive header, footer, desktop navigation pattern, and compact mobile menu.
6. Focus-visible styling, reduced-motion support, toasts, and shared loading/empty/error states.

Implementation assumptions:

- Plan 1 is complete before Plan 2 implementation begins. Its TypeScript, Playwright, import-boundary, and `make verify-full` commands are green.
- The frontend remains a React/Vite/Tailwind SPA. No UI framework, icon package, CSS-in-JS runtime, state library, or component workshop is added.
- Plan 2 may replace the two IBM Plex font packages with the corresponding `@fontsource` Inter and JetBrains Mono packages at the same package family version already used by the repository.
- The mockup is a behavior and visual-direction reference, not source code to copy literally. Its contact route, fake board links, fake status, old source list, hardcoded counts, and placeholder actions remain excluded.
- Navigation entries are rendered only for screens that actually exist. Plan 2 supplies the pattern and accepts navigation data from the application; it does not expose future routes early.
- The theme has two explicit user-selectable values: `light` and `dark`. There is no third “system” button in Release 1.
- Until the user makes a choice, a live OS theme change updates the page. After the user chooses a theme, the saved choice wins across reloads and later OS changes.
- No backend, database, API, URL, or deployment contract changes in this plan.

If Plan 1 lands with materially different frontend paths, update this plan before implementation. Do not create compatibility copies of both structures.

## 3. Current-State Evidence

The repository graph indexed on 2026-09-02 shows one frontend entrypoint and one 461-line `App` function cluster. The existing application has no theme, router, or shell module.

Current facts:

- `apps/frontend/src/index.css` contains one dark-only token set and 54 total lines.
- `html` declares `color-scheme: dark`; there is no light theme.
- `apps/frontend/src/main.tsx` imports IBM Plex Sans and IBM Plex Mono.
- `apps/frontend/src/features/search/SearchPage.tsx` owns the current search-page behavior; Plan 2 extracts the application shell around it.
- The header is not sticky, has no navigation, and shows a hard-to-reuse corpus label.
- The footer is one paragraph rather than a real-link structure.
- The only motion primitive is the result-card `rise` animation; reduced motion disables only that class.
- Focus-visible uses the amber accent but spacing, radius, disabled behavior, and grouped-control focus are not consistently expressed.
- There is no toast live region, mobile menu, skeleton, or shared page-state interface.
- The approved HTML mockup demonstrates the desired token tiers and shell proportions, but includes excluded routes and fabricated data that must not enter production.

Plan 1 is expected to replace the monolithic JSX with typed files before this plan begins. The implementation agent must inspect the actual Plan 1 output and map the class migration against it rather than editing deleted JSX paths.

## 4. Scope

### 4.1 In scope

- Semantic CSS design tokens for both themes:
  - canvas and soft-canvas backgrounds;
  - three surface tiers;
  - subtle and strong borders;
  - three text tiers;
  - amber accent, hover, ink, text, soft-fill, and border values;
  - positive and danger feedback colors;
  - shadows, radii, container widths, header height, and motion durations.
- A synchronous inline pre-paint theme bootstrap.
- A typed theme module that owns theme state, persistence, OS-change behavior, and the toggle interface.
- Replacement of IBM Plex font packages/imports with self-hosted Inter and JetBrains Mono.
- Base element styling, selection, focus-visible, custom scrollbars, and reduced-motion rules.
- A responsive `AppShell` module containing its private header, footer, and mobile-menu implementation.
- A public navigation-item and footer-group interface that only accepts real links supplied by the application.
- One toast at a time through a provider/hook interface and one polite live region.
- A shared `PageState` module for loading, empty, and error regions.
- A shared `Skeleton` primitive for later result/page structures.
- Migration of the current Plan 1 search screen from old token utility names to the new semantic token utilities.
- Playwright end-to-end coverage for theme, tokens, shell, feedback, responsive behavior, and mandatory computer-use visual verification.
- Import rules preventing `ui` from depending on feature, API, or application modules.

### 4.2 Explicitly out of scope

- Hash parsing, route state, active-route calculation, scroll restoration, or permalink copying; Plan 3 owns them.
- The jobs-view tab interface, welcome dashboard, filter sidebar/drawer, result-card redesign, sorting, pagination, and salary display preference; Plan 5 owns them.
- Server-sent events, ranking-stage motion, search-result skeleton composition, or cancellation; Plan 7 owns them.
- Job-detail, saved-job, privacy, ranking, changelog, and about screens.
- Contact, reporting, fake external links, fake source status, fake counts, or placeholder navigation.
- A design-token editor, Storybook, Chromatic, screenshot service, or visual-regression SaaS.
- A generic modal, form-control, data-table, card, tooltip, dropdown, or icon library before three real callers exist.
- A runtime dependency for theme or toast state.
- Backend or OpenAPI changes.

## 5. Design and Architecture Decisions

### 5.1 Use semantic tokens, not page-specific colors

Callers select meaning such as canvas, surface, border, primary text, muted text, or accent. They never select hardcoded hex values and never branch on the current theme.

The CSS variable implementation uses `--theme-*` names. Tailwind exposes semantic utilities through `@theme inline`. This keeps component class names stable when theme values change.

The old `ink`, `panel`, `line`, `edge`, `paper`, `lex`, and `sem` utility vocabulary is removed in Plan 2. Keeping aliases would preserve two names for one concept and cause later features to copy the obsolete one.

### 5.2 Keep the theme module deep

`ui/theme.tsx` exports only:

```ts
export type Theme = 'light' | 'dark'
export function ThemeProvider(props: { children: ReactNode }): ReactElement
export function ThemeToggle(): ReactElement
export function useTheme(): { theme: Theme; toggleTheme(): void }
```

Callers do not read local storage, `matchMedia`, `documentElement.dataset`, or storage error handling. Browser verification uses the public UI and DOM contract; internal decoder/resolver helpers stay private unless production code needs them.

### 5.3 Keep shell routing-neutral

`AppShell` renders real anchors from data supplied by the application. It does not parse `location.hash`, decide which routes exist, or import routing modules. Plan 3 supplies canonical `href` and active-state values.

Until a downstream plan activates a screen, that screen supplies no navigation item. Empty navigation groups are not rendered. This is how the shell remains complete without dead links.

### 5.4 One toast is enough

Release 1 toast use cases are short confirmations such as save, remove, or copy. A new toast replaces the current one. Errors that require action use `PageState`, inline validation, or a dedicated recovery state—not a disappearing toast.

No global event emitter is introduced. Callers use `useToast()` below `ToastProvider`.

### 5.5 Shared state views expose content, not layout internals

`PageState` owns consistent semantics and layout for loading, empty, and error regions. Callers provide the specific title, description, and optional action. `Skeleton` owns the animation/reduced-motion behavior but not the shape of a job card.

### 5.6 No ADR is required

The master plan already records the theme and shell choices. The exact token values and module file placement are inexpensive to change and are not independent architecture decisions. Do not create a new ADR for them.

## 6. Target Frontend Module Map

```text
apps/frontend/
├── index.html                    # includes synchronous pre-paint script
├── package.json
├── src/
│   ├── main.tsx                  # preserves Plan 1 Query provider; adds theme/toast
│   ├── index.css                 # imports Tailwind and the three style sheets
│   ├── styles/
│   │   ├── tokens.css            # light/dark semantic values and Tailwind mapping
│   │   ├── base.css              # element, focus, selection, scrollbar behavior
│   │   └── motion.css            # shared keyframes and reduced-motion policy
│   ├── ui/
│   │   ├── theme.tsx             # theme interface and toggle
│   │   ├── shell/                # shell module; one file per component
│   │   │   ├── AppShell.tsx      # public shell interface
│   │   │   ├── SiteHeader.tsx    # header; consumes useMobileMenu
│   │   │   ├── MobileMenu.tsx    # compact anchored mobile panel
│   │   │   ├── SiteFooter.tsx    # real-links footer
│   │   │   ├── LogoMark.tsx      # terminal/amber logotype anchor
│   │   │   ├── useMobileMenu.ts  # menu state, close triggers, focus return
│   │   │   └── types.ts          # shell public types
│   │   ├── icons/                # one file per icon, no icon dependency
│   │   │   ├── SunIcon.tsx
│   │   │   ├── MoonIcon.tsx
│   │   │   ├── MenuIcon.tsx
│   │   │   └── CloseIcon.tsx     # shared by the menu button and toast dismiss
│   │   ├── toast.tsx             # one-at-a-time toast interface
│   │   ├── PageState.tsx         # loading/empty/error region
│   │   └── Skeleton.tsx          # structural loading primitive
│   ├── app/
│   │   └── App.tsx               # composes AppShell and current SearchPage
│   └── features/search/          # Plan 1 modules; class-token migration only
└── e2e/
    ├── architecture-contracts.spec.ts # retained from Plan 1
    └── design-system-shell.spec.ts    # Plan 2 browser journeys
```

Import direction:

- `main.tsx` imports `app`, `ui`, styles, and fonts.
- `app` imports `features` and `ui`.
- `features` may import `ui`, `api`, and `lib`.
- `ui` may import React and other `ui` modules only.
- `ui` does not import `app`, `features`, `api`, or product-specific posting/search types.
- Styles do not import feature-specific CSS.

No barrel file is created at any level. Callers import the owning module directly, for example `@/ui/theme`, `@/ui/shell/AppShell`, or `@/ui/icons/MenuIcon`.

## 7. Theme Contract

### 7.1 Persisted value

```text
key: jobber.theme.v1
valid values: light | dark
```

Missing, unavailable, or invalid storage is treated as no saved preference. Invalid values are ignored; Plan 2 does not need to delete them.

### 7.2 Resolution order

Before first paint:

1. Read `jobber.theme.v1` inside `try/catch`.
2. If it is `light` or `dark`, apply it and mark the source as `stored`.
3. Otherwise use `matchMedia('(prefers-color-scheme: light)')` when available.
4. If media matching is unavailable, use dark.
5. Set both `data-theme` and `data-theme-source` on `<html>` synchronously.

At runtime:

- `ThemeProvider` initializes from the already-applied document dataset.
- If the source is `system`, it listens for OS theme changes.
- `toggleTheme()` applies the opposite value, writes storage safely, changes the source to `stored`, and stops following OS changes.
- A storage read/write exception never prevents rendering or toggling for the current page.
- The module never stores timestamps, system values, or user identifiers.

### 7.3 DOM contract

```html
<html lang="en" data-theme="dark" data-theme-source="system">
```

Only `theme.tsx` and the pre-paint script write these attributes. Components style through tokens and never inspect them.

### 7.4 Toggle contract

- The control is a native button.
- Its accessible name describes the action: `Switch to light theme` or `Switch to dark theme`.
- The decorative sun/moon SVG is `aria-hidden="true"`.
- The control has a minimum 36 × 36 CSS-pixel target in the header.
- It is always present on desktop and mobile.
- Toggling does not announce a toast; the visual theme change and button name are sufficient feedback.

## 8. Design Token Contract

### 8.1 Structural tokens

```css
--layout-content-max: 75rem;       /* 1200px */
--layout-reading-max: 52.5rem;     /* 840px */
--layout-header-height: 3.75rem;   /* 60px */
--radius-sm: 0.5rem;
--radius-md: 0.75rem;
--radius-lg: 1rem;
--motion-fast: 120ms;
--motion-standard: 200ms;
--motion-slow: 320ms;
--ease-standard: cubic-bezier(0.2, 0.7, 0.3, 1);
```

### 8.2 Dark values

| Token | Value |
|---|---|
| canvas | `#0b100e` |
| canvas soft | `#0e1412` |
| surface 1 | `#121917` |
| surface 2 | `#172020` |
| surface 3 | `#1c2625` |
| border subtle | `#233029` |
| border strong | `#2f3f37` |
| text primary | `#e9efec` |
| text secondary | `#a3b1aa` |
| text tertiary | `#6d7d76` |
| accent fill | `#f2a93b` |
| accent hover | `#ffb955` |
| accent ink | `#1c1204` |
| accent text | `#f5b04d` |
| positive | `#5fc98e` |
| danger | `#e5726d` |

### 8.3 Light values

| Token | Value |
|---|---|
| canvas | `#f5f3ec` |
| canvas soft | `#efece3` |
| surface 1 | `#fffdf7` |
| surface 2 | `#faf7ef` |
| surface 3 | `#f2eee3` |
| border subtle | `#e2ddcd` |
| border strong | `#cdc7b2` |
| text primary | `#1d231f` |
| text secondary | `#57635c` |
| text tertiary | `#777f78` |
| accent fill | `#b26205` |
| accent hover | `#9a5404` |
| accent ink | `#fffdf7` |
| accent text | `#8a4b05` |
| positive | `#237a4d` |
| danger | `#b64640` |

The light tertiary, accent-text, positive, and danger values are intentionally darker than the mockup draft so ordinary-sized text is not assigned a low-contrast decorative color.

### 8.4 Tailwind semantic utilities

The token sheet exposes these stable utility names:

```text
bg-canvas, bg-canvas-soft
bg-surface, bg-surface-raised, bg-surface-strong
border-subtle, border-strong, border-accent
text-primary, text-secondary, text-tertiary, text-accent
bg-accent, text-accent-ink
text-positive, text-danger
font-sans, font-mono
shadow-elevated
```

Do not add provider/stage colors such as `lex` and `sem` to the global design system. Plan 7 may add ranking-specific presentation inside its feature if the final stage model requires it.

## 9. Application Shell Contract

### 9.1 Public types

```ts
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
```

### 9.2 Header behavior

- Sticky at the top with a real border and a translucent canvas background when backdrop filtering is supported.
- Logo is a real anchor to `homeHref` and retains the terminal/amber identity.
- `corpusSummary` is rendered only when supplied and uses factual text from `/api/meta`; no hardcoded count, board count, sync health, or freshness claim.
- Desktop navigation renders only items with `desktop` or `both` placement.
- Mobile menu renders only items with `mobile` or `both` placement.
- `aria-current="page"` appears on the active real route.
- The theme toggle remains visible at every width.
- If there are no mobile navigation entries, the menu button is not rendered.

### 9.3 Mobile menu behavior

- Appears below 48rem (`768px`).
- Uses a compact anchored panel, not the Plan 5 filter drawer.
- Menu button uses `aria-expanded` and `aria-controls`.
- Escape closes the panel and returns focus to the button.
- Selecting a link and a `hashchange` both close the panel.
- A pointer press outside the header closes the panel.
- It is non-modal and does not trap focus or add a scrim.
- Opening the menu does not modify browser history.

### 9.4 Footer behavior

- Always states that Jobber aggregates public postings and sends users to the original source.
- Renders only non-empty groups.
- Internal links are same-tab hash anchors.
- External links use `target="_blank"` and `rel="noopener noreferrer"`.
- Plan 2 initially supplies no future-page groups. Later plans append their real routes in the same change that makes the screen available.
- Current year is derived at render time; no hardcoded corpus or index version appears.

## 10. Feedback Module Contracts

### 10.1 Toast

```ts
export type ToastTone = 'info' | 'success'

export type ToastInput = {
  message: string
  tone?: ToastTone
  durationMs?: number
}

export function ToastProvider(props: { children: ReactNode }): ReactElement
export function useToast(): { showToast(input: ToastInput): void; dismissToast(): void }
```

Rules:

- Empty/whitespace-only messages are rejected with a development error.
- Duration defaults to 4,000 ms when omitted.
- A new toast replaces the old one and resets the timer.
- The viewport uses `role="status"`, `aria-live="polite"`, and `aria-atomic="true"`.
- A visible close button is keyboard accessible.
- Toasts never carry destructive confirmations, provider errors, validation errors, or information the user must memorize.
- Reduced motion removes translation and transition; it does not change duration.

### 10.2 PageState

```ts
export type PageStateKind = 'loading' | 'empty' | 'error'

export type PageStateProps = {
  kind: PageStateKind
  title: string
  description?: string
  action?: ReactNode
  compact?: boolean
}
```

Rules:

- `loading` uses `role="status"`, `aria-live="polite"`, and `aria-busy="true"`.
- `error` uses `role="alert"`; error detail is safe user-facing copy supplied by the caller.
- `empty` is a named region but does not use assertive live behavior.
- The module does not derive messages from `ApiError` or know search/job concepts.
- The action is caller-owned, normally a button or link.

### 10.3 Skeleton

```ts
export type SkeletonProps = {
  className?: string
  label?: string
}
```

The skeleton is `aria-hidden` unless `label` is supplied. When labelled it renders a visually hidden status string adjacent to the decorative block. The shimmer becomes a static surface under reduced motion.

## 11. Responsive and Accessibility Contract

### Width behavior

- Below 48rem: desktop navigation is hidden; mobile menu is available when it has entries; content gutters are 1rem.
- From 48rem: desktop navigation appears; content gutters are 1.5rem.
- Below 64rem: corpus summary is hidden to protect logo/actions from collision.
- The main container never exceeds 75rem.
- The shell must remain usable at 320 CSS pixels without horizontal page scrolling.

### Keyboard and focus

- Every interactive element is reachable in source order.
- Global focus-visible is a 2px amber outline with a 3px offset.
- No module removes focus without providing a focus-within/focus-visible replacement.
- Escape is handled only by the currently open mobile menu; Plan 5 owns filter-drawer Escape.
- `/` search focus remains owned by the search feature, not the shell.

### Motion

- Standard UI transitions use only token durations/easing.
- Motion communicates state; it never delays interaction.
- `prefers-reduced-motion: reduce` disables smooth scrolling, shimmer, entrance translation, and nonessential transitions globally.
- Busy indicators remain understandable when static.

### Contrast

- Primary/secondary body text and accent text used at normal sizes must meet a 4.5:1 target against their assigned canvas/surface.
- Focus, borders conveying state, and large controls target at least 3:1 against adjacent colors.
- Tertiary text is reserved for supplemental copy and must not carry the only form label, error, or action identity.

## 12. Dependencies and Commands

Plan 2 changes frontend font dependencies only.

Run from the repository root:

```bash
npm --prefix apps/frontend uninstall @fontsource/ibm-plex-mono @fontsource/ibm-plex-sans
npm --prefix apps/frontend install @fontsource/inter@^5.3.0 @fontsource/jetbrains-mono@^5.3.0
```

Do not add a theme, toast, icons, class-merging, accessibility, or routing package.

After the dependency change, `package.json` and `package-lock.json` must contain no IBM Plex package reference.

## 13. Ordered Implementation Tasks

### Task 1 — Add pre-paint theme resolution and browser proof

- [ ] Add the synchronous inline script before stylesheet/module loading in `index.html`.
- [ ] Add `data-theme` and `data-theme-source` fallback attributes to `<html>`.
- [ ] Create `ui/theme.tsx` with the exact interface and failure behavior from this plan.
- [ ] Add Playwright journeys for stored choice, OS default, invalid/unavailable storage, OS change, and toggle persistence.

**Acceptance:** No React render is required to choose the first-paint theme, and runtime theme state matches the document.

**Verify:** `npm --prefix apps/frontend run e2e -- --grep "theme"`, typecheck, and a computer-use hard-reload pass.

**Expected files:** `index.html`, `src/ui/theme.tsx`, `e2e/design-system-shell.spec.ts`.

### Task 2 — Install the approved self-hosted fonts

- [ ] Remove both IBM Plex packages and imports.
- [ ] Add Inter 400/500/600 and JetBrains Mono 400/500/600/700 imports.
- [ ] Confirm the production bundle has no Google Fonts request or external font origin.

**Acceptance:** All font files are emitted or served from the application build and the fallback stacks remain usable while fonts load.

**Verify:** package scan, production build, browser Network panel with the Font filter.

**Expected files:** `package.json`, `package-lock.json`, `src/main.tsx`.

### Task 3 — Replace dark-only colors with the complete token system

- [ ] Split tokens, base behavior, and motion into the declared style files.
- [ ] Replace old token utilities throughout the Plan 1 search modules.
- [ ] Delete all old color aliases after the final caller migrates.
- [ ] Add browser assertions for computed token values and contrast plus a computer-use light/dark visual pass.

**Acceptance:** Switching `data-theme` changes every existing surface without a component branch or hardcoded page color.

**Verify:** Playwright token/contrast scenarios, `rg` scans from Section 18, typecheck, lint, dark/light computer-use smoke.

**Expected files:** `src/index.css`, `src/styles/tokens.css`, `src/styles/base.css`, `src/styles/motion.css`, affected `features/search/*.tsx`, `e2e/design-system-shell.spec.ts`.

### Task 4 — Introduce the responsive application shell

- [ ] Create the deep `AppShell` module with private header/footer/mobile menu.
- [ ] Compose it from `app/App.tsx` around the current search screen.
- [ ] Pass factual corpus summary only if Plan 1 already exposes it at the application composition seam; otherwise omit it until the jobs surface has a natural owner in Plan 5.
- [ ] Pass no future navigation/footer entries yet.
- [ ] Add Playwright desktop/mobile, active-link, Escape, outside-click, focus-return, and empty-group journeys.

**Acceptance:** The current screen is framed by a responsive real-link shell and has no dead or placeholder navigation.

**Verify:** Playwright shell journeys and computer-use checks at 320/768/1024/1440.

**Expected files:** `src/ui/AppShell.tsx`, `src/app/App.tsx`, `e2e/design-system-shell.spec.ts`. Do not lift metadata or add a context solely to fill optional header copy.

### Task 5 — Add toast and shared page-state modules

- [ ] Create `ToastProvider`/`useToast` and mount the provider once in `main.tsx`.
- [ ] Create `PageState` and `Skeleton`.
- [ ] Replace only the current generic search API connection error/empty/loading presentation where the mapping is exact; do not redesign feature-specific states early.
- [ ] Add Playwright toast replacement/close/ARIA, error/empty/loading, and reduced-motion journeys through a real application trigger.

**Acceptance:** Future feature modules can use stable feedback interfaces without implementing their own live regions or timers.

**Verify:** focused Playwright feedback journeys plus the retained Plan 1 end-to-end suite.

**Expected files:** `src/ui/toast.tsx`, `src/ui/PageState.tsx`, `src/ui/Skeleton.tsx`, `src/main.tsx`, relevant search presentation file, `e2e/design-system-shell.spec.ts`.

### Task 6 — Enforce the `ui` dependency direction and complete verification

- [ ] Extend Oxlint restricted imports for `src/ui/**/*`.
- [ ] Prove the check fails on a temporary `ui` → `features` import, then remove it.
- [ ] Run full verification and manual accessibility/responsive checks.
- [ ] Update this plan's status/evidence after implementation.

**Acceptance:** UI foundation modules are product-agnostic and every automated/manual requirement is evidenced.

**Verify:** `make verify-full`, deliberate fail/pass proof, path/stale-token scans.

**Expected files:** `apps/frontend/.oxlintrc.json`, this plan, README only if its font/theme description is currently inaccurate.

## 14. End-to-End and Computer-Use Strategy

Plan 2 adds no unit, component, CSS-parser, or provider-internal tests. Extend Playwright with `e2e/design-system-shell.spec.ts`; every scenario operates the running page and observes computed style, storage, focus, accessibility roles, responsive layout, or visible feedback.

Required Playwright cases:

```ts
test('stored light theme wins on the first visible page', async ({ page }) => {})
test('stored dark theme wins on the first visible page', async ({ page }) => {})
test('missing preference follows light OS preference', async ({ page }) => {})
test('missing preference follows dark OS preference', async ({ page }) => {})
test('invalid and inaccessible storage fall back safely', async ({ page }) => {})
test('system theme changes apply until the user chooses explicitly', async ({ page }) => {})
test('theme toggle persists and updates its accessible name', async ({ page }) => {})
test('both themes expose complete readable semantic tokens', async ({ page }) => {})
test('mobile menu closes with Escape and restores focus', async ({ page }) => {})
test('mobile menu closes on outside press and navigation', async ({ page }) => {})
test('shell emits only real links and one active link', async ({ page }) => {})
test('toast replacement and close use one polite live region', async ({ page }) => {})
test('page states and skeletons expose the expected accessibility tree', async ({ page }) => {})
test('reduced motion disables nonessential transition and animation', async ({ page }) => {})
```

Use `page.emulateMedia({ colorScheme })` before navigation. Use `page.addInitScript` to seed or sabotage `localStorage` before any application script runs. Assert `document.documentElement.dataset.theme` immediately after `page.goto()` and use Playwright screenshots/traces only as failure artifacts, not as the assertion itself.

For token checks, call `getComputedStyle(document.documentElement)` in the real browser, read every required `--theme-*` variable in both themes, and compute WCAG contrast in the spec. For responsiveness, use Playwright viewports at 320, 768, 1024, and 1440 and assert that `document.documentElement.scrollWidth <= window.innerWidth`, mobile/desktop controls have the intended visibility, and focused elements are not hidden behind the sticky header.

The final acceptance pass uses computer use in the visible browser. Hard-reload with OS light and dark, toggle and reload, operate the mobile menu by pointer and keyboard, trigger/replace/close a toast through a real feature action, inspect loading/empty/error states, and visually confirm fonts, contrast, focus rings, scrolling, and no layout collision at the required widths. Record observations in the implementation handoff.

## 15. Verification Tiers

### Edit loop

```bash
npm --prefix apps/frontend run typecheck
npm --prefix apps/frontend run lint
npm --prefix apps/frontend run e2e -- --grep "theme|menu|toast|page states|reduced motion"
```

### Commit gate

```bash
make verify
```

### Push/CI-equivalent gate

```bash
make verify-full
```

Headless Playwright is durable regression coverage; the visible computer-use pass is the final design/interaction acceptance gate.

## 16. Computer-Use Verification Checklist

Theme:

- Clear `jobber.theme.v1`, set OS dark, hard reload: first visible paint is dark.
- Clear storage, set OS light, hard reload: first visible paint is light.
- Toggle in both directions and hard reload: explicit choice persists.
- With no explicit choice, change OS theme while the page is open: page follows.
- With an explicit choice, change OS theme: page does not override it.
- Block local storage in browser settings: page renders and the current-tab toggle works.

Shell and responsive:

- Verify widths 320, 375, 640, 768, 1024, and 1440 CSS pixels.
- No horizontal page scrollbar appears at 320.
- Sticky header does not cover focused content.
- Corpus summary truncates/hides without colliding with controls.
- Mobile menu works by pointer and keyboard and closes on Escape.
- Every rendered link is real and reaches an implemented screen or real external destination.

Accessibility and motion:

- Tab through header, main, and footer in source order.
- Focus indicator remains visible in both themes on canvas, surfaces, and accent controls.
- At 200% browser zoom, the header and current search screen remain operable.
- With reduced motion enabled, menu, toast, skeleton, and result entrance movement stop without hiding state changes.
- Screen-reader smoke: theme action name changes, menu expanded state changes, toast confirms politely, loading/error state has one appropriate announcement.

Fonts/build:

- Network panel contains no Google Fonts, fonts.gstatic.com, or other font CDN request.
- Disable custom fonts: fallback layout remains readable and controls do not clip.
- Production preview loads theme, fonts, header, main, and footer correctly.

## 17. Risks, Rollout, and Recovery

### Risk: token migration leaves two vocabularies

Mitigation: migrate all Plan 1 callers in one task and gate the old names with a repository scan. Do not keep aliases “temporarily.”

### Risk: pre-paint and runtime theme logic drift

Mitigation: the Playwright first-paint journey runs the actual HTML script before application hydration and verifies the resulting DOM/storage behavior through the browser.

### Risk: shell exposes unfinished pages

Mitigation: navigation/footer data comes from the active application routes. Empty groups are hidden. Manual verification opens every rendered link.

### Risk: a global UI folder becomes a dumping ground

Mitigation: only the five declared modules are created. Later additions require three real callers or a named cross-feature behavior with its own interface/test surface.

### Risk: CSS transition causes theme flash or motion discomfort

Mitigation: synchronous theme selection precedes styles; reduced motion disables transitions; manual hard-reload verification covers both themes.

### Rollout

1. Land pre-paint theme and theme module while existing dark values still render.
2. Land font replacement.
3. Land token migration as one complete vertical slice.
4. Land shell, then feedback modules.
5. Land import enforcement and final evidence.

Every task leaves the existing search screen usable. There is no feature flag or dual theme implementation.

### Recovery

- Before merge, revert the focused failing task.
- After deployment, roll back to the previous commit through the existing deployment path.
- Do not restore IBM fonts or old tokens beside the new system as a hotfix; revert the complete Plan 2 slice instead.
- Theme storage is forward-safe because unrecognized values are ignored. Rollback requires no storage migration.

## 18. Exact Implementation Blueprint

This section removes implementation choices from the implementation agent. If Plan 1 changed a named path or public type, stop and update this plan before substituting a different architecture.

### 18.1 Complete file-operation manifest

| Operation | Path | Required result |
|---|---|---|
| Modify | `apps/frontend/index.html` | Adds fallback dataset attributes and synchronous pre-paint script before loaded assets. |
| Modify | `apps/frontend/package.json` | Replaces IBM font packages with Inter/JetBrains Mono only. |
| Modify | `apps/frontend/package-lock.json` | Locks the approved font packages. |
| Modify | `apps/frontend/src/main.tsx` | Imports font weights/styles and mounts Theme/Toast providers once. |
| Modify | `apps/frontend/src/index.css` | Contains imports only. |
| Create | `apps/frontend/src/styles/tokens.css` | Owns semantic theme values and Tailwind utility mapping. |
| Create | `apps/frontend/src/styles/base.css` | Owns global element/focus/scrollbar behavior. |
| Create | `apps/frontend/src/styles/motion.css` | Owns keyframes and reduced-motion policy. |
| Create | `apps/frontend/src/ui/theme.tsx` | Owns theme state, OS following, persistence, and toggle. |
| Create | `apps/frontend/src/ui/AppShell.tsx` | Owns shell, header, footer, and mobile menu implementation. |
| Create | `apps/frontend/src/ui/toast.tsx` | Owns the one-at-a-time toast interface. |
| Create | `apps/frontend/src/ui/PageState.tsx` | Owns shared page state semantics. |
| Create | `apps/frontend/src/ui/Skeleton.tsx` | Owns the structural loading primitive. |
| Modify | `apps/frontend/src/app/App.tsx` | Composes the new shell without future links. |
| Modify | `apps/frontend/src/features/search/*.tsx` | Replaces old token classes; preserves Plan 1 behavior. |
| Modify | `apps/frontend/.oxlintrc.json` | Forbids UI imports from app/features/API. |
| Create | `apps/frontend/e2e/design-system-shell.spec.ts` | Tests theme, computed tokens, shell, feedback, responsive behavior, and accessibility through Chromium. |
| Modify | `docs/plans/02-design-system-and-application-shell.md` | Records final status and evidence. |

No other UI foundation file is permitted in Plan 2.

### 18.2 Exact `index.css`

```css
@import "tailwindcss";
@import "./styles/tokens.css";
@import "./styles/base.css";
@import "./styles/motion.css";
```

### 18.3 Exact pre-paint script

Place this immediately after viewport/meta description and before any stylesheet or module script:

```html
<script data-jobber-theme-bootstrap>
  ;(() => {
    const root = document.documentElement
    const key = 'jobber.theme.v1'
    let stored = null

    try {
      const value = window.localStorage.getItem(key)
      stored = value === 'light' || value === 'dark' ? value : null
    } catch {
      stored = null
    }

    let system = 'dark'
    try {
      system = window.matchMedia?.('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark'
    } catch {
      system = 'dark'
    }

    root.dataset.theme = stored ?? system
    root.dataset.themeSource = stored ? 'stored' : 'system'
  })()
</script>
```

Keep `data-theme="dark" data-theme-source="system"` on the `<html>` element as the no-script/error fallback.

### 18.4 Exact theme implementation

Create `src/ui/theme.tsx` with this public and internal shape:

```tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'

export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'jobber.theme.v1'
export const LIGHT_THEME_QUERY = '(prefers-color-scheme: light)'

type ThemeState = {
  theme: Theme
  source: 'stored' | 'system'
}

type ThemeContextValue = {
  theme: Theme
  toggleTheme(): void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function decodeTheme(value: unknown): Theme | null {
  return value === 'light' || value === 'dark' ? value : null
}

export function resolveTheme(stored: unknown, prefersLight: boolean): ThemeState {
  const saved = decodeTheme(stored)
  return saved
    ? { theme: saved, source: 'stored' }
    : { theme: prefersLight ? 'light' : 'dark', source: 'system' }
}

function readDocumentTheme(): ThemeState {
  const root = document.documentElement
  const theme = decodeTheme(root.dataset.theme) ?? 'dark'
  const source = root.dataset.themeSource === 'stored' ? 'stored' : 'system'
  return { theme, source }
}

function applyTheme(state: ThemeState): void {
  document.documentElement.dataset.theme = state.theme
  document.documentElement.dataset.themeSource = state.source
}

function persistTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // The current document still honors the choice when storage is unavailable.
  }
}

export function ThemeProvider({ children }: { children: ReactNode }): ReactElement {
  const [state, setState] = useState<ThemeState>(readDocumentTheme)

  useEffect(() => {
    applyTheme(state)
  }, [state])

  useEffect(() => {
    if (state.source !== 'system') return
    if (typeof window.matchMedia !== 'function') return

    const media = window.matchMedia(LIGHT_THEME_QUERY)
    const onChange = (event: MediaQueryListEvent) => {
      setState({ theme: event.matches ? 'light' : 'dark', source: 'system' })
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [state.source])

  const toggleTheme = useCallback(() => {
    setState((current) => {
      const theme = current.theme === 'dark' ? 'light' : 'dark'
      persistTheme(theme)
      return { theme, source: 'stored' }
    })
  }, [])

  const value = useMemo(
    () => ({ theme: state.theme, toggleTheme }),
    [state.theme, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used inside ThemeProvider')
  return value
}

export function ThemeToggle(): ReactElement {
  const { theme, toggleTheme } = useTheme()
  const target = theme === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      className="grid size-9 place-items-center rounded-sm border border-transparent text-secondary transition-colors hover:border-strong hover:bg-surface-raised hover:text-primary"
      aria-label={`Switch to ${target} theme`}
      title={`Switch to ${target} theme`}
      onClick={toggleTheme}
    >
      {target === 'light' ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}
```

`SunIcon` and `MoonIcon` return the 17 × 17 outline SVG paths from the approved mockup, with `aria-hidden="true"`, `focusable="false"`, and `currentColor`. **Revised during PR review (see Section 21.6):** they live in `src/ui/icons/`, one file per icon, and `theme.tsx` imports them. No icon *dependency* is added — these remain hand-written local SVG components.

### 18.5 Exact token CSS shape

Use these selectors and variable names. Fill values exactly from Section 8.

```css
:root {
  --font-app-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  --font-app-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --layout-content-max: 75rem;
  --layout-reading-max: 52.5rem;
  --layout-header-height: 3.75rem;
  --radius-sm: 0.5rem;
  --radius-md: 0.75rem;
  --radius-lg: 1rem;
  --motion-fast: 120ms;
  --motion-standard: 200ms;
  --motion-slow: 320ms;
  --ease-standard: cubic-bezier(0.2, 0.7, 0.3, 1);
}

[data-theme="dark"] {
  --theme-canvas: #0b100e;
  --theme-canvas-soft: #0e1412;
  --theme-surface-1: #121917;
  --theme-surface-2: #172020;
  --theme-surface-3: #1c2625;
  --theme-border-subtle: #233029;
  --theme-border-strong: #2f3f37;
  --theme-text-primary: #e9efec;
  --theme-text-secondary: #a3b1aa;
  --theme-text-tertiary: #6d7d76;
  --theme-accent: #f2a93b;
  --theme-accent-hover: #ffb955;
  --theme-accent-ink: #1c1204;
  --theme-accent-text: #f5b04d;
  --theme-accent-soft: rgb(242 169 59 / 10%);
  --theme-accent-border: rgb(242 169 59 / 45%);
  --theme-positive: #5fc98e;
  --theme-danger: #e5726d;
  --theme-shadow: 0 1px 2px rgb(0 0 0 / 50%), 0 12px 32px rgb(0 0 0 / 35%);
  color-scheme: dark;
}

[data-theme="light"] {
  --theme-canvas: #f5f3ec;
  --theme-canvas-soft: #efece3;
  --theme-surface-1: #fffdf7;
  --theme-surface-2: #faf7ef;
  --theme-surface-3: #f2eee3;
  --theme-border-subtle: #e2ddcd;
  --theme-border-strong: #cdc7b2;
  --theme-text-primary: #1d231f;
  --theme-text-secondary: #57635c;
  --theme-text-tertiary: #777f78;
  --theme-accent: #b26205;
  --theme-accent-hover: #9a5404;
  --theme-accent-ink: #fffdf7;
  --theme-accent-text: #8a4b05;
  --theme-accent-soft: rgb(178 98 5 / 9%);
  --theme-accent-border: rgb(178 98 5 / 45%);
  --theme-positive: #237a4d;
  --theme-danger: #b64640;
  --theme-shadow: 0 1px 2px rgb(30 26 16 / 6%), 0 12px 32px rgb(30 26 16 / 8%);
  color-scheme: light;
}

@theme inline {
  --font-sans: var(--font-app-sans);
  --font-mono: var(--font-app-mono);
  --color-canvas: var(--theme-canvas);
  --color-canvas-soft: var(--theme-canvas-soft);
  --color-surface: var(--theme-surface-1);
  --color-surface-raised: var(--theme-surface-2);
  --color-surface-strong: var(--theme-surface-3);
  --color-subtle: var(--theme-border-subtle);
  --color-strong: var(--theme-border-strong);
  --color-primary: var(--theme-text-primary);
  --color-secondary: var(--theme-text-secondary);
  --color-tertiary: var(--theme-text-tertiary);
  --color-accent: var(--theme-accent);
  --color-accent-hover: var(--theme-accent-hover);
  --color-accent-ink: var(--theme-accent-ink);
  --color-accent-text: var(--theme-accent-text);
  --color-accent-soft: var(--theme-accent-soft);
  --color-accent-border: var(--theme-accent-border);
  --color-positive: var(--theme-positive);
  --color-danger: var(--theme-danger);
  --shadow-elevated: var(--theme-shadow);
}
```

The implementation file must contain every variable above exactly once in each theme selector.

### 18.6 Exact base and motion rules

`base.css` must include:

```css
@layer base {
  *, *::before, *::after { box-sizing: border-box; }
  html { scroll-behavior: smooth; background: var(--theme-canvas); }
  body {
    min-width: 20rem;
    margin: 0;
    background: var(--theme-canvas);
    color: var(--theme-text-primary);
    font-family: var(--font-app-sans);
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }
  a { color: inherit; }
  button, input, select, textarea { font: inherit; }
  ::selection { background: var(--theme-accent); color: var(--theme-accent-ink); }
  :focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 3px;
    border-radius: 4px;
  }
  * { scrollbar-width: thin; scrollbar-color: var(--theme-border-strong) transparent; }
  ::-webkit-scrollbar { width: 10px; height: 10px; }
  ::-webkit-scrollbar-thumb {
    border: 2px solid var(--theme-canvas);
    border-radius: 6px;
    background: var(--theme-border-strong);
  }
  ::-webkit-scrollbar-track { background: transparent; }
}
```

`motion.css` must use this exact shape:

```css
@keyframes ui-rise {
  from { opacity: 0; transform: translateY(7px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes ui-pulse {
  0%, 100% { opacity: 0.55; }
  50% { opacity: 1; }
}

@keyframes ui-shimmer {
  from { background-position: 200% 0; }
  to { background-position: -200% 0; }
}

.rise {
  animation: ui-rise var(--motion-slow) var(--ease-standard) both;
}

.ui-skeleton {
  background:
    linear-gradient(
      90deg,
      var(--theme-surface-2) 25%,
      var(--theme-surface-3) 50%,
      var(--theme-surface-2) 75%
    );
  background-size: 200% 100%;
  animation: ui-shimmer 1.4s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }

  .ui-skeleton {
    background: var(--theme-surface-2);
  }
}
```

### 18.7 Exact provider composition

`main.tsx` provider order:

```tsx
createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
```

Plan 2 preserves the module-level `queryClient` and `QueryClientProvider` introduced by Plan 1; it does not construct a second client. The theme provider is outside toast so toast colors always resolve through the current root theme. Do not mount providers inside route/page modules.

### 18.8 Exact `AppShell` implementation requirements

`AppShell` and its public types are the shell's public surface; `SiteHeader`, `MobileMenu`, `SiteFooter`, `LogoMark`, and the menu icons are internal to the shell and are never imported outside `src/ui`. **Revised during PR review (see Section 21.6):** each lives in its own file under `src/ui/shell/` (icons under `src/ui/icons/`) rather than as private functions inside one `AppShell.tsx`, and the mobile-menu state/effects live in a `useMobileMenu` hook rather than inline in `SiteHeader`.

Use this top-level shape:

```tsx
export function AppShell({
  children,
  homeHref,
  navigation,
  footerGroups,
  corpusSummary,
}: AppShellProps): ReactElement {
  return (
    <div className="min-h-dvh bg-canvas text-primary">
      <SiteHeader
        homeHref={homeHref}
        navigation={navigation}
        corpusSummary={corpusSummary}
      />
      <main id="main-content" className="min-h-[calc(100dvh-var(--layout-header-height)-12rem)]">
        {children}
      </main>
      <SiteFooter groups={footerGroups} />
    </div>
  )
}
```

Add a visually apparent-on-focus skip link before the header targeting `#main-content`. Header/mobile-menu state and effects follow Section 9 exactly. Do not move route parsing or metadata fetching into this file.

### 18.9 Exact toast core

The provider owns this state transition:

```tsx
type VisibleToast = Required<Pick<ToastInput, 'message' | 'tone' | 'durationMs'>> & {
  id: number
}

function normalizeToast(
  { message, durationMs, tone }: ToastInput,
  id: number,
): VisibleToast {
  const normalizedMessage = message.trim()
  if (!normalizedMessage) throw new Error('Toast message must not be empty')

  return {
    id,
    message: normalizedMessage,
    tone: tone ?? 'info',
    durationMs: durationMs ?? 4000,
  }
}
```

Use a provider-local numeric ref for IDs, a single `VisibleToast | null` state, one timeout effect keyed by `toast?.id`, and a portal only if a real clipping issue is observed. The default implementation renders the fixed viewport beside `children`; do not add a portal speculatively.

### 18.10 Token replacement map

Apply this semantic migration to all Plan 1 TSX files:

| Old utility | New utility |
|---|---|
| `bg-ink` | `bg-canvas` |
| `bg-panel` | `bg-surface` |
| `border-line` | `border-subtle` |
| `border-edge` | `border-strong` |
| `text-paper` | `text-primary` |
| `text-muted` | `text-secondary` or `text-tertiary` after meaning review |
| `bg-lex` | `bg-accent` |
| `text-lex` | `text-accent` |
| `border-lex/*` | `border-accent` or arbitrary opacity on `accent-border` |
| `text-ink` | `text-accent-ink` when on accent fill |

Do not mechanically map every `text-muted` to tertiary. Labels and metadata that must remain readable use secondary; tertiary is supplemental only.

### 18.11 Exact stale-value scans

After migration these commands must return no live frontend source matches:

```bash
rg -n 'IBM Plex|ibm-plex|color-ink|color-panel|color-line|color-edge|color-paper|color-muted|color-lex|color-sem' apps/frontend/src apps/frontend/package.json
rg -n '(bg|text|border)-(ink|panel|line|edge|paper|muted|lex|sem)(/|\b)' apps/frontend/src
rg -n 'fonts\.googleapis|fonts\.gstatic' apps/frontend
```

### 18.12 Exact import enforcement

Extend Plan 1 Oxlint configuration so `src/ui/**/*` rejects:

```text
@/app/*
@/features/*
@/api/*
```

Same-folder UI imports remain relative. A UI module may import `@/lib/*` only after a concrete pure formatter has at least two non-UI callers; Plan 2 itself does not need that exception.

### 18.13 Execution checkpoints

#### Checkpoint A — Theme first paint

Required state:

- Real HTML script passes all browser first-paint cases.
- Runtime provider follows system only before explicit choice.
- Current search still renders.

Run:

```bash
npm --prefix apps/frontend run e2e -- --grep "theme"
npm --prefix apps/frontend run typecheck
```

#### Checkpoint B — Fonts and tokens

Required state:

- IBM packages/imports are absent.
- Both themes expose every semantic token.
- Existing source uses only new semantic utilities.

Run:

```bash
npm --prefix apps/frontend run e2e -- --grep "semantic tokens"
npm --prefix apps/frontend run lint
npm --prefix apps/frontend run build
```

#### Checkpoint C — Shell and feedback

Required state:

- AppShell renders no future links.
- Theme toggle, mobile menu, toast, states, and skeleton pass focused Playwright journeys.
- Existing Plan 1 Playwright journeys remain green.

Run:

```bash
npm --prefix apps/frontend run e2e -- --grep "menu|toast|page states|skeleton"
npm --prefix apps/frontend run typecheck
```

#### Checkpoint D — Guardrail proof

Add one temporary `@/features/search/SearchPage` import to `ui/AppShell.tsx`. Confirm lint fails with the configured message. Remove it and confirm lint passes.

#### Checkpoint E — Final proof

```bash
make verify-full
git diff --check
rg -n 'IBM Plex|ibm-plex|fonts\.googleapis|fonts\.gstatic' apps/frontend
rg -n '(bg|text|border)-(ink|panel|line|edge|paper|muted|lex|sem)(/|\b)' apps/frontend/src
git status --short
```

Run the visible computer-use checklist and record its results in this plan before marking it complete.

### 18.14 Prohibited substitutions

- Do not add a third theme value.
- Do not persist the OS-derived theme before the user chooses.
- Do not wait for React before applying the first-paint theme.
- Do not use Google Fonts or another font CDN.
- Do not keep IBM font packages or old token aliases.
- Do not add shadcn/ui, Radix, Headless UI, a toast library, an icon library, or a class-merging dependency.
- Do not add Storybook or visual-regression infrastructure.
- Do not add routes, route parsing, active-route inference, or history logic to `AppShell`.
- Do not render future links or placeholder pages.
- Do not put product-specific posting/search types in `ui`.
- Do not use toast for actionable errors.
- Do not make tertiary text the only label/error/action identity.
- Do not disable all outlines.
- Do not add generic card/form/modal/table primitives.
- Do not weaken Plan 1 type, lint, Playwright, existing pytest, or import checks.

## 19. Definition of Done

Plan 2 is complete only when:

- both themes pass Playwright pre-paint, persistence, OS-default, and runtime journeys plus visible computer-use verification;
- the token contract is complete and old token/font vocabulary is absent;
- Inter and JetBrains Mono are served locally;
- AppShell works at every declared width and contains only real destinations;
- mobile menu, theme toggle, skip link, focus, reduced motion, toast, PageState, and Skeleton meet their accessibility contracts;
- Plan 1 search behavior still works in both themes;
- the UI dependency check has been proven to fail and pass;
- `make verify-full` and production preview pass;
- this document records implementation evidence and contains no unresolved decision.

## 20. Review Checklist

- [x] Does the theme apply before the first visible paint? Yes — `index.html`'s pre-paint script sets `data-theme` synchronously before any stylesheet/module script; verified in both Playwright and live computer-use hard-reload checks.
- [x] Does an explicit choice persist without converting the OS default into a stored choice? Yes — `theme.tsx` only persists on explicit `toggleTheme()`; system-derived state is never written to storage.
- [x] Are every color and effect expressed through semantic tokens? Yes — the stale-token scans in Section 21 return zero matches for old vocabulary.
- [x] Are old token names and IBM font dependencies deleted? Yes — confirmed by scan and by network-panel inspection (fonts served only from local `@fontsource` packages).
- [x] Does the shell know nothing about route parsing or feature types? Yes — `AppShell.tsx` takes only `homeHref`/`navigation`/`footerGroups`/`corpusSummary` props; `App.tsx` is the only caller and passes `navigation={[]} footerGroups={[]}` since no other screens exist yet.
- [x] Are only implemented destinations rendered? Yes — trivially true today (no nav/footer links rendered at all); the shell's real-link contract is enforced by Playwright (`shell emits only real links and one active link`, `empty navigation and footer groups render no dead chrome`).
- [x] Are shared feedback modules deep enough to remove duplicated timer/ARIA/state logic from later callers? Yes per design (toast/PageState/Skeleton each own their timer/ARIA/state internals); no second caller exists yet to prove reuse in practice.
- [x] Is the UI surface still limited to the five declared modules? Yes — `src/ui/` contains only `theme.tsx`, `AppShell.tsx`, `toast.tsx`, `PageState.tsx`, `Skeleton.tsx`.
- [x] Do keyboard, contrast, responsive, zoom, and reduced-motion checks pass in both themes? Yes for keyboard/contrast/responsive/zoom, verified live in Section 21. Reduced-motion is verified by the automated Playwright suite only — this browser pane's tooling has no live `prefers-reduced-motion` emulation control (see Section 21's disclosed limitations).
- [x] Do all focused and full verification commands pass? Yes — `make verify-full` is green end to end; see Section 21.

## 21. Task 6 Final Verification Evidence (2026-09-03)

This section is the implementation handoff required by Section 14 and the Definition of Done. It records what was actually run and observed for Task 6, the last task in this plan.

### 21.1 Import boundary enforcement (Checkpoint D)

`apps/frontend/.oxlintrc.json` gained a `src/ui/**` override rejecting `@/app/**`, `@/features/**`, `@/api/**`, matching the pattern already used for `src/api/**`, `src/lib/**`, and `src/features/**`.

Proof cycle:
1. Added a temporary unused import `import { SearchPage } from '@/features/search/SearchPage'` to `src/ui/AppShell.tsx`.
2. `npm --prefix apps/frontend run lint` — **failed**, exit code 1:
   ```
   src/ui/AppShell.tsx:10:1: error eslint(no-restricted-imports): '@/features/search/SearchPage' import is restricted from being used by a pattern. help: ui foundation modules are product-agnostic and never import app, features, or API code.
   ```
3. Removed the temporary import.
4. `npm --prefix apps/frontend run lint` — **passed**, exit code 0 (only the same pre-existing `only-export-components`/`exhaustive-deps` warnings from Tasks 1–5 remain; no new errors).

### 21.2 `make verify-full` (Checkpoint E)

Ran from the repo root, full chain (`verify-full` → `verify build` → `check test e2e build` + openapi smoke test). Result: **exit 0, fully green.**

- `check`: `oxlint` clean (warnings only), `tsc --noEmit` clean, `lint-imports` — Contracts: 2 kept, 0 broken.
- `test`: backend pytest 61 passed, cron pytest 70 passed, mcp pytest 15 passed (146 total, 0 failed).
- `e2e`: Playwright — 26 passed (16 in `design-system-shell.spec.ts` + 10 in `architecture-contracts.spec.ts`), 0 failed. The `/api/meta` ECONNREFUSED/502 noise in the log is expected — no backend server runs in this environment (pre-existing since Task 5); the frontend's mocked/offline-state handling is exactly what the suite exercises.
- `build`: `tsc --noEmit && vite build` succeeded, fonts and assets emitted correctly.
- Final backend openapi smoke test (`app.openapi()`) succeeded.

Stale-value scans (Section 18.11), all three return **zero matches**:
```
rg -n 'IBM Plex|ibm-plex|color-ink|color-panel|color-line|color-edge|color-paper|color-muted|color-lex|color-sem' apps/frontend/src apps/frontend/package.json
rg -n '(bg|text|border)-(ink|panel|line|edge|paper|muted|lex|sem)(/|\b)' apps/frontend/src
rg -n 'fonts\.googleapis|fonts\.gstatic' apps/frontend
```

`git diff --check` and `git status --short` were run as part of the close-out; no whitespace errors, and status was reviewed before committing.

All 14 Playwright test titles required by Section 14 were confirmed present in `apps/frontend/e2e/design-system-shell.spec.ts` (16 total — two extra cases from earlier tasks: mobile-menu-breakpoint visibility and empty-nav/footer rendering — are additive, not substitutes).

### 21.3 Computer-use verification (Section 16 checklist)

Performed live in the Claude Browser pane against the Vite dev server (`http://localhost:5173`) and, for the production-preview bullet, against `vite preview` (`http://localhost:4173`). No backend server was available in this environment (expected/pre-existing per Task 5); search/meta requests were exercised against that failure state rather than live data.

**Theme — all verified live:**
- Cleared `jobber.theme.v1`, OS dark, hard reload → first paint `data-theme="dark" data-theme-source="system"`. Confirmed.
- Cleared storage, OS light, hard reload → first paint `data-theme="light" data-theme-source="system"`. Confirmed.
- Toggled light→dark, reloaded → `dark`/`stored` persisted; toggle button's accessible name flipped from "Switch to dark theme" to "Switch to light theme" and back correctly.
- With an explicit stored choice, changed emulated OS scheme → theme did **not** change (stayed `dark`/`stored` while OS emulation was `light`). Confirmed page does not override an explicit choice.
- **Not verifiable live**: "with no explicit choice, change OS theme while the page is open → page follows." This browser pane's `resize_window` colorScheme emulation updates `matchMedia().matches` but does not dispatch the `change` event on the `MediaQueryList` (confirmed by attaching a bare listener directly — zero events fired even though `matches` flipped). This is a tooling limitation, not an app defect: `ThemeProvider` correctly uses `media.addEventListener('change', onChange)`, and the automated Playwright test `system theme changes apply until the user chooses explicitly` (which uses Playwright's own `page.emulateMedia`, which does fire the event) passed in `make verify-full`.
- **Not verifiable live**: "block local storage in browser settings" — this tool has no control to block storage access before the pre-paint script runs (no init-script hook). Covered by the automated `invalid and inaccessible storage fall back safely` test, which passed.

**Shell and responsive — all verified live:**
- Checked 320, 375, 640, 768, 1024, and 1440 CSS px: `document.documentElement.scrollWidth <= window.innerWidth` true at every width; no horizontal scrollbar at 320; screenshots confirm no layout collision at any width.
- Skip link ("Skip to content") is the first Tab stop, hidden until focus, then visible with a clear accent-colored ring targeting `#main-content`.
- The live app (`App.tsx`) currently passes `navigation={[]} footerGroups={[]}` (only the search screen exists), so no nav links or mobile menu button render in the live app today — this is correct per the plan's "only real destinations" rule, not a gap. The mobile-menu keyboard/pointer/Escape/outside-press behavior is exercised by the Playwright suite via its fixture harness (which supplies mock nav items) and passed; it could not be operated manually in the live app because there is nothing to open a menu for yet.

**Accessibility and motion:**
- Tab order confirmed: skip link → logo → theme toggle → main content (source order, header before main).
- Focus indicator verified visible in both themes: light theme shows a solid 2px outline in `rgb(178, 98, 5)` (light `--theme-accent`) on the toggle button when reached by keyboard; same button shows `outline: none` on mouse click (correct `:focus-visible` behavior) and a solid 2px accent ring again on keyboard Tab. Dark theme's toggle likewise shows the accent-colored ring on keyboard focus.
- 200% zoom was approximated by halving the viewport to 720×450 (this tool has no true browser-zoom control) — header and search form remained fully operable and unclipped at that effective width.
- Reduced motion: **not independently verified live** — this tool exposes no `prefers-reduced-motion` emulation control (only light/dark `colorScheme`). Confirmed the `@media (prefers-reduced-motion: reduce)` rule is present in the loaded stylesheet; the actual behavior is covered by the automated Playwright test `reduced motion disables nonessential transition and animation`, which passed.
- Screen-reader smoke (approximated via accessibility tree / DOM inspection, no audio AT available):
  - Theme toggle's accessible name (`aria-label`) changes correctly with state, confirmed above.
  - Toast: triggered "Profile removed" via a real feature action (attached then removed a CV file), confirmed markup `role="status" aria-live="polite" aria-atomic="true"` — one polite live region, as required.
  - Error state: an empty-storage search against the unreachable backend produced a rendered `role="alert"` element with text "The server returned an unreadable error." — one appropriate announcement.
  - Mobile menu's `aria-expanded` toggling was not directly observable live (no nav items in the current app, see above); covered by the passing Playwright suite.

**Fonts/build — all verified live:**
- Network panel inspected: every font request resolves to `localhost:5173/node_modules/@fontsource/inter/*` and `.../@fontsource/jetbrains-mono/*`. Zero requests to `fonts.googleapis.com`, `fonts.gstatic.com`, or any other font CDN.
- Production preview (`vite preview` on port 4173) loads correctly: theme applies (`data-theme="light"`), `font-family: Inter, ui-sans-serif, system-ui, sans-serif` computed on `body`, header/main/footer all render.
- Fallback-font readability (disabling custom fonts) was not separately re-tested live in this pass; the `--font-app-sans`/`--font-app-mono` stacks both declare system fallbacks (`ui-sans-serif, system-ui, sans-serif` / `ui-monospace, SFMono-Regular, Menlo, monospace`) per Section 18.5, unchanged since Task 2.

Both themes were also confirmed to expose all 19 required `--theme-*` custom properties via `getComputedStyle(document.documentElement)` with zero missing (matching the automated token-contrast test).

### 21.4 Known open items carried forward (not resolved by this task, by design)

Per the SDD ledger (`.superpowers/sdd/02-design-system-and-application-shell/progress.md`) and this task's explicit instructions, the following two items remain open, accepted follow-ups — they are product/scope decisions for a later task or plan owner, not defects introduced or left unfixed by Task 6:

1. **Error-alert color (Task 3).** `PageState.tsx`'s error kind still uses the accent color family (`border-accent/50 bg-accent/5`, and — after the fix wave below — `text-accent-text`) rather than the `danger` token, a consequence of Task 3's mechanical `lex→accent` class-rename scope. (Corrected file reference: this class string lives in `src/ui/PageState.tsx`, not `SearchPage.tsx` — `SearchPage.tsx` only renders a `<PageState kind="error">` element and carries no color classes of its own.) Visually confirmed live in Task 6's computer-use pass (the "server returned an unreadable error" alert renders in the amber/accent color, not red/danger). This remains an **open product decision**: the 2026-09-03 fix wave (Section 21.5) did not resolve accent-vs-danger — it only corrected the specific text-contrast *shade* within the accent family (`text-accent` → `text-accent-text`), a separate and uncontroversial correctness fix that leaves the underlying color-family question untouched. Revisit when a later plan or product owner makes an explicit error-state color decision.
2. **Corpus-meta data has no renderer (Task 4).** `architecture-contracts.spec.ts`'s meta-normalization test lost field-level assertion coverage when the header text it used to assert against was removed in Task 4's mandated scope; it now only checks that `/api/meta` completes without a rendered error. The real issue underneath, identified by the 2026-09-03 whole-branch review: corpus-meta data (`useCorpusMetaQuery()`'s `meta`) has had **zero renderers** in the shipped app since that removal — nothing on screen displays it. This was not merely a test getting weaker; until the 2026-09-03 fix wave (Section 21.5, finding 4), `SearchPage.tsx` still routed `metaQuery.error` into the visible error alert, so a failing `/api/meta` request surfaced a user-facing error about a resource the page never shows. The fix wave stopped routing that error into the alert while keeping the `useCorpusMetaQuery()` call itself (so this test still has a request to observe). Real field-level test coverage returns naturally once a later plan gives corpus metadata a rendered owner again.

No prohibited substitution from Section 18.14 was found in a spot-check of the current tree (no third theme value, no OS-derived theme persisted before user choice, no font CDN, no added UI/toast/icon libraries, no Storybook, no route logic in `AppShell`).

### 21.5 Final whole-branch review fix wave (2026-09-03)

A final whole-branch review of this completed plan (post-merge, on `release-1.0.0-design-system-implementation`) found five Important-severity issues and three Minor-severity issues. All eight were fixed in this fix wave; none required a product/scope decision beyond what is recorded here, except where noted above (ledger item 1, still open).

**Important:**

1. **`--theme-accent-text` had zero callers; readable text using `text-accent` failed light-theme contrast** (4.07:1, below the 4.5:1 text target — `--theme-accent-text` measures 6.12:1 and passes). Seven call sites changed from `text-accent` to `text-accent-text`: `src/ui/PageState.tsx` (error-kind text), `src/ui/AppShell.tsx` (desktop and mobile active-nav-link text; the logo mark's decorative accent-colored period was deliberately left alone), `src/features/search/SearchTrace.tsx` (trace-node count, term chips), `src/features/search/SearchForm.tsx` (active remote/hybrid/onsite toggle text), `src/features/search/SearchResults.tsx` (job-title link hover state). All `bg-accent`/`border-accent` fill and border usages were left untouched — those are governed by the 3:1 non-text floor, not the 4.5:1 text target. Extended the `'both themes expose complete readable semantic tokens'` Playwright test in `e2e/design-system-shell.spec.ts` to assert `--theme-accent` (the fill/border token) at the 3:1 floor only, and `--theme-text-tertiary` at the same 3:1 floor (see item 3).
2. **Section 14's mandated responsive assertions were missing.** Added `'no horizontal overflow and focused content clears the sticky header across required widths'` to `e2e/design-system-shell.spec.ts`, covering all four required viewports (320/768/1024/1440): asserts `document.documentElement.scrollWidth <= window.innerWidth` and that a focused element inside the search form clears the sticky header's bounding box.
3. **`text-tertiary` on meaningful data values regressed contrast.** `--theme-text-tertiary` measures 3.71:1 light / 4.43:1 dark — below the 4.5:1 text target, acceptable only for genuinely supplemental copy per Section 11's contrast contract. `src/features/search/SearchResults.tsx`'s rank-index number and relevance-score value (load-bearing data, not supplemental) changed from `text-tertiary` to `text-secondary`. No other `text-tertiary` usage in that file or elsewhere was touched.
4. **`useCorpusMetaQuery()`'s error surfaced a user-facing alert for data nothing renders.** See ledger item 2 above for the full account. `src/features/search/SearchPage.tsx`'s `error` derivation no longer includes `metaQuery.error`; the `useCorpusMetaQuery()` call itself was kept (now uncaptured, since its return value is otherwise unused) so `architecture-contracts.spec.ts`'s meta-normalization test still has a request to observe. That test was re-run and still passes.
5. **`AppShell` was missing two Section 11 responsive rules.** (a) Corpus summary is now `hidden lg:inline` (hidden below 64rem, visible from 64rem up) — no live visual effect today since `App.tsx` passes no `corpusSummary` prop; a forward-looking correctness fix for when a later plan wires real corpus data through. (b) Header, mobile-menu nav, and footer horizontal padding changed from flat `px-6` to `px-4 md:px-6` (1rem below 768px, 1.5rem from 768px up), matching the file's existing `md:hidden`/`hidden md:block` breakpoint convention.

**Minor:**

6. `src/ui/toast.tsx`'s toast surface changed from the arbitrary value `shadow-[var(--theme-shadow)]` to the `shadow-elevated` utility that `tokens.css`'s `@theme inline` block already defines for this purpose.
7. `src/features/search/SearchForm.tsx`'s stale `// Plan 2 owns reusable UI extraction; these stay feature-local until then.` comment (Plan 2 is this plan, now complete and merged) was replaced with a comment stating the actual current rule: `Label` stays feature-local until it has real callers outside the search feature.
8. `src/ui/toast.tsx`'s `normalizeToast` threw unconditionally on an empty/whitespace message; per Section 10.1's "rejected with a development error" contract this is now guarded behind `import.meta.env.DEV`. Production fallback: `normalizeToast` returns `null` and `showToast` silently no-ops (no toast shown, no throw) — chosen because it keeps the calling code simplest and an empty toast message is a caller bug, not something a production user needs surfaced. All current tests run against the Vite dev server (`import.meta.env.DEV` true), so the throw path is unchanged in tests.

Verification after the fix wave: `npm --prefix apps/frontend run typecheck`, `lint`, `e2e` (27 passed, 0 failed — 26 pre-existing plus the one new Section 14 test), and `build` all passed. See the fix-wave report (`.superpowers/sdd/02-design-system-and-application-shell/fixwave-report.md`) for exact command output and file:line detail.

### 21.6 PR review round — module decomposition (2026-09-03)

Four review comments on [PR #2](https://github.com/NotVadusha/Jobber.it/pull/2) asked for a finer file decomposition of the `ui` layer than Sections 6, 18.4, and 18.8 originally specified. The plan owner approved the change on the PR, so those three sections were revised in place rather than left contradicting the shipped structure. Every change below is structural — no rendered markup, class name, accessibility attribute, or behavior changed.

1. **`AppShell.tsx:119` — "Let's create a utils hook to handle this, and other menu logic. This hook will be called here and return all needed controls back to us."** Mobile-menu state and its close triggers moved out of `SiteHeader` into `src/ui/shell/useMobileMenu.ts`, which owns the `open` state, the Escape / outside-pointer / `hashchange` effect, and both refs, returning `{ open, toggle, close, headerRef, buttonRef }`. `SiteHeader` destructures that return; destructuring rather than holding the object matters, because member access on the hook's return (`menu.headerRef`) makes Oxlint's `react(refs)` rule fire ten false positives about reading refs during render.

2. **`AppShell.tsx:298` — "Move each component into it's own separate file. Create a folder to group them."** `src/ui/AppShell.tsx` was replaced by `src/ui/shell/`, one component per file: `AppShell.tsx` (public), `SiteHeader.tsx`, `MobileMenu.tsx`, `SiteFooter.tsx`, `LogoMark.tsx`, plus `types.ts` for the shared public types and `useMobileMenu.ts` for the hook. No barrel file: `App.tsx` imports `@/ui/shell/AppShell`, and the e2e harness imports its types from `@/ui/shell/types`.

3. **`theme.tsx:154` — "Separate file per icon"** and **`toast.tsx:119` — "Separate file for icon."** With the plan owner's follow-up instruction to give icons their own folder, all four icons moved to `src/ui/icons/`: `SunIcon.tsx`, `MoonIcon.tsx`, `MenuIcon.tsx`, `CloseIcon.tsx`. Section 18.4's "do not add an icon module" prohibition was aimed at adding an icon *dependency*; these remain hand-written local SVG components and no package was added, so Section 4.2's exclusion still holds.

Two consolidations fell out of the split. `MenuIcon` previously branched internally on an `open` prop to render either a hamburger or an X; the branch now lives in `SiteHeader` (`open ? <CloseIcon /> : <MenuIcon />`), so neither icon knows about menu state. The X glyph existed twice — 18 px in the menu button, 12 px in the toast dismiss — and is now a single `CloseIcon` with a `size` prop; it scales `strokeWidth` against the viewBox so both call sites keep their original 1.4 px optical stroke.

Verification after this round: `make verify-full` exit 0 — Oxlint clean with the same five pre-existing warnings and no new ones, `tsc --noEmit` clean, 146 Python tests passed, 27 Playwright tests passed, production build succeeded. The Playwright suite is the regression proof that the decomposition changed no behavior: every shell, menu, theme, and toast journey passed unmodified.
