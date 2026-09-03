import type { ReactElement } from 'react'

const VIEWBOX = 18
const STROKE_PX = 1.4

export function CloseIcon({ size = 18 }: { size?: number }): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
      fill="none"
      stroke="currentColor"
      // Counter the viewBox scale so the stroke reads the same weight at any size.
      strokeWidth={(STROKE_PX * VIEWBOX) / size}
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 4l10 10M14 4L4 14" />
    </svg>
  )
}
