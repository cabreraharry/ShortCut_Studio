import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { KnowledgeEdge, KnowledgeNode } from '@shared/types'
import { paletteFor, type PaletteEntry } from './palette'

interface ConstellationProps {
  nodes: KnowledgeNode[]
  edges: KnowledgeEdge[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  searchTerm: string
}

// Layout geometry — deterministic radial placement on a 960×720 viewBox.
const VB_W = 960
const VB_H = 720
const CX = VB_W / 2
const CY = VB_H / 2
const R_SUPERCAT = 150
const R_TOPIC = 270
const R_FILE = 350
const R_SELF = 26
const R_SUPERCAT_NODE = 14
const R_TOPIC_NODE = 9
const R_FILE_NODE = 4

interface Positioned {
  node: KnowledgeNode
  cx: number
  cy: number
  angle: number
  palette: PaletteEntry
}

function polar(cx: number, cy: number, r: number, angleRad: number): { x: number; y: number } {
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) }
}

export function KnowledgeMapConstellation({
  nodes,
  edges,
  selectedId,
  onSelect,
  searchTerm
}: ConstellationProps): JSX.Element {
  const { byId, selectionSet } = useMemo(() => {
    const supers = nodes.filter((n) => n.kind === 'superCategory')
    const topics = nodes.filter((n) => n.kind === 'topic')
    const files = nodes.filter((n) => n.kind === 'file')
    const self = nodes.find((n) => n.kind === 'self')

    const positioned = new Map<string, Positioned>()

    if (self) {
      positioned.set(self.id, {
        node: self,
        cx: CX,
        cy: CY,
        angle: 0,
        palette: paletteFor(null)
      })
    }

    // Super-category angles: evenly spaced, starting from top (−π/2).
    const nSc = Math.max(1, supers.length)
    supers.forEach((sc, i) => {
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / nSc
      const { x, y } = polar(CX, CY, R_SUPERCAT, angle)
      positioned.set(sc.id, {
        node: sc,
        cx: x,
        cy: y,
        angle,
        palette: paletteFor(sc.superCategoryId ?? null)
      })
    })

    // Group topics by their parent super-category id (string form of scId).
    const topicsByParent = new Map<string, KnowledgeNode[]>()
    for (const t of topics) {
      const parentId = edges.find((e) => e.to === t.id && e.kind === 'hasTopic')?.from ?? ''
      if (!topicsByParent.has(parentId)) topicsByParent.set(parentId, [])
      topicsByParent.get(parentId)!.push(t)
    }

    // For each super-cat, lay its topics across a wedge centered on its angle.
    const WEDGE_RATIO = 0.7 // use 70% of each SC's allotted arc
    const scArc = (2 * Math.PI) / nSc
    topicsByParent.forEach((list, parentScId) => {
      const parent = positioned.get(parentScId)
      if (!parent) return
      const wedge = scArc * WEDGE_RATIO
      const count = list.length
      list.forEach((t, i) => {
        const local = count === 1 ? 0 : (i - (count - 1) / 2) * (wedge / Math.max(1, count - 1))
        const angle = parent.angle + local
        const { x, y } = polar(CX, CY, R_TOPIC, angle)
        positioned.set(t.id, {
          node: t,
          cx: x,
          cy: y,
          angle,
          palette: parent.palette
        })
      })
    })

    // Files under each topic.
    const filesByParent = new Map<string, KnowledgeNode[]>()
    for (const f of files) {
      const parentId = edges.find((e) => e.to === f.id && e.kind === 'hasFile')?.from ?? ''
      if (!filesByParent.has(parentId)) filesByParent.set(parentId, [])
      filesByParent.get(parentId)!.push(f)
    }
    filesByParent.forEach((list, parentTopicId) => {
      const parent = positioned.get(parentTopicId)
      if (!parent) return
      // Narrow wedge for files so they don't bleed into neighbors.
      const fileWedge = Math.min(0.35, scArc * WEDGE_RATIO * 0.35)
      const count = list.length
      list.forEach((f, i) => {
        const local = count === 1 ? 0 : (i - (count - 1) / 2) * (fileWedge / Math.max(1, count - 1))
        const angle = parent.angle + local
        const { x, y } = polar(CX, CY, R_FILE, angle)
        positioned.set(f.id, {
          node: f,
          cx: x,
          cy: y,
          angle,
          palette: parent.palette
        })
      })
    })

    const byId = positioned
    const selectionSet = buildSelectionSet(selectedId, searchTerm, nodes, edges)

    return { byId, selectionSet }
  }, [nodes, edges, selectedId, searchTerm])

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className="h-full w-full select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onSelect(null)
      }}
      aria-label="Knowledge Map constellation"
    >
      <defs>
        <radialGradient id="km-self" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="white" stopOpacity="0.6" />
          <stop offset="40%" stopColor="hsl(var(--glass-local))" stopOpacity="1" />
          <stop offset="100%" stopColor="hsl(var(--glass-local))" stopOpacity="0.55" />
        </radialGradient>
        <filter id="km-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Orbit rings (decorative) */}
      <g aria-hidden>
        <circle cx={CX} cy={CY} r={R_SUPERCAT} className="fill-none stroke-border/40" strokeDasharray="4 6" />
        <circle cx={CX} cy={CY} r={R_TOPIC} className="fill-none stroke-border/25" strokeDasharray="3 6" />
        <circle cx={CX} cy={CY} r={R_FILE} className="fill-none stroke-border/15" strokeDasharray="2 8" />
      </g>

      {/* Edges */}
      <g>
        {edges.map((edge, i) => {
          const from = byId.get(edge.from)
          const to = byId.get(edge.to)
          if (!from || !to) return null
          const visible = isEdgeVisible(selectionSet, edge)
          const color = to.palette.stroke
          return (
            <line
              key={`e-${i}`}
              x1={from.cx}
              y1={from.cy}
              x2={to.cx}
              y2={to.cy}
              stroke={color}
              strokeOpacity={visible ? 0.3 : 0.08}
              strokeWidth={edge.kind === 'owns' ? 1.5 : 0.9}
            />
          )
        })}
      </g>

      {/* Nodes — render in order so self + super-cat are on top visually. */}
      <g>
        {Array.from(byId.values())
          .sort((a, b) => kindOrder(a.node.kind) - kindOrder(b.node.kind))
          .map((p) => (
            <NodeGlyph
              key={p.node.id}
              positioned={p}
              selected={selectedId === p.node.id}
              dimmed={selectionSet !== null && !selectionSet.has(p.node.id)}
              onClick={(e) => {
                e.stopPropagation()
                onSelect(p.node.id === selectedId ? null : p.node.id)
              }}
            />
          ))}
      </g>
    </svg>
  )
}

function kindOrder(kind: KnowledgeNode['kind']): number {
  switch (kind) {
    case 'file':
      return 0
    case 'topic':
      return 1
    case 'superCategory':
      return 2
    case 'self':
      return 3
  }
}

// If the user has selected a node OR typed a search, return the set of node
// ids that should stay at full opacity. Null means "no dimming; show all".
function buildSelectionSet(
  selectedId: string | null,
  searchTerm: string,
  nodes: KnowledgeNode[],
  edges: KnowledgeEdge[]
): Set<string> | null {
  const term = searchTerm.trim().toLowerCase()
  const hasSearch = term.length > 0
  const hasSelection = selectedId !== null

  if (!hasSelection && !hasSearch) return null

  const keep = new Set<string>()
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const childrenOf = new Map<string, string[]>()
  const parentOf = new Map<string, string[]>()
  for (const e of edges) {
    if (!childrenOf.has(e.from)) childrenOf.set(e.from, [])
    childrenOf.get(e.from)!.push(e.to)
    if (!parentOf.has(e.to)) parentOf.set(e.to, [])
    parentOf.get(e.to)!.push(e.from)
  }

  const addSubtree = (rootId: string): void => {
    const stack = [rootId]
    while (stack.length) {
      const id = stack.pop()!
      if (keep.has(id)) continue
      keep.add(id)
      for (const c of childrenOf.get(id) ?? []) stack.push(c)
    }
  }
  const addAncestors = (rootId: string): void => {
    const stack = [rootId]
    while (stack.length) {
      const id = stack.pop()!
      for (const p of parentOf.get(id) ?? []) {
        if (keep.has(p)) continue
        keep.add(p)
        stack.push(p)
      }
    }
  }

  if (hasSelection) {
    keep.add(selectedId!)
    addSubtree(selectedId!)
    addAncestors(selectedId!)
  }
  if (hasSearch) {
    for (const n of nodes) {
      if (n.label.toLowerCase().includes(term)) {
        keep.add(n.id)
        addAncestors(n.id)
      }
    }
  }
  // Keep YOU always visible — it's the root.
  keep.add('self')
  void byId
  return keep
}

function isEdgeVisible(selectionSet: Set<string> | null, edge: KnowledgeEdge): boolean {
  if (selectionSet === null) return true
  return selectionSet.has(edge.from) && selectionSet.has(edge.to)
}

function NodeGlyph({
  positioned,
  selected,
  dimmed,
  onClick
}: {
  positioned: Positioned
  selected: boolean
  dimmed: boolean
  onClick: (e: React.MouseEvent) => void
}): JSX.Element {
  const { node, cx, cy, palette } = positioned
  const radius =
    node.kind === 'self'
      ? R_SELF
      : node.kind === 'superCategory'
        ? R_SUPERCAT_NODE
        : node.kind === 'topic'
          ? R_TOPIC_NODE
          : R_FILE_NODE

  const showLabel = node.kind === 'superCategory' || node.kind === 'topic' || node.kind === 'self'
  const fill =
    node.kind === 'self'
      ? 'url(#km-self)'
      : node.kind === 'file'
        ? fileFill(node.aiLabel)
        : palette.fill
  const stroke = palette.stroke

  return (
    <g
      onClick={onClick}
      style={{
        cursor: 'pointer',
        transition: 'opacity 200ms ease, transform 200ms ease',
        opacity: dimmed ? 0.25 : 1,
        transform: selected ? `scale(1.12) translate(${cx * -0.1}px, ${cy * -0.1}px)` : 'none',
        transformOrigin: `${cx}px ${cy}px`
      }}
    >
      {selected && (
        <circle
          cx={cx}
          cy={cy}
          r={radius + 6}
          fill="none"
          stroke={stroke}
          strokeOpacity={0.8}
          strokeWidth={2}
        />
      )}
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill={fill}
        stroke={stroke}
        strokeOpacity={0.9}
        strokeWidth={node.kind === 'self' ? 1.5 : 1}
        filter={node.kind === 'self' || selected ? 'url(#km-glow)' : undefined}
      >
        <title>{node.label}</title>
      </circle>
      {node.kind === 'self' && (
        <text
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          className="fill-white"
          style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em' }}
        >
          YOU
        </text>
      )}
      {showLabel && node.kind !== 'self' && (
        <text
          x={cx}
          y={cy + radius + 12}
          textAnchor="middle"
          className={cn(
            'fill-foreground',
            node.kind === 'superCategory' ? 'font-semibold' : 'font-medium'
          )}
          style={{
            fontSize: node.kind === 'superCategory' ? 11 : 10,
            paintOrder: 'stroke',
            stroke: 'hsl(var(--background))',
            strokeWidth: 3,
            strokeOpacity: 0.7,
            strokeLinejoin: 'round'
          }}
        >
          {truncate(node.label, node.kind === 'superCategory' ? 22 : 18)}
        </text>
      )}
    </g>
  )
}

function fileFill(label: KnowledgeNode['aiLabel']): string {
  switch (label) {
    case 'publication':
      return 'hsl(var(--glass-peer))'
    case 'other':
      return 'hsl(var(--muted-foreground))'
    default:
      return 'hsl(var(--muted-foreground) / 0.5)'
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1) + '…'
}
