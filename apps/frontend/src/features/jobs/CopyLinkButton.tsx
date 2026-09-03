import { useState, type ReactElement } from 'react'

import type { Route } from '@/routing/route-codec'
import { copyRoutePermalink, type CopyPermalinkResult } from '@/routing/permalink'
import { useToast } from '@/ui/toast'

export const CopyLinkButton = ({
  route,
  label = 'Copy link',
  className,
}: {
  route: Route
  label?: string
  className?: string
}): ReactElement => {
  const { showToast } = useToast()
  const [fallback, setFallback] = useState<CopyPermalinkResult | null>(null)

  const copy = async (): Promise<void> => {
    const result = await copyRoutePermalink(route)
    if (result.copied) {
      setFallback(null)
      showToast({ message: 'Link copied', tone: 'success' })
      return
    }
    setFallback(result)
  }

  return (
    <>
      <button type="button" onClick={() => void copy()} className={className}>
        {label}
      </button>
      {fallback && (
        <label className="mt-2 flex w-full flex-col gap-1 text-xs text-tertiary">
          Copy this link manually
          <input
            readOnly
            value={fallback.url}
            onFocus={(event) => event.currentTarget.select()}
            className="w-full rounded-sm border border-subtle bg-surface px-2 py-1 font-mono text-xs text-secondary"
          />
        </label>
      )}
    </>
  )
}
