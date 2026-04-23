import { useCallback, useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'

export interface BurstProps {
  particleCount?: number
  distance?: number
  durationMs?: number
  colorClass?: string
  ringColorClass?: string
  showRing?: boolean
  className?: string
}

function particleOffsets(count: number, distance: number): Array<{ dx: number; dy: number }> {
  return Array.from({ length: count }, (_, i) => {
    const angle = ((i * 360) / count) * (Math.PI / 180)
    return {
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance
    }
  })
}

export function Burst({
  particleCount = 8,
  distance = 36,
  durationMs = 500,
  colorClass = 'bg-primary',
  ringColorClass = 'border-primary/60',
  showRing = true,
  className
}: BurstProps): JSX.Element {
  const particles = useMemo(() => particleOffsets(particleCount, distance), [particleCount, distance])
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute left-1/2 top-1/2 h-0 w-0',
        className
      )}
    >
      {showRing && (
        <span
          className={cn(
            'animate-burst-ring absolute left-1/2 top-1/2 h-8 w-8 rounded-full border-2',
            ringColorClass
          )}
          style={{ animation: `burstRing ${durationMs}ms ease-out forwards` }}
        />
      )}
      {particles.map((p, i) => (
        <span
          key={i}
          className={cn(
            'animate-burst-particle absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full',
            colorClass
          )}
          style={{
            animation: `burstParticle ${durationMs}ms ease-out forwards`,
            ['--burst-dx' as string]: `${p.dx}px`,
            ['--burst-dy' as string]: `${p.dy}px`
          } as React.CSSProperties}
        />
      ))}
    </div>
  )
}

export interface UseBurst {
  burst: JSX.Element | null
  trigger: () => void
}

export function useBurst(props: BurstProps = {}): UseBurst {
  const [key, setKey] = useState(0)
  const trigger = useCallback(() => setKey((k) => k + 1), [])
  const durationMs = props.durationMs ?? 500

  useEffect(() => {
    if (key === 0) return undefined
    const t = setTimeout(() => setKey(0), durationMs + 50)
    return () => clearTimeout(t)
  }, [key, durationMs])

  const burst = key > 0 ? <Burst key={key} {...props} /> : null
  return { burst, trigger }
}
