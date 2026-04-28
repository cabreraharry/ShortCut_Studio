import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import {
  Play,
  Inbox,
  Pencil,
  Trash2,
  Check,
  X,
  Search,
  Sparkles,
  Tags,
  Layers,
  ArrowRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { EmptyState } from '@/components/visual/EmptyState'
import { SuperCategoryAtoms } from '@/components/visual/SuperCategoryAtoms'
import { useBurst } from '@/components/visual/Burst'
import { SkeletonRows, SkeletonChip } from '@/components/ui/skeleton'
import type { SuperCategory, Topic, TopicReviewItem } from '@shared/types'
import { TopicDistributionChart } from './TopicDistributionChart'
import { WithHint } from '@/components/ui/help-hint'

function errMsg(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

export default function TopicsPage() {
  const { data: topicData } = useQuery({
    queryKey: ['topics'],
    queryFn: () => api.topics.list()
  })
  const { data: reviewItems = [] } = useQuery({
    queryKey: ['topicReview'],
    queryFn: () => api.topics.review()
  })
  const { data: supers = [] } = useQuery({
    queryKey: ['superCategories'],
    queryFn: () => api.superCategories.list()
  })

  const topics = topicData?.topics ?? []
  const hasTopics = topics.length > 0
  const hasReview = reviewItems.length > 0
  const scanDbMissing = topicData?.scanDbMissing ?? false
  const isEmpty = !hasTopics && !hasReview && !scanDbMissing

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Topics</h1>
        <p className="text-sm text-muted-foreground">
          Browse AI-generated topics, group them into super-categories, and trigger fresh generation.
        </p>
      </div>

      <PipelineBar
        reviewCount={reviewItems.length}
        topicCount={topics.length}
        superCategoryCount={supers.length}
      />

      {isEmpty ? (
        <EmptyHero />
      ) : hasReview && !hasTopics ? (
        <div className="space-y-6">
          <ReviewQueue layout="grid" />
          <TopicBrowser />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <TopicBrowser />
          </div>
          <div>
            <ReviewQueue layout="stack" />
          </div>
        </div>
      )}

      <TopicDistributionChart />

      <SuperCategoryAtomsSection />

      <SuperCategoryManager />
    </div>
  )
}

function PipelineBar({
  reviewCount,
  topicCount,
  superCategoryCount
}: {
  reviewCount: number
  topicCount: number
  superCategoryCount: number
}) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3 p-4">
        <PipelineStep
          icon={<Inbox className="h-4 w-4" />}
          label="Pending review"
          count={reviewCount}
          tone={reviewCount > 0 ? 'amber' : 'muted'}
          hint="AI-generated topic suggestions waiting for your call: Approve, Reject, Rename, or Merge each one. Approved suggestions move to the Topics list."
        />
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
        <PipelineStep
          icon={<Tags className="h-4 w-4" />}
          label="Approved topics"
          count={topicCount}
          tone={topicCount > 0 ? 'primary' : 'muted'}
          hint="Topics you've approved. Each can be dragged into a Super-category to group related topics together."
        />
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
        <PipelineStep
          icon={<Layers className="h-4 w-4" />}
          label="Super-categories"
          count={superCategoryCount}
          tone={superCategoryCount > 0 ? 'emerald' : 'muted'}
          hint="Top-level groupings you create (e.g. 'Machine Learning', 'Personal'). Topics live inside super-categories on the Knowledge Map."
        />
        <div className="ml-auto flex items-center gap-2">
          <WithHint label="One-shot pipeline: AI generates topics from your scanned files, auto-assigns each to a super-category, and skips the review queue. Faster but you don't get to vet the suggestions.">
            <span className="inline-flex"><AutoOrganizeButton /></span>
          </WithHint>
          <WithHint label="Asks the AI to suggest topics from files that don't have one yet. Suggestions land in the Pending review queue so you can Approve / Reject / Rename / Merge each one before they're applied. Takes ~30 s.">
            <span className="inline-flex"><TriggerGenerationButton /></span>
          </WithHint>
        </div>
      </CardContent>
    </Card>
  )
}

function PipelineStep({
  icon,
  label,
  count,
  tone,
  hint
}: {
  icon: React.ReactNode
  label: string
  count: number
  tone: 'amber' | 'primary' | 'emerald' | 'muted'
  hint?: string
}) {
  const toneClass = {
    amber: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
    primary: 'bg-primary/10 text-primary border-primary/30',
    emerald: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
    muted: 'bg-muted/40 text-muted-foreground border-border'
  }[tone]
  const node = (
    <div className={cn('flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs', toneClass)}>
      {icon}
      <span className="font-medium">{label}</span>
      <span className="font-mono tabular-nums font-semibold">{count}</span>
    </div>
  )
  if (!hint) return node
  return <WithHint label={hint}>{node}</WithHint>
}

function EmptyHero() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-glass-local/20 to-glass-peer/20">
          <Sparkles className="h-7 w-7 text-primary" />
        </div>
        <div className="max-w-md space-y-2">
          <h2 className="text-xl font-semibold tracking-tight">Ready to organize your library?</h2>
          <p className="text-sm text-muted-foreground">
            Let the AI scan, cluster, and label your papers. You can review every suggestion before it's
            applied.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <AutoOrganizeButton size="lg" />
          <TriggerGenerationButton size="lg" variant="outline" />
        </div>
        <p className="max-w-md text-[11px] text-muted-foreground">
          <span className="font-semibold">Auto-organize</span> generates topics and assigns them to super-categories
          in one pass. <span className="font-semibold">Generate topics</span> gives you fresh suggestions to review manually.
        </p>
      </CardContent>
    </Card>
  )
}

function AutoOrganizeButton({
  size = 'default',
  variant = 'default'
}: {
  size?: 'default' | 'sm' | 'lg'
  variant?: 'default' | 'outline'
}) {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => api.topics.autoOrganize(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['progress-jobs'] })
      qc.invalidateQueries({ queryKey: ['topicReview'] })
      toast({
        title: 'Auto-organize queued',
        description: 'The AI will generate topics and assign them to super-categories. Progress lands in the Dashboard.',
        variant: 'success'
      })
    },
    onError: (err) => toast({ title: errMsg(err, 'Auto-organize failed'), variant: 'destructive' })
  })
  return (
    <Button
      size={size}
      variant={variant}
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      className={variant === 'default' ? 'bg-gradient-to-r from-glass-local to-glass-peer text-white hover:brightness-110' : ''}
    >
      <Sparkles className="mr-2 h-4 w-4" />
      Auto-organize with AI
    </Button>
  )
}

function SuperCategoryAtomsSection() {
  const { data: topicData } = useQuery({
    queryKey: ['topics'],
    queryFn: () => api.topics.list()
  })
  const { data: supers = [] } = useQuery({
    queryKey: ['superCategories'],
    queryFn: () => api.superCategories.list()
  })
  const topics = topicData?.topics ?? []
  if (supers.length === 0 || topics.length === 0) return null
  return <SuperCategoryAtoms supers={supers} topics={topics} />
}

function TriggerGenerationButton({
  size = 'default',
  variant = 'default'
}: {
  size?: 'default' | 'sm' | 'lg'
  variant?: 'default' | 'outline'
} = {}) {
  const qc = useQueryClient()
  const generate = useMutation({
    mutationFn: () => api.topics.generate(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['progress-jobs'] })
      qc.invalidateQueries({ queryKey: ['topicReview'] })
      toast({
        title: 'Topic generation queued',
        description: 'Results appear in the Review queue in ~30 s.',
        variant: 'success'
      })
    },
    onError: (err) => toast({ title: errMsg(err, 'Generation failed'), variant: 'destructive' })
  })
  return (
    <Button size={size} variant={variant} onClick={() => generate.mutate()} disabled={generate.isPending}>
      <Play className="mr-2 h-4 w-4" />
      Generate topics
    </Button>
  )
}

function TopicBrowser() {
  const { data, isLoading } = useQuery({
    queryKey: ['topics'],
    queryFn: () => api.topics.list()
  })
  const { data: supers = [] } = useQuery({
    queryKey: ['superCategories'],
    queryFn: () => api.superCategories.list()
  })
  const qc = useQueryClient()
  const [search, setSearch] = useState('')

  const assign = useMutation({
    mutationFn: ({ topicName, superCategoryId }: { topicName: string; superCategoryId: number }) =>
      api.superCategories.assign(topicName, superCategoryId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['topics'] })
      qc.invalidateQueries({ queryKey: ['superCategories'] })
    }
  })
  const unassign = useMutation({
    mutationFn: (topicName: string) => api.superCategories.unassign(topicName),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['topics'] })
      qc.invalidateQueries({ queryKey: ['superCategories'] })
    }
  })

  if (isLoading) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6">
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonChip key={i} />
            ))}
          </div>
          <SkeletonRows count={2} />
        </CardContent>
      </Card>
    )
  }

  const scanDbMissing = data?.scanDbMissing ?? false
  const topics = data?.topics ?? []

  if (scanDbMissing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Topics</CardTitle>
        </CardHeader>
        <CardContent className="py-4">
          <EmptyState
            variant="folders"
            title="No scan data yet"
            description="Add folders on the Folders page, then run a scan. Topics appear here once the Gemini processor has classified files."
          />
        </CardContent>
      </Card>
    )
  }

  if (topics.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Topics</CardTitle>
        </CardHeader>
        <CardContent className="py-4">
          <EmptyState
            variant="topics"
            title="No topics generated yet"
            description="Click Generate topics above to queue topic generation for your scanned files. Results land in the Review queue in about 30 seconds."
          />
        </CardContent>
      </Card>
    )
  }

  const filteredTopics = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? topics.filter((t) => t.topicName.toLowerCase().includes(q)) : topics
  }, [topics, search])
  const unassigned = filteredTopics.filter((t) => !t.superCategoryId)
  const byCategoryList = new Map<number, Topic[]>()
  for (const t of filteredTopics) {
    if (t.superCategoryId) {
      const list = byCategoryList.get(t.superCategoryId) ?? []
      list.push(t)
      byCategoryList.set(t.superCategoryId, list)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Topics</CardTitle>
        <CardDescription>
          Drag a topic chip onto a super-category below, or use the menu to assign.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter topics"
            className="pl-7"
          />
        </div>
        <TopicGroup
          title="Unassigned"
          topics={unassigned}
          superCategories={supers}
          onAssign={(t, scId) => assign.mutate({ topicName: t, superCategoryId: scId })}
          onUnassign={null}
        />
        {supers.map((sc) => {
          const tList = byCategoryList.get(sc.superCategoryId) ?? []
          return (
            <TopicGroup
              key={sc.superCategoryId}
              title={sc.name}
              titleBadge="Super-category"
              topics={tList}
              superCategories={supers}
              onAssign={(t, scId) => assign.mutate({ topicName: t, superCategoryId: scId })}
              onUnassign={(t) => unassign.mutate(t)}
              highlightCategoryId={sc.superCategoryId}
            />
          )
        })}
      </CardContent>
    </Card>
  )
}

function TopicGroup({
  title,
  titleBadge,
  topics,
  superCategories,
  onAssign,
  onUnassign,
  highlightCategoryId
}: {
  title: string
  titleBadge?: string
  topics: Topic[]
  superCategories: SuperCategory[]
  onAssign: (topicName: string, superCategoryId: number) => void
  onUnassign: ((topicName: string) => void) | null
  highlightCategoryId?: number
}) {
  const palette = paletteFor(highlightCategoryId)
  return (
    <div
      className="rounded-md border bg-card/40 p-3 transition-colors"
      style={
        palette
          ? {
              borderColor: `${palette.border}50`,
              backgroundColor: `${palette.bg}`
            }
          : undefined
      }
      onDragOver={(e) => {
        if (highlightCategoryId) e.preventDefault()
      }}
      onDrop={(e) => {
        if (!highlightCategoryId) return
        e.preventDefault()
        const topicName = e.dataTransfer.getData('text/topic')
        if (topicName) onAssign(topicName, highlightCategoryId)
      }}
    >
      <div className="mb-2 flex items-center gap-2">
        {palette && (
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: palette.dot }}
          />
        )}
        <span className="text-sm font-semibold">{title}</span>
        {titleBadge && <Badge variant="outline">{titleBadge}</Badge>}
        <span className="text-xs text-muted-foreground">{topics.length}</span>
      </div>
      {topics.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {highlightCategoryId ? 'Drag topics here to assign.' : 'All topics assigned.'}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {topics.map((t) => (
            <TopicChip
              key={t.topicId}
              topic={t}
              superCategories={superCategories}
              onAssign={onAssign}
              onUnassign={onUnassign}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const CHIP_PALETTE = [
  { border: 'rgb(99, 102, 241)', bg: 'rgba(99, 102, 241, 0.12)', dot: 'rgb(99, 102, 241)' },
  { border: 'rgb(16, 185, 129)', bg: 'rgba(16, 185, 129, 0.12)', dot: 'rgb(16, 185, 129)' },
  { border: 'rgb(244, 114, 182)', bg: 'rgba(244, 114, 182, 0.12)', dot: 'rgb(244, 114, 182)' },
  { border: 'rgb(251, 146, 60)', bg: 'rgba(251, 146, 60, 0.12)', dot: 'rgb(251, 146, 60)' },
  { border: 'rgb(14, 165, 233)', bg: 'rgba(14, 165, 233, 0.12)', dot: 'rgb(14, 165, 233)' },
  { border: 'rgb(168, 85, 247)', bg: 'rgba(168, 85, 247, 0.12)', dot: 'rgb(168, 85, 247)' },
  { border: 'rgb(234, 179, 8)', bg: 'rgba(234, 179, 8, 0.12)', dot: 'rgb(234, 179, 8)' }
]

function paletteFor(superCategoryId: number | undefined): (typeof CHIP_PALETTE)[number] | null {
  if (superCategoryId === undefined) return null
  return CHIP_PALETTE[superCategoryId % CHIP_PALETTE.length]
}

function TopicChip({
  topic,
  superCategories,
  onAssign,
  onUnassign
}: {
  topic: Topic
  superCategories: SuperCategory[]
  onAssign: (topicName: string, superCategoryId: number) => void
  onUnassign: ((topicName: string) => void) | null
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const palette = paletteFor(topic.superCategoryId)
  return (
    <div className="relative">
      <button
        type="button"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('text/topic', topic.topicName)
          e.dataTransfer.effectAllowed = 'move'
        }}
        onClick={() => setMenuOpen((v) => !v)}
        style={
          palette
            ? {
                borderColor: palette.border,
                backgroundColor: palette.bg
              }
            : undefined
        }
        className={cn(
          'inline-flex items-center gap-2 rounded-md border px-3 py-1 text-xs font-medium transition-colors',
          palette
            ? 'hover:brightness-110'
            : 'border-border bg-card hover:border-primary/40 hover:bg-accent/60'
        )}
      >
        {palette && (
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: palette.dot }}
          />
        )}
        <span>{topic.topicName}</span>
        <span className="text-muted-foreground">· {topic.fileCount}</span>
      </button>
      {menuOpen && (
        <div className="absolute left-0 top-full z-10 mt-1 w-56 rounded-md border border-border bg-popover p-1 shadow-lg">
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Assign to…
          </div>
          {superCategories.length === 0 && (
            <div className="px-2 py-2 text-xs text-muted-foreground">
              Create a super-category first.
            </div>
          )}
          {superCategories.map((sc) => (
            <button
              key={sc.superCategoryId}
              type="button"
              className="flex w-full items-center rounded px-2 py-1 text-left text-xs hover:bg-accent"
              onClick={() => {
                onAssign(topic.topicName, sc.superCategoryId)
                setMenuOpen(false)
              }}
            >
              {sc.name}
            </button>
          ))}
          {onUnassign && (
            <>
              <div className="my-1 h-px bg-border" />
              <button
                type="button"
                className="flex w-full items-center rounded px-2 py-1 text-left text-xs hover:bg-accent"
                onClick={() => {
                  onUnassign(topic.topicName)
                  setMenuOpen(false)
                }}
              >
                Unassign
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function ReviewQueue({ layout = 'stack' }: { layout?: 'stack' | 'grid' } = {}) {
  const qc = useQueryClient()
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['topicReview'],
    queryFn: () => api.topics.review()
  })
  const { data: topicList } = useQuery({
    queryKey: ['topics'],
    queryFn: () => api.topics.list()
  })

  const invalidate = (): void => {
    qc.invalidateQueries({ queryKey: ['topicReview'] })
    qc.invalidateQueries({ queryKey: ['topics'] })
  }

  const approve = useMutation({
    mutationFn: (item: TopicReviewItem) => api.topics.approve([item]),
    onSuccess: (_d, item) => {
      invalidate()
      toast({ title: `Approved "${item.suggestedTopic}"`, variant: 'success' })
    },
    onError: (err) => toast({ title: errMsg(err, 'Approve failed'), variant: 'destructive' })
  })
  const reject = useMutation({
    mutationFn: (topicName: string) => api.topics.reject(topicName),
    onSuccess: (_d, name) => {
      invalidate()
      toast({ title: `Rejected "${name}"` })
    },
    onError: (err) => toast({ title: errMsg(err, 'Reject failed'), variant: 'destructive' })
  })
  const rename = useMutation({
    mutationFn: ({ from, to }: { from: string; to: string }) => api.topics.rename(from, to),
    onSuccess: (_d, vars) => {
      invalidate()
      toast({ title: `Renamed to "${vars.to}"`, variant: 'success' })
    },
    onError: (err) => toast({ title: errMsg(err, 'Rename failed'), variant: 'destructive' })
  })
  const merge = useMutation({
    mutationFn: ({ from, into }: { from: string; into: string }) => api.topics.merge(from, into),
    onSuccess: (_d, vars) => {
      invalidate()
      toast({ title: `Merged "${vars.from}" → "${vars.into}"`, variant: 'success' })
    },
    onError: (err) => toast({ title: errMsg(err, 'Merge failed'), variant: 'destructive' })
  })

  const mergeTargets = (topicList?.topics ?? []).map((t) => t.topicName)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Inbox className="h-4 w-4" />
          Review queue
          {items.length > 0 && (
            <Badge variant="secondary" className="ml-1 font-mono">
              {items.length}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Pending Gemini suggestions — approve, reject, rename, or merge.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <SkeletonRows count={3} rowClass="h-20" />
        ) : items.length === 0 ? (
          <EmptyState
            variant="review"
            title="Nothing to review"
            description="Click Generate topics to queue new suggestions. You'll be able to approve, reject, rename, or merge each one here."
          />
        ) : (
          <div
            className={cn(
              layout === 'grid'
                ? 'grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3'
                : 'space-y-2'
            )}
          >
            {items.map((it, i) => (
              <ReviewRow
                key={i}
                item={it}
                mergeTargets={mergeTargets}
                onApprove={() => approve.mutate(it)}
                onReject={() => reject.mutate(it.suggestedTopic)}
                onRename={(to) => rename.mutate({ from: it.suggestedTopic, to })}
                onMerge={(into) => merge.mutate({ from: it.suggestedTopic, into })}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ReviewRow({
  item,
  mergeTargets,
  onApprove,
  onReject,
  onRename,
  onMerge
}: {
  item: TopicReviewItem
  mergeTargets: string[]
  onApprove: () => void
  onReject: () => void
  onRename: (to: string) => void
  onMerge: (into: string) => void
}) {
  const [mode, setMode] = useState<'idle' | 'rename' | 'merge'>('idle')
  const [draft, setDraft] = useState(item.suggestedTopic)
  const confPct = Math.round((item.confidence ?? 0) * 100)
  const { burst: approveBurst, trigger: fireApproveBurst } = useBurst({
    particleCount: 8,
    distance: 32,
    durationMs: 450,
    colorClass: 'bg-emerald-400',
    ringColorClass: 'border-emerald-400/60'
  })
  const handleApprove = (): void => {
    fireApproveBurst()
    onApprove()
  }

  return (
    <div className="rounded-md border border-border bg-card/40 p-3 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{item.suggestedTopic}</div>
          {item.confidence !== undefined && (
            <div className="mt-1 flex items-center gap-2">
              <div className="h-1 w-24 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary/70"
                  style={{ width: `${confPct}%` }}
                />
              </div>
              <span className="font-mono text-muted-foreground">{confPct}%</span>
            </div>
          )}
          {item.sampleFiles && item.sampleFiles.length > 0 && (
            <ul className="mt-1.5 space-y-0.5 text-muted-foreground">
              {item.sampleFiles.slice(0, 3).map((s) => (
                <li key={s} className="truncate" title={s}>
                  · {s}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {mode === 'idle' && (
        <div className="mt-2 flex flex-wrap gap-1">
          <div className="relative">
            <Button size="sm" variant="default" onClick={handleApprove}>
              <Check className="mr-1 h-3 w-3" /> Approve
            </Button>
            {approveBurst}
          </div>
          <Button size="sm" variant="outline" onClick={onReject}>
            <X className="mr-1 h-3 w-3" /> Reject
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setDraft(item.suggestedTopic)
              setMode('rename')
            }}
          >
            <Pencil className="mr-1 h-3 w-3" /> Rename
          </Button>
          {mergeTargets.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => setMode('merge')}>
              Merge into…
            </Button>
          )}
        </div>
      )}

      {mode === 'rename' && (
        <div className="mt-2 flex items-center gap-1">
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && draft.trim() && draft !== item.suggestedTopic) {
                onRename(draft.trim())
                setMode('idle')
              } else if (e.key === 'Escape') {
                setMode('idle')
              }
            }}
            className="h-8"
          />
          <IconButton
            tip="Save the renamed topic"
            onClick={() => {
              if (draft.trim() && draft !== item.suggestedTopic) {
                onRename(draft.trim())
                setMode('idle')
              }
            }}
          >
            <Check className="h-4 w-4" />
          </IconButton>
          <IconButton tip="Cancel renaming" onClick={() => setMode('idle')}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>
      )}

      {mode === 'merge' && (
        <div className="mt-2 space-y-1 rounded-md border border-border bg-popover p-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Merge into…
          </div>
          <div className="max-h-40 overflow-y-auto">
            {mergeTargets.map((t) => (
              <button
                key={t}
                type="button"
                className="flex w-full items-center rounded px-2 py-1 text-left text-xs hover:bg-accent"
                onClick={() => {
                  onMerge(t)
                  setMode('idle')
                }}
              >
                {t}
              </button>
            ))}
          </div>
          <Button size="sm" variant="ghost" onClick={() => setMode('idle')} className="w-full">
            Cancel
          </Button>
        </div>
      )}
    </div>
  )
}

function SuperCategoryManager() {
  const qc = useQueryClient()
  const { data: supers = [] } = useQuery({
    queryKey: ['superCategories'],
    queryFn: () => api.superCategories.list()
  })
  const create = useMutation({
    mutationFn: (name: string) => api.superCategories.create(name),
    onSuccess: (_data, name) => {
      qc.invalidateQueries({ queryKey: ['superCategories'] })
      toast({ title: `Created super-category "${name}"`, variant: 'success' })
    },
    onError: (err) => toast({ title: errMsg(err, 'Failed to create'), variant: 'destructive' })
  })
  const rename = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      api.superCategories.rename(id, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['superCategories'] })
      toast({ title: 'Renamed', variant: 'success' })
    },
    onError: (err) => toast({ title: errMsg(err, 'Failed to rename'), variant: 'destructive' })
  })
  const remove = useMutation({
    mutationFn: (id: number) => api.superCategories.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['superCategories'] })
      qc.invalidateQueries({ queryKey: ['topics'] })
      toast({ title: 'Removed super-category' })
    },
    onError: (err) => toast({ title: errMsg(err, 'Failed to remove'), variant: 'destructive' })
  })
  const [newName, setNewName] = useState('')

  return (
    <Card>
      <CardHeader>
        <CardTitle>Super-categories</CardTitle>
        <CardDescription>
          Group related topics under a single super-category so you can navigate fewer folders.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Input
            placeholder="New super-category name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="max-w-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newName.trim()) {
                create.mutate(newName.trim())
                setNewName('')
              }
            }}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={!newName.trim()}
            onClick={() => {
              if (newName.trim()) {
                create.mutate(newName.trim())
                setNewName('')
              }
            }}
          >
            Create
          </Button>
        </div>
        {supers.length === 0 ? (
          <p className="text-xs text-muted-foreground">No super-categories yet.</p>
        ) : (
          <div className="divide-y divide-border rounded-md border border-border">
            {supers.map((sc) => (
              <SuperCategoryRow
                key={sc.superCategoryId}
                cat={sc}
                onRename={(name) => rename.mutate({ id: sc.superCategoryId, name })}
                onRemove={() => remove.mutate(sc.superCategoryId)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SuperCategoryRow({
  cat,
  onRename,
  onRemove
}: {
  cat: SuperCategory
  onRename: (name: string) => void
  onRemove: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(cat.name)
  return (
    <div className="flex items-center gap-3 px-4 py-2 text-sm">
      {editing ? (
        <>
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onRename(draft)
                setEditing(false)
              } else if (e.key === 'Escape') {
                setDraft(cat.name)
                setEditing(false)
              }
            }}
            className="max-w-xs"
          />
          <IconButton tip="Save name" onClick={() => { onRename(draft); setEditing(false) }}>
            <Check className="h-4 w-4" />
          </IconButton>
          <IconButton tip="Cancel renaming" onClick={() => { setDraft(cat.name); setEditing(false) }}>
            <X className="h-4 w-4" />
          </IconButton>
        </>
      ) : (
        <>
          <span className="flex-1 font-medium">{cat.name}</span>
          <Badge variant="secondary">{cat.topicNames.length} topics</Badge>
          <IconButton tip="Rename this super-category" onClick={() => { setDraft(cat.name); setEditing(true) }}>
            <Pencil className="h-4 w-4" />
          </IconButton>
          <IconButton tip="Delete this super-category" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </>
      )}
    </div>
  )
}
