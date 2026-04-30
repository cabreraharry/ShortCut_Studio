import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Network, Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { HelpHint } from '@/components/ui/help-hint'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/visual/EmptyState'
import { QueryErrorState } from '@/components/visual/QueryErrorState'
import { api } from '@/lib/api'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { KnowledgeMapToolbar } from './KnowledgeMapToolbar'
import { KnowledgeMapConstellation } from './KnowledgeMapConstellation'
import { KnowledgeNodeDetails } from './KnowledgeNodeDetails'

export default function KnowledgeMapPage(): JSX.Element {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 200)
  const [superCategoryId, setSuperCategoryId] = useState<number | undefined>(undefined)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const graphQuery = useQuery({
    queryKey: ['km', superCategoryId],
    queryFn: () => api.knowledgeMap.graph({ superCategoryId, sampleFilesPerTopic: 4 }),
    placeholderData: keepPreviousData
  })
  const { data: graph, isLoading } = graphQuery

  // Clear selection when the graph changes shape (e.g., super-cat filter).
  useEffect(() => {
    setSelectedId(null)
  }, [superCategoryId])

  // Clear selection on Esc.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setSelectedId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const selectedNode = useMemo(() => {
    if (!graph || !selectedId) return null
    return graph.nodes.find((n) => n.id === selectedId) ?? null
  }, [graph, selectedId])

  // Walk through every node in order. Wraps at both ends. If nothing is
  // selected yet, Next starts at the first node and Prev at the last.
  const stepSelection = useCallback(
    (dir: 1 | -1): void => {
      if (!graph || graph.nodes.length === 0) return
      const nodes = graph.nodes
      if (!selectedId) {
        setSelectedId(nodes[dir === 1 ? 0 : nodes.length - 1].id)
        return
      }
      const idx = nodes.findIndex((n) => n.id === selectedId)
      if (idx === -1) {
        setSelectedId(nodes[0].id)
        return
      }
      const nextIdx = (idx + dir + nodes.length) % nodes.length
      setSelectedId(nodes[nextIdx].id)
    },
    [graph, selectedId]
  )

  const selectionPos = useMemo(() => {
    if (!graph || !selectedId) return { current: 0, total: graph?.nodes.length ?? 0 }
    const idx = graph.nodes.findIndex((n) => n.id === selectedId)
    return { current: idx >= 0 ? idx + 1 : 0, total: graph.nodes.length }
  }, [graph, selectedId])

  const superCategories = useMemo(
    () => (graph?.nodes ?? []).filter((n) => n.kind === 'superCategory'),
    [graph]
  )

  const hasTopics = (graph?.stats.totalTopics ?? 0) > 0

  return (
    <div className="flex h-full flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Network className="h-6 w-6" />
          Topic Map
          <HelpHint
            size="sm"
            label={
              <>
                <div className="font-semibold">A graph of YOU → Super-categories → Topics → sample Files.</div>
                <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                  <li>Big circle in the middle = you. Surrounding rings = super-categories.</li>
                  <li>Each super-category fans out into its topics; each topic shows up to 4 sample files.</li>
                  <li>Click a node to see its details on the right. Use the arrows to step through every node.</li>
                  <li>The search bar dims non-matching nodes; the super-category filter narrows the graph.</li>
                </ul>
              </>
            }
          />
        </h1>
        <p className="text-sm text-muted-foreground">
          Your library as a constellation. Click any node for details, or use the arrows to walk through every node.
        </p>
      </div>

      <KnowledgeMapToolbar
        search={search}
        onSearchChange={setSearch}
        superCategoryId={superCategoryId}
        onSuperCategoryChange={setSuperCategoryId}
        superCategories={superCategories}
        stats={graph?.stats}
        onStepPrev={() => stepSelection(-1)}
        onStepNext={() => stepSelection(1)}
        selectionCurrent={selectionPos.current}
        selectionTotal={selectionPos.total}
      />

      <div className="grid min-h-[560px] flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
        <Card className="relative overflow-hidden p-2">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Skeleton className="h-[520px] w-[720px] rounded-lg" />
            </div>
          ) : graphQuery.isError ? (
            <QueryErrorState
              title="Couldn't load the topic map"
              error={graphQuery.error as Error}
              onRetry={() => void graphQuery.refetch()}
            />
          ) : !hasTopics ? (
            <EmptyState
              variant="topics"
              title="No topics yet"
              description="The Topic Map builds itself from your AI-generated topics. Run topic generation first, then come back here."
              action={
                <Button onClick={() => navigate('/topics')}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Go to Topics
                </Button>
              }
            />
          ) : (
            <KnowledgeMapConstellation
              nodes={graph!.nodes}
              edges={graph!.edges}
              selectedId={selectedId}
              onSelect={setSelectedId}
              searchTerm={debouncedSearch}
            />
          )}
        </Card>

        <Card className="overflow-hidden">
          <KnowledgeNodeDetails
            node={selectedNode}
            allNodes={graph?.nodes ?? []}
            edges={graph?.edges ?? []}
          />
        </Card>
      </div>
    </div>
  )
}
