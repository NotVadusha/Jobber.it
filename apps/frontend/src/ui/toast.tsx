import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'

import { CloseIcon } from '@/ui/icons/CloseIcon'

export type ToastTone = 'info' | 'success'

export type ToastInput = {
  message: string
  tone?: ToastTone
  durationMs?: number
}

type VisibleToast = Required<Pick<ToastInput, 'message' | 'tone' | 'durationMs'>> & {
  id: number
}

type ToastContextValue = {
  showToast(input: ToastInput): void
  dismissToast(): void
}

const ToastContext = createContext<ToastContextValue | null>(null)

function normalizeToast(
  { message, durationMs, tone }: ToastInput,
  id: number,
): VisibleToast | null {
  const normalizedMessage = message.trim()
  if (!normalizedMessage) {
    if (import.meta.env.DEV) throw new Error('Toast message must not be empty')
    return null
  }

  return {
    id,
    message: normalizedMessage,
    tone: tone ?? 'info',
    durationMs: durationMs ?? 4000,
  }
}

export function ToastProvider({ children }: { children: ReactNode }): ReactElement {
  const [toast, setToast] = useState<VisibleToast | null>(null)
  const nextId = useRef(0)

  const dismissToast = useCallback(() => setToast(null), [])

  const showToast = useCallback((input: ToastInput) => {
    nextId.current += 1
    const normalized = normalizeToast(input, nextId.current)
    if (normalized) setToast(normalized)
  }, [])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(dismissToast, toast.durationMs)
    return () => window.clearTimeout(timeout)
  }, [toast?.id, dismissToast])

  const value = useMemo(() => ({ showToast, dismissToast }), [showToast, dismissToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
        {toast && (
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="rise pointer-events-auto flex items-center gap-3 border border-strong bg-surface-raised px-4 py-2.5 font-mono text-xs text-primary shadow-elevated"
          >
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={dismissToast}
              aria-label="Dismiss notification"
              className="text-secondary transition-colors hover:text-primary"
            >
              <CloseIcon size={12} />
            </button>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext)
  if (!value) throw new Error('useToast must be used inside ToastProvider')
  return value
}
