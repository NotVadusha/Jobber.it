import { useEffect, useState, type ReactElement } from 'react'

export const Cooldown = ({ seconds }: { seconds: number }): ReactElement => {
  const [remaining, setRemaining] = useState(seconds)

  useEffect(() => {
    setRemaining(seconds)
    const timer = window.setInterval(() => {
      setRemaining((current) => (current > 0 ? current - 1 : 0))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [seconds])

  return (
    <span role="status" className="font-mono text-xs tabular-nums text-tertiary">
      {remaining > 0 ? `${remaining}s remaining` : 'You can search again'}
    </span>
  )
}
