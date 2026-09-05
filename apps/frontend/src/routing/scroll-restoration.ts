import { useEffect, useRef } from 'react'

import { readJobberHistory } from '@/routing/history-state'

export const useJobsScrollRestoration = (ready: boolean): void => {
  const restored = useRef(false)
  useEffect(() => {
    if (!ready || restored.current) return

    const current = readJobberHistory()
    if (current.jobsScrollY === undefined) return
    const targetY = current.jobsScrollY
    const frame = requestAnimationFrame(() => {
      // Mark only after the frame runs: StrictMode can cancel the first effect.
      restored.current = true
      window.scrollTo({ top: targetY, behavior: 'auto' })
    })
    return () => cancelAnimationFrame(frame)
  }, [ready])
}
