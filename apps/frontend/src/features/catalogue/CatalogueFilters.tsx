import { useEffect, useRef, useState, type ReactElement } from 'react'

import { FilterFields, type FilterFieldsProps } from '@/features/catalogue/FilterFields'
import './catalogue.css'

export type CatalogueFiltersProps = Omit<FilterFieldsProps, 'idPrefix'>

export function CatalogueFilters({
  filters,
  activeCount,
  onChange,
  onClear,
}: CatalogueFiltersProps): ReactElement {
  const [open, setOpen] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const openerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    const media = window.matchMedia('(min-width: 64rem)')
    const closeAtDesktop = () => {
      if (media.matches) setOpen(false)
    }
    media.addEventListener('change', closeAtDesktop)
    return () => media.removeEventListener('change', closeAtDesktop)
  }, [])

  const fields = { filters, activeCount, onChange, onClear }

  return (
    <>
      <div className="col-span-full lg:hidden">
        <button
          ref={openerRef}
          type="button"
          aria-expanded={open}
          aria-controls="catalogue-filter-drawer"
          onClick={() => setOpen(true)}
          className="min-h-10 rounded-sm border border-subtle bg-surface px-3 font-mono text-xs text-secondary hover:border-accent hover:text-accent"
        >
          Filters{activeCount ? ` (${activeCount})` : ''}
        </button>
      </div>

      <aside
        aria-label="Posting filters"
        className="sticky top-[calc(var(--layout-header-height)+1.5rem)] hidden max-h-[calc(100dvh-var(--layout-header-height)-3rem)] overflow-y-auto rounded-lg border border-subtle bg-surface p-5 lg:block"
      >
        <FilterFields idPrefix="desktop-filter" {...fields} />
      </aside>

      <dialog
        ref={dialogRef}
        id="catalogue-filter-drawer"
        aria-labelledby="catalogue-filter-drawer-title"
        onCancel={(event) => {
          event.preventDefault()
          setOpen(false)
        }}
        onClose={() => {
          setOpen(false)
          window.requestAnimationFrame(() => openerRef.current?.focus())
        }}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpen(false)
        }}
        className="catalogue-filter-drawer"
      >
        <div className="min-h-full bg-surface p-5 text-primary">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2
              id="catalogue-filter-drawer-title"
              className="font-mono text-sm font-semibold text-primary"
            >
              Filter postings
            </h2>
            <button
              type="button"
              autoFocus
              aria-label="Close filters"
              onClick={() => setOpen(false)}
              className="grid size-10 place-items-center rounded-sm border border-subtle text-secondary hover:border-accent hover:text-accent"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
          <FilterFields idPrefix="mobile-filter" {...fields} />
        </div>
      </dialog>
    </>
  )
}
