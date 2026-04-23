import { useEffect, useRef, useState } from 'react'

export function useCountUp(target: number, durationMs = 1200): number {
  const [value, setValue] = useState(0)
  const startRef = useRef<number | null>(null)
  const fromRef = useRef(0)

  useEffect(() => {
    if (target === value) return undefined
    startRef.current = null
    fromRef.current = value

    if (typeof window === 'undefined' || !('requestAnimationFrame' in window)) {
      setValue(target)
      return undefined
    }

    let raf = 0
    const step = (ts: number): void => {
      if (startRef.current === null) startRef.current = ts
      const elapsed = ts - startRef.current
      const t = Math.min(1, elapsed / durationMs)
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3)
      const next = Math.round(fromRef.current + (target - fromRef.current) * eased)
      setValue(next)
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs])

  return value
}
