import { cn } from '@/lib/utils'

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): JSX.Element {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-gradient-to-r from-muted/40 via-muted/60 to-muted/40 bg-[length:200%_100%]',
        className
      )}
      style={{
        animation: 'skeletonShimmer 1.8s ease-in-out infinite'
      }}
      {...props}
    />
  )
}

export function SkeletonRows({
  count,
  rowClass
}: {
  count: number
  rowClass?: string
}): JSX.Element {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={cn('h-10 w-full', rowClass)} />
      ))}
    </div>
  )
}

export function SkeletonChip({ className }: { className?: string }): JSX.Element {
  return <Skeleton className={cn('h-6 w-20 rounded-full', className)} />
}
