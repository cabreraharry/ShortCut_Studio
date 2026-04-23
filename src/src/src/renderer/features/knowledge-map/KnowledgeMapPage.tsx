import { useEffect, useMemo, useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Network, Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/visual/EmptyState'
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

  const { data: graph, isLoading } = useQuery({
    queryKey: ['km', superCategoryId],
    queryFn: () => api.knowledgeMap.graph({ superCategoryId, sampleFilesPerTopic: 4 }),
    placeholderData: keepPreviousData
  })

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
          Knowledge Map
        </h1>
        <p className="text-sm text-muted-foreground">
          Your library as a constellation. Click any node for details.
        </p>
      </div>

      <KnowledgeMapToolbar
        search={search}
        onSearchChange={setSearch}
        superCategoryId={superCategoryId}
        onSuperCategoryChange={setSuperCategoryId}
        superCategories={superCategories}
        stats={graph?.stats}
      />

      <div className="grid min-h-[560px] flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
        <Card className="relative overflow-hidden p-2">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Skeleton className="h-[520px] w-[720px] rounded-lg" />
            </div>
          ) : !hasTopics ? (
            <EmptyState
              variant="topics"
              title="No topics yet"
              description="The Knowledge Map builds itself from your AI-generated topics. Run topic generation first, then come back here."
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
