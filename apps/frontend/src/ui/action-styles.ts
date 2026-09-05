const ACTION_BASE = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-sm px-4 py-2 text-center text-sm font-medium leading-snug transition-colors disabled:cursor-not-allowed disabled:opacity-50'

export const PRIMARY_ACTION = `${ACTION_BASE} bg-accent text-accent-ink hover:bg-accent-hover`
export const SECONDARY_ACTION = `${ACTION_BASE} border border-strong text-secondary hover:bg-surface-raised hover:text-primary`
