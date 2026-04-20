import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  Folders,
  FolderPlus,
  Play,
  Inbox,
  Pencil,
  Trash2,
  Check,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import type { SuperCategory, Topic } from '@shared/types'

export default function TopicsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Topics</h1>
          <p className="text-sm text-muted-foreground">
            Browse AI-generated topics, group them into super-categories, and trigger fresh generation.
          </p>
        </div>
        <TriggerGenerationButton />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <TopicBrowser />
        </div>
        <div>
          <ReviewQueue />
        </div>
      </div>

      <SuperCategoryManager />
    </div>
  )
}

function TriggerGenerationButton() {
  const qc = useQueryClient()
  const generate = useMutation({
    mutationFn: () => api.topics.generate(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs'] })
  })
  return (
    <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
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
        <CardContent className="p-6 text-sm text-muted-foreground">Loading topics…</CardContent>
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
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
          <Folders className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm font-medium">No scan data yet</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Add folders on the Folders page, then run a scan. Topics appear here once the Gemini processor has classified files.
          </p>
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
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
          <FolderPlus className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm font-medium">No topics generated yet</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Click <b>Generate topics</b> above to queue topic generation for your scanned files.
          </p>
        </CardContent>
      </Card>
    )
  }

  const unassigned = topics.filter((t) => !t.superCategoryId)
  const byCategoryList = new Map<number, Topic[]>()
  for (const t of topics) {
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
  return (
    <div
      className="rounded-md border border-border bg-card/40 p-3"
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
        className={cn(
          'inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1 text-xs font-medium transition-colors hover:border-primary/40 hover:bg-accent/60'
        )}
      >
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

function ReviewQueue() {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['topicReview'],
    queryFn: () => api.topics.review()
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Inbox className="h-4 w-4" />
          Review queue
        </CardTitle>
        <CardDescription>
          Pending Gemini suggestions waiting for your accept / reject / rename.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/70 p-6 text-center text-xs text-muted-foreground">
            Nothing to review. Suggestions land here after the Gemini processor runs on new files.
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((it, i) => (
              <div key={i} className="rounded-md border border-border p-3 text-xs">
                <div className="font-semibold">{it.suggestedTopic}</div>
                <div className="text-muted-foreground">{it.fileName}</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['superCategories'] })
  })
  const rename = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      api.superCategories.rename(id, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['superCategories'] })
  })
  const remove = useMutation({
    mutationFn: (id: number) => api.superCategories.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['superCategories'] })
      qc.invalidateQueries({ queryKey: ['topics'] })
    }
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
          <Button size="icon" variant="ghost" onClick={() => { onRename(draft); setEditing(false) }}>
            <Check className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => { setDraft(cat.name); setEditing(false) }}>
            <X className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <>
          <span className="flex-1 font-medium">{cat.name}</span>
          <Badge variant="secondary">{cat.topicNames.length} topics</Badge>
          <Button size="icon" variant="ghost" onClick={() => { setDraft(cat.name); setEditing(true) }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  )
}
