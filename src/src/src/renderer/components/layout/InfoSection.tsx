import { useState, useMemo } from 'react'
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Placeholder messages — real content to come from resources/info-messages.json
// once the owner provides them.
const PLACEHOLDER_MESSAGES: Array<{ kind: 'tip' | 'offer'; body: string }> = [
  {
    kind: 'tip',
    body: 'Warning for experts: before sharing your documents with commercial LLMs, remember that they may learn from your expertise. Use remote AI only for busy-work.'
  },
  {
    kind: 'tip',
    body: 'Pin your most-used topics to the sidebar by right-clicking them in the Topics view.'
  },
  {
    kind: 'tip',
    body: 'Public / Private mode switches the active database across every view. Your private library never touches shared processing.'
  },
  {
    kind: 'offer',
    body: 'Dedicate a second drive to IPFS and unlock 10× faster topic generation through community peers.'
  },
  {
    kind: 'tip',
    body: 'The Progress Glass on the Dashboard updates continuously. Blue = processed on your machine, teal = received from peers.'
  }
]

export function InfoSection() {
  const [collapsed, setCollapsed] = useState(false)
  const [index, setIndex] = useState(0)
  const total = PLACEHOLDER_MESSAGES.length
  const msg = useMemo(() => PLACEHOLDER_MESSAGES[index], [index])

  return (
    <footer
      className={cn(
        'border-t border-border bg-card/40 transition-all',
        collapsed ? 'h-9' : 'h-32'
      )}
    >
      <div className="flex h-9 items-center justify-between px-4">
        <div className="text-xs font-medium text-muted-foreground">
          {msg.kind === 'offer' ? '✨ Offer' : '💡 Tip'} {index + 1} of {total}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>
      {!collapsed && (
        <div className="flex items-center gap-3 px-4 pb-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIndex((i) => (i - 1 + total) % total)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <p className="flex-1 text-sm leading-snug text-foreground/90">{msg.body}</p>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIndex((i) => (i + 1) % total)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </footer>
  )
}
