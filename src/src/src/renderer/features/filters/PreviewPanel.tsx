import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, FileSearch, XCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import type { DocumentInsight, FilterRuleSet } from '@shared/types'

interface PreviewPanelProps {
  ruleSet: FilterRuleSet
}

export function PreviewPanel({ ruleSet }: PreviewPanelProps): JSX.Element {
  const debounced = useDebouncedValue(ruleSet, 300)
  const { data, isFetching } = useQuery({
    queryKey: ['filter-preview', debounced],
    queryFn: () => api.filters.preview(debounced),
    placeholderData: keepPreviousData
  })

  if (!data) {
    return (
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-28" />
        </CardContent>
      </Card>
    )
  }

  const matchPct = data.totalCount === 0 ? 0 : Math.round((data.matchedCount / data.totalCount) * 100)

  return (
    <Card className={cn(isFetching && 'opacity-80')}>
      <CardContent className="space-y-4 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Stat
            label="Matched"
            value={data.matchedCount.toLocaleString()}
            sublabel={`${matchPct}% of ${data.totalCount.toLocaleString()}`}
            icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
            tone="emerald"
          />
          <Stat
            label="Excluded"
            value={data.excludedCount.toLocaleString()}
            sublabel={`${100 - matchPct}% of ${data.totalCount.toLocaleString()}`}
            icon={<XCircle className="h-4 w-4 text-amber-500" />}
            tone="amber"
          />
          <Stat
            label="Pool size"
            value={data.totalCount.toLocaleString()}
            sublabel={ruleSet.folder ? `in ${ruleSet.folder}` : 'all folders'}
            icon={<FileSearch className="h-4 w-4 text-primary" />}
            tone="primary"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <SampleList
            title="Sample matched"
            samples={data.sampleMatched}
            emptyHint="No files match the current rules."
            tone="emerald"
          />
          <SampleList
            title="Sample excluded"
            samples={data.sampleExcluded}
            emptyHint="All files match — no exclusions."
            tone="amber"
          />
        </div>
      </CardContent>
    </Card>
  )
}

function Stat({
  label,
  value,
  sublabel,
  icon,
  tone
}: {
  label: string
  value: string
  sublabel: string
  icon: React.ReactNode
  tone: 'emerald' | 'amber' | 'primary'
}): JSX.Element {
  const ring = {
    emerald: 'border-emerald-500/30 bg-emerald-500/5',
    amber: 'border-amber-500/30 bg-amber-500/5',
    primary: 'border-primary/30 bg-primary/5'
  }[tone]
  return (
    <div className={cn('rounded-md border px-3 py-2', ring)}>
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] text-muted-foreground">{sublabel}</div>
    </div>
  )
}

function SampleList({
  title,
  samples,
  emptyHint,
  tone
}: {
  title: string
  samples: DocumentInsight[]
  emptyHint: string
  tone: 'emerald' | 'amber'
}): JSX.Element {
  const titleColor = tone === 'emerald' ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'
  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <div className={cn('mb-1.5 text-xs font-semibold uppercase tracking-wider', titleColor)}>
        {title}
      </div>
      {samples.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">{emptyHint}</p>
      ) : (
        <ul className="space-y-0.5 text-[11px]">
          {samples.map((s) => (
            <li key={s.fileId} className="flex items-baseline gap-2">
              <span className="truncate font-medium" title={s.fileName}>
                {s.fileName}
              </span>
              <span className="ml-auto shrink-0 font-mono tabular-nums text-muted-foreground">
                {s.pageCount}pg · {s.extractionPct}%
                {s.warnings > 0 && (
                  <span className="ml-1 inline-flex items-center gap-0.5 text-amber-500">
                    <AlertTriangle className="h-2.5 w-2.5" /> {s.warnings}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
