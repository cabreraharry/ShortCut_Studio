import { ipcMain } from 'electron'
import { IpcChannel } from '@shared/ipc-channels'
import type {
  AiLabel,
  DocumentInsight,
  KnowledgeEdge,
  KnowledgeMapGraph,
  KnowledgeMapParams,
  KnowledgeMapStats,
  KnowledgeNode
} from '@shared/types'
import { getLocAdmDb } from '../db/connection'
import { getExecEngine } from '../execengine/client'
import { getAllDocumentInsightsReal } from '../db/scl-folder'

interface SuperCategoryRow {
  SuperCategoryID: number
  Name: string
}

interface MapRow {
  topicName: string
  superCategoryId: number
}

// Small deterministic hash so "Reinforcement Learning" always picks the same
// sample fileIds. Using mulberry32 again so it matches the mock's style.
function mulberry32(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = t
    r = Math.imul(r ^ (r >>> 15), r | 1)
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function seedFromString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function sampleFilesForTopic(
  topicName: string,
  pool: DocumentInsight[],
  count: number
): DocumentInsight[] {
  if (pool.length === 0 || count === 0) return []
  const rng = mulberry32(seedFromString(topicName))
  const indices = new Set<number>()
  const need = Math.min(count, pool.length)
  // Safe upper bound on draws to avoid infinite loop on tiny pools.
  let guard = need * 20
  while (indices.size < need && guard-- > 0) {
    indices.add(Math.floor(rng() * pool.length))
  }
  return Array.from(indices).map((i) => pool[i])
}

function loadSuperCategories(): SuperCategoryRow[] {
  return getLocAdmDb()
    .prepare('SELECT SuperCategoryID, Name FROM SuperCategories ORDER BY Name')
    .all() as SuperCategoryRow[]
}

function loadTopicSuperCategoryMap(): Map<string, number> {
  const rows = getLocAdmDb()
    .prepare('SELECT topicName, superCategoryId FROM TopicSuperCategoryMap')
    .all() as MapRow[]
  return new Map(rows.map((r) => [r.topicName, r.superCategoryId]))
}

function loadAiLabels(): Map<number, AiLabel> {
  const rows = getLocAdmDb()
    .prepare('SELECT fileId, label FROM FileAiLabels')
    .all() as Array<{ fileId: number; label: AiLabel }>
  return new Map(rows.map((r) => [r.fileId, r.label]))
}

const SELF_ID = 'self'
const scId = (n: number): string => `sc:${n}`
const UNASSIGNED_SC_ID = 'sc:unassigned'
const topicId = (name: string): string => `t:${name}`
const fileNodeId = (topic: string, id: number): string => `f:${topic}:${id}`

export function registerKnowledgeMapHandlers(): void {
  ipcMain.handle(
    IpcChannel.KnowledgeMapGraph,
    async (_evt, params?: KnowledgeMapParams): Promise<KnowledgeMapGraph> => {
      const search = (params?.search ?? '').trim().toLowerCase()
      const filterScId = params?.superCategoryId
      const sampleLimit = Math.min(
        8,
        Math.max(0, params?.sampleFilesPerTopic ?? 4)
      )

      const supers = loadSuperCategories()
      const topicToSc = loadTopicSuperCategoryMap()
      const topics = await getExecEngine().getTopicDistribution()
      const filePool = getAllDocumentInsightsReal()
      const aiLabels = loadAiLabels()

      const scById = new Map<number, SuperCategoryRow>(
        supers.map((s) => [s.SuperCategoryID, s])
      )

      // Aggregate per-super-category stats from the topics we'll emit.
      const scFileCount = new Map<number, number>()
      const scTopicCount = new Map<number, number>()
      let filesWithoutTopic = 0
      let topicsWithoutSuperCategory = 0

      // Decide which topics survive the filter.
      const topicFilter = (scIdVal: number | null): boolean => {
        if (filterScId !== undefined) {
          if (scIdVal === null) return false
          if (scIdVal !== filterScId) return false
        }
        return true
      }

      const nodes: KnowledgeNode[] = []
      const edges: KnowledgeEdge[] = []

      // Self node is always present.
      nodes.push({ id: SELF_ID, kind: 'self', label: 'YOU' })

      // Emit super-category nodes (only those that survive the filter).
      for (const sc of supers) {
        if (filterScId !== undefined && sc.SuperCategoryID !== filterScId) continue
        nodes.push({
          id: scId(sc.SuperCategoryID),
          kind: 'superCategory',
          label: sc.Name,
          superCategoryId: sc.SuperCategoryID,
          fileCount: 0, // backfilled below
          topicCount: 0
        })
        edges.push({ from: SELF_ID, to: scId(sc.SuperCategoryID), kind: 'owns' })
      }

      // Track whether we emit an "Unassigned" pseudo-super-category.
      let emittedUnassignedSc = false
      const maybeEmitUnassignedSc = (): void => {
        if (emittedUnassignedSc) return
        if (filterScId !== undefined) return
        emittedUnassignedSc = true
        nodes.push({
          id: UNASSIGNED_SC_ID,
          kind: 'superCategory',
          label: 'Unassigned',
          fileCount: 0,
          topicCount: 0
        })
        edges.push({ from: SELF_ID, to: UNASSIGNED_SC_ID, kind: 'owns' })
      }

      // Emit topic + file nodes.
      for (const td of topics) {
        const scIdVal = topicToSc.get(td.topic) ?? null
        if (!topicFilter(scIdVal)) continue
        if (scIdVal === null) topicsWithoutSuperCategory++

        const parentScNodeId =
          scIdVal !== null ? scId(scIdVal) : (maybeEmitUnassignedSc(), UNASSIGNED_SC_ID)

        const topicNodeId = topicId(td.topic)
        nodes.push({
          id: topicNodeId,
          kind: 'topic',
          label: td.topic,
          fileCount: td.fileCount,
          superCategoryId: scIdVal ?? undefined
        })
        edges.push({ from: parentScNodeId, to: topicNodeId, kind: 'hasTopic' })

        // Roll up into parent super-category counts.
        if (scIdVal !== null) {
          scFileCount.set(scIdVal, (scFileCount.get(scIdVal) ?? 0) + td.fileCount)
          scTopicCount.set(scIdVal, (scTopicCount.get(scIdVal) ?? 0) + 1)
        }

        // Attach sample files.
        const samples = sampleFilesForTopic(td.topic, filePool, sampleLimit)
        for (const f of samples) {
          nodes.push({
            id: fileNodeId(td.topic, f.fileId),
            kind: 'file',
            label: f.fileName,
            fileId: f.fileId,
            fullPath: f.fullPath,
            pageCount: f.pageCount,
            extractionPct: f.extractionPct,
            aiLabel: aiLabels.get(f.fileId) ?? 'unlabeled',
            topicName: td.topic
          })
          edges.push({
            from: topicNodeId,
            to: fileNodeId(td.topic, f.fileId),
            kind: 'hasFile'
          })
        }
      }

      // Backfill super-category counts on the emitted SC nodes.
      for (const node of nodes) {
        if (node.kind !== 'superCategory') continue
        if (node.id === UNASSIGNED_SC_ID) continue
        if (node.superCategoryId === undefined) continue
        node.fileCount = scFileCount.get(node.superCategoryId) ?? 0
        node.topicCount = scTopicCount.get(node.superCategoryId) ?? 0
      }
      // Unassigned SC: sum the topics we placed under it.
      if (emittedUnassignedSc) {
        const unassignedTopics = nodes.filter(
          (n) => n.kind === 'topic' && n.superCategoryId === undefined
        )
        const sc = nodes.find((n) => n.id === UNASSIGNED_SC_ID)
        if (sc) {
          sc.topicCount = unassignedTopics.length
          sc.fileCount = unassignedTopics.reduce(
            (acc, t) => acc + (t.fileCount ?? 0),
            0
          )
        }
      }

      // Apply search as a last pass — we don't remove nodes, just let the
      // renderer decide. But we return enough info for the UI to dim. Keep
      // all nodes; include a searchMatch flag via a small trick: put matched
      // ids in stats (no — simpler: renderer does the match itself over node.label).
      // So search is documented but not pre-applied here.
      void search

      const stats: KnowledgeMapStats = {
        totalFiles: filePool.length,
        totalTopics: topics.length,
        totalSuperCategories: supers.length,
        filesWithoutTopic,
        topicsWithoutSuperCategory
      }
      void scById

      return { nodes, edges, stats }
    }
  )
}
