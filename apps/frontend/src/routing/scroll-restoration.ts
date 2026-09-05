import { useEffect } from 'react'

import { readJobberHistory } from '@/routing/history-state'

const restoredEntries = new Set<string>()

export function useJobsScrollRestoration(ready: boolean): void {
  useEffect(() => {
    if (!ready) return

    const current = readJobberHistory()
    if (current.jobsScrollY === undefined) return
    if (restoredEntries.has(current.entryId)) return
    restoredEntries.add(current.entryId)

    const targetY = current.jobsScrollY
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: targetY, behavior: 'auto' })
    })
    return () => cancelAnimationFrame(frame)
  }, [ready])
}
