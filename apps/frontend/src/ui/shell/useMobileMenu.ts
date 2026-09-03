import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

export type MobileMenuControls = {
  open: boolean
  toggle(): void
  close(): void
  headerRef: RefObject<HTMLElement | null>
  buttonRef: RefObject<HTMLButtonElement | null>
}

export function useMobileMenu(): MobileMenuControls {
  const [open, setOpen] = useState(false)
  const headerRef = useRef<HTMLElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const close = useCallback(() => setOpen(false), [])
  const toggle = useCallback(() => setOpen((current) => !current), [])

  useEffect(() => {
    if (!open) return

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }

    function onPointerDown(event: PointerEvent): void {
      if (headerRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('hashchange', close)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('hashchange', close)
    }
  }, [open, close])

  return { open, toggle, close, headerRef, buttonRef }
}
