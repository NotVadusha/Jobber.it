import { useId, type ReactElement } from 'react'

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
        className={className ?? 'min-h-9 rounded-sm border border-subtle px-3 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-secondary transition-colors hover:border-strong hover:text-primary aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-accent disabled:cursor-not-allowed disabled:text-tertiary'}
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
