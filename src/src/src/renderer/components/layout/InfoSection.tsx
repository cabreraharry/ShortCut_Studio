import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  Sparkles,
  ShieldAlert,
  Zap,
  HeartPulse,
  ArrowRight
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { IconButton } from '@/components/ui/icon-button'
import { cn } from '@/lib/utils'

type MessageKind = 'tip' | 'offer' | 'feature' | 'warning'

interface InfoMessage {
  kind: MessageKind
  title: string
  body: string
  cta?: { label: string; to: string }
}

const MESSAGES: InfoMessage[] = [
  {
    kind: 'warning',
    title: 'Keep your expertise private',
    body: 'Commercial LLM providers may learn from your queries. Use remote AI only for busy-work like summarization or renaming. For anything where your expertise is the asset, keep it local with Ollama.',
    cta: { label: 'Configure LLMs', to: '/llm' }
  },
  {
    kind: 'tip',
    title: 'The Progress Glass is alive',
    body: 'The left bottle is your lifetime progress. The right bottle fills with only the delta from the time window you picked — watch the network grow in real time as peers process duplicate files for you.'
  },
  {
    kind: 'feature',
    title: 'Every duplicate is a win',
    body: "When a peer on the network has already scanned the same paper you just added, the work is shared automatically. You'll see the ‘Shared with network’ percentage climb on the Deduplication card.",
    cta: { label: 'See the Duplicates card', to: '/dashboard' }
  },
  {
    kind: 'offer',
    title: 'Dedicate a full drive to IPFS',
    body: "Allocating a separate drive for community-shared content means your working files never compete for I/O. Researchers who dedicate a drive see ~10× faster topic generation through peer assistance.",
    cta: { label: 'Configure allocation', to: '/community' }
  },
  {
    kind: 'tip',
    title: 'Private library stays private',
    body: 'Switch the library mode on the Privacy page. Scans in the Private library are never sent to peers or commercial LLMs. Files whose path matches a private term are auto-routed there.',
    cta: { label: 'Privacy settings', to: '/privacy' }
  },
  {
    kind: 'feature',
    title: 'Super-categories group topics',
    body: 'Drag a topic chip onto a super-category to group it. Chips and group headers share a color so you can see membership at a glance. Super-category orbits appear on the Topics page once you have assignments.',
    cta: { label: 'Open Topics', to: '/topics' }
  },
  {
    kind: 'tip',
    title: 'Check extraction quality before trusting results',
    body: "The Insights page shows per-file extraction confidence, page count, and warnings. If a PDF shows <85% confidence, the topic classification may be unreliable — consider a re-scan.",
    cta: { label: 'Document Insights', to: '/insights' }
  },
  {
    kind: 'offer',
    title: 'Invite a colleague',
    body: 'ShortCut Studio grows more useful with every peer on the network. Share the install link with a colleague — when they scan a paper you already have, everyone saves processing time.'
  }
]

const NEUTRAL_CHIP = 'bg-muted/60 text-muted-foreground border-border'
const NEUTRAL_DOT = 'bg-muted-foreground/60'

const KIND_META: Record<MessageKind, { icon: LucideIcon; label: string }> = {
  tip: { icon: Lightbulb, label: 'Tip' },
  offer: { icon: Sparkles, label: 'Offer' },
  feature: { icon: Zap, label: 'Feature' },
  warning: { icon: ShieldAlert, label: 'Heads up' }
}

const AUTO_ADVANCE_MS = 9000

export function InfoSection() {
  const [collapsed, setCollapsed] = useState(false)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const navigate = useNavigate()
  const total = MESSAGES.length
  const msg = useMemo(() => MESSAGES[index], [index])
  const meta = KIND_META[msg.kind]
  const Icon = meta.icon

  useEffect(() => {
    if (collapsed || paused) return undefined
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % total)
    }, AUTO_ADVANCE_MS)
    return () => clearInterval(t)
  }, [collapsed, paused, total])

  return (
    <footer
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className={cn(
        'relative overflow-hidden border-t border-border bg-card/50 transition-[height]',
        collapsed ? 'h-9' : 'h-[120px]'
      )}
    >
      <div className="relative flex h-9 items-center justify-between border-b border-border/40 px-4">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
              NEUTRAL_CHIP
            )}
          >
            <Icon className="h-3 w-3" />
            {meta.label}
          </span>
          <div className="flex items-center gap-1">
            {MESSAGES.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Go to tip ${i + 1}`}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i === index ? cn('w-5', NEUTRAL_DOT) : 'w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60'
                )}
              />
            ))}
          </div>
          <span className="text-[10px] font-mono text-muted-foreground">
            {index + 1}/{total}
          </span>
        </div>
        <div className="flex items-center">
          <IconButton
            tip={collapsed ? 'Expand tips' : 'Collapse tips'}
            className="h-6 w-6"
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </IconButton>
        </div>
      </div>

      {!collapsed && (
        <div className="relative flex items-center gap-3 px-4 py-3">
          <IconButton
            tip="Previous tip"
            className="h-7 w-7 shrink-0"
            onClick={() => setIndex((i) => (i - 1 + total) % total)}
          >
            <ChevronLeft className="h-4 w-4" />
          </IconButton>

          <div className="flex min-w-0 flex-1 items-start gap-3" key={index}>
            <div
              className={cn(
                'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border',
                NEUTRAL_CHIP
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1 animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold">{msg.title}</p>
                {msg.cta && (
                  <button
                    type="button"
                    onClick={() => navigate(msg.cta!.to)}
                    className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                  >
                    {msg.cta.label}
                    <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </div>
              <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">
                {msg.body}
              </p>
            </div>
          </div>

          <IconButton
            tip="Next tip"
            className="h-7 w-7 shrink-0"
            onClick={() => setIndex((i) => (i + 1) % total)}
          >
            <ChevronRight className="h-4 w-4" />
          </IconButton>
        </div>
      )}

      {collapsed && (
        <div className="absolute right-12 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
          <HeartPulse className="inline h-3 w-3 text-emerald-500" /> {total} tips available
        </div>
      )}
    </footer>
  )
}
