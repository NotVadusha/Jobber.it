import { useId, type ReactElement } from 'react'

import { SECONDARY_ACTION } from '@/ui/action-styles'
import { SAVED_JOBS_LIMIT, useSavedJobs, type SaveTarget } from '@/features/saved/saved-jobs'

export const SaveJobButton = ({
  target,
  className,
}: {
  target: SaveTarget
  className?: string
}): ReactElement => {
  const { isSaved, save, remove, atCapacity } = useSavedJobs()
  const limitId = useId()
  const saved = isSaved(target.id)
  const blocked = !saved && atCapacity

  return (
    <>
      <button
        type="button"
        aria-pressed={saved}
        aria-describedby={blocked ? limitId : undefined}
        disabled={blocked}
        onClick={() => (saved ? remove(target.id) : save(target))}
        className={className ?? `${SECONDARY_ACTION} aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-accent-text`}
      >
        {saved ? 'Saved' : 'Save'}
        <span className="sr-only">
          {saved ? ` ${target.title}, remove from saved` : ` ${target.title}`}
        </span>
      </button>
      {blocked && (
        <span id={limitId} className="sr-only">
          {`Saved jobs are limited to ${SAVED_JOBS_LIMIT} on this device. Remove one to save another.`}
        </span>
      )}
    </>
  )
}
