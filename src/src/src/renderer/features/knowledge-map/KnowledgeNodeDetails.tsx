import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ExternalLink, FileText, Layers, Tag, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { AiLabel, KnowledgeEdge, KnowledgeNode } from '@shared/types'
import { paletteFor } from './palette'

interface DetailsProps {
  node: KnowledgeNode | null
  allNodes: KnowledgeNode[]
  edges: KnowledgeEdge[]
}

export function KnowledgeNodeDetails({
  node,
  allNodes,
  edges
}: DetailsProps): JSX.Element {
  if (!node) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center text-xs text-muted-foreground">
        <Layers className="mb-2 h-8 w-8 opacity-40" />
        <p className="mb-1 font-medium">Nothing selected</p>
        <p>Click any node on the constellation to inspect it.</p>
      </div>
    )
  }

  switch (node.kind) {
    case 'self':
      return <SelfDetails allNodes={allNodes} />
    case 'superCategory':
      return <SuperCatDetails node={node} allNodes={allNodes} edges={edges} />
    case 'topic':
      return <TopicDetails node={node} allNodes={allNodes} edges={edges} />
    case 'file':
      return <FileDetails node={node} />
  }
}

function SelfDetails({ allNodes }: { allNodes: KnowledgeNode[] }): JSX.Element {
  const scCount = allNodes.filter((n) => n.kind === 'superCategory').length
  const topicCount = allNodes.filter((n) => n.kind === 'topic').length
  return (
    <div className="space-y-3 p-4 text-sm">
      <DetailHeader icon={<User className="h-4 w-4" />} label="You" subtitle="Your library's center" />
      <p className="text-xs text-muted-foreground">
        This is the root of your Knowledge Map. Everything in the outer rings is classified content
        you own or have access to.
      </p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <MiniStat label="Super-categories" value={scCount} />
        <MiniStat label="Topics" value={topicCount} />
      </div>
    </div>
  )
}

function SuperCatDetails({
  node,
  allNodes,
  edges
}: {
  node: KnowledgeNode
  allNodes: KnowledgeNode[]
  edges: KnowledgeEdge[]
}): JSX.Element {
  const topicIds = new Set(
    edges.filter((e) => e.from === node.id && e.kind === 'hasTopic').map((e) => e.to)
  )
  const topics = allNodes.filter((n) => topicIds.has(n.id))
  const palette = paletteFor(node.superCategoryId ?? null)
  return (
    <div className="space-y-3 p-4 text-sm">
      <DetailHeader
        icon={
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ backgroundColor: palette.dot }}
          />
        }
        label={node.label}
        subtitle="Super-category"
      />
      <div className="grid grid-cols-2 gap-2 text-xs">
        <MiniStat label="Topics" value={node.topicCount ?? topics.length} />
        <MiniStat label="Files" value={node.fileCount ?? 0} />
      </div>
      <div>
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Topics
        </div>
        {topics.length === 0 ? (
          <p className="text-xs text-muted-foreground">No topics in this super-category yet.</p>
        ) : (
          <ul className="space-y-1 text-xs">
            {topics.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between rounded bg-muted/40 px-2 py-1"
              >
                <span className="truncate font-medium">{t.label}</span>
                <span className="ml-2 shrink-0 font-mono tabular-nums text-muted-foreground">
                  {t.fileCount ?? 0} files
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function TopicDetails({
  node,
  allNodes,
  edges
}: {
  node: KnowledgeNode
  allNodes: KnowledgeNode[]
  edges: KnowledgeEdge[]
}): JSX.Element {
  const navigate = useNavigate()
  const fileIds = new Set(
    edges.filter((e) => e.from === node.id && e.kind === 'hasFile').map((e) => e.to)
  )
  const files = allNodes.filter((n) => fileIds.has(n.id))
  const palette = paletteFor(node.superCategoryId ?? null)
  return (
    <div className="space-y-3 p-4 text-sm">
      <DetailHeader
        icon={
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ backgroundColor: palette.dot }}
          />
        }
        label={node.label}
        subtitle="Topic"
      />
      <div className="grid grid-cols-2 gap-2 text-xs">
        <MiniStat label="Files (total)" value={node.fileCount ?? 0} />
        <MiniStat label="Sampled" value={files.length} />
      </div>
      <div>
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Sample files
        </div>
        {files.length === 0 ? (
          <p className="text-xs text-muted-foreground">No sample files available.</p>
        ) : (
          <ul className="space-y-1 text-xs">
            {files.map((f) => (
              <li
                key={f.id}
                className="flex items-center justify-between gap-2 rounded bg-muted/40 px-2 py-1"
              >
                <span className="truncate font-medium" title={f.label}>
                  {f.label}
                </span>
                <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                  {f.pageCount ?? 0}pg · {f.extractionPct ?? 0}%
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => navigate('/topics')}
      >
        Open in Topics
      </Button>
    </div>
  )
}

function FileDetails({ node }: { node: KnowledgeNode }): JSX.Element {
  const label = node.aiLabel ?? 'unlabeled'
  return (
    <div className="space-y-3 p-4 text-sm">
      <DetailHeader
        icon={<FileText className="h-4 w-4" />}
        label={node.label}
        subtitle="File"
      />
      {node.fullPath && (
        <p className="font-mono text-[10px] text-muted-foreground break-all" title={node.fullPath}>
          {node.fullPath}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <MiniStat label="Pages" value={node.pageCount ?? 0} />
        <MiniStat label="Extraction" value={`${node.extractionPct ?? 0}%`} />
      </div>
      <div>
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          AI label
        </div>
        <LabelChip label={label} />
      </div>
      {node.topicName && (
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Topic
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-muted/50 px-2 py-0.5 text-xs">
            <Tag className="h-3 w-3 text-muted-foreground" />
            {node.topicName}
          </div>
        </div>
      )}
      {node.fullPath && (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => void api.system.openFile(node.fullPath!)}
          >
            <FileText className="mr-1 h-3 w-3" /> Open
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => void api.system.revealFolder(node.fullPath!)}
          >
            <ExternalLink className="mr-1 h-3 w-3" /> Reveal
          </Button>
        </div>
      )}
    </div>
  )
}

function DetailHeader({
  icon,
  label,
  subtitle
}: {
  icon: React.ReactNode
  label: string
  subtitle: string
}): JSX.Element {
  return (
    <div>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {subtitle}
        </span>
      </div>
      <h2 className="mt-0.5 text-base font-semibold leading-tight">{label}</h2>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: number | string }): JSX.Element {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-2 py-1.5">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="font-mono tabular-nums text-sm font-semibold">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
    </div>
  )
}

function LabelChip({ label }: { label: AiLabel }): JSX.Element {
  const tone =
    label === 'publication'
      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
      : label === 'other'
        ? 'border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-400'
        : 'border-border bg-muted/40 text-muted-foreground'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        tone
      )}
    >
      {label === 'unlabeled' && <AlertTriangle className="h-3 w-3" />}
      {label}
    </span>
  )
}
