import type {
  DedupSummary,
  DocumentInsight,
  InsightsGroup,
  InsightsListParams,
  InsightsListResult,
  InsightsSortKey,
  SortDirection
} from '@shared/types'

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

export function getDedupSummary(): DedupSummary {
  const totalDocs = 12_483
  const uniqueMasterIds = 2_754
  const dedupPct = Math.round(((totalDocs - uniqueMasterIds) / totalDocs) * 1000) / 10
  return { totalDocs, uniqueMasterIds, dedupPct }
}

export function getFolderHealth(folderId: number): {
  fileCount: number
  dupeCount: number
  privacyMatchCount: number
} {
  const rng = mulberry32(folderId * 2654435761)
  const fileCount = 40 + Math.floor(rng() * 600)
  const dupeCount = Math.floor(rng() * (fileCount * 0.25))
  const privacyMatchCount = Math.floor(rng() * 8)
  return { fileCount, dupeCount, privacyMatchCount }
}

const SAMPLE_FILENAMES = [
  'Attention_Is_All_You_Need.pdf',
  'BERT_Pretraining.pdf',
  'GPT3_FewShot_Learners.pdf',
  'LLaMA2_Foundation.pdf',
  'RAG_Lewis_2020.pdf',
  'Switch_Transformer.pdf',
  'Chain_of_Thought.pdf',
  'InstructGPT.pdf',
  'AlphaFold2_Nature.pdf',
  'Stable_Diffusion.pdf',
  'CLIP_Radford.pdf',
  'Whisper_OpenAI.pdf',
  'DPO_Direct_Preference.pdf',
  'MoE_GShard.pdf',
  'FlashAttention2.pdf',
  'T5_TextToText.pdf',
  'ResNet_He_2015.pdf',
  'Transformer_XL.pdf',
  'Longformer_Beltagy.pdf',
  'RLHF_Summary.pdf',
  'RLAIF_Constitutional.pdf',
  'PPO_Schulman.pdf',
  'SAM2_Segment_Anything.pdf',
  'Mamba_State_Space.pdf',
  'MoA_Mixture_Agents.pdf',
  'MobileBERT.pdf',
  'DistilBERT.pdf',
  'RoBERTa.pdf',
  'ALBERT_Lite_BERT.pdf',
  'XLNet_Generalized.pdf',
  'BART_Denoising.pdf',
  'DALLE3_Technical.pdf',
  'Imagen_Saharia.pdf',
  'Parti_Autoregressive.pdf',
  'NeRF_Representing_Scenes.pdf',
  'Gaussian_Splatting_2023.pdf',
  'Diffusion_LM.pdf',
  'Score_SDE_Song.pdf',
  'LoRA_Low_Rank_Adaptation.pdf',
  'QLoRA_Efficient.pdf',
  'PEFT_Survey.pdf',
  'Prompt_Tuning_Lester.pdf',
  'In_Context_Learning_Survey.pdf',
  'Tree_of_Thought.pdf',
  'ReAct_Reasoning_Acting.pdf',
  'Toolformer_Schick.pdf',
  'Voyager_Minecraft.pdf',
  'CodeLlama_Instruction.pdf',
  'StarCoder_BigCode.pdf',
  'DeepSeek_V2.pdf'
]

const TOTAL_MOCK_FILES = 10_000
const COLLECTIONS = ['NeurIPS', 'ICML', 'ACL', 'CVPR', 'ICLR', 'Arxiv', 'Preprints']

let cached: DocumentInsight[] | null = null

function buildAll(): DocumentInsight[] {
  const out: DocumentInsight[] = []
  for (let i = 0; i < TOTAL_MOCK_FILES; i++) {
    const rng = mulberry32((i + 1) * 1013904223)
    const base = SAMPLE_FILENAMES[i % SAMPLE_FILENAMES.length]
    const suffix = String(i).padStart(4, '0')
    const fileName = base.replace('.pdf', `_${suffix}.pdf`)
    const collection = COLLECTIONS[Math.floor(rng() * COLLECTIONS.length)]
    out.push({
      fileId: 2000 + i,
      fileName,
      fullPath: `C:\\Papers\\${collection}\\${fileName}`,
      extractionPct: Math.round(72 + rng() * 28),
      pageCount: 4 + Math.floor(rng() * 40),
      warnings: Math.floor(rng() * 4)
    })
  }
  return out
}

function folderOf(path: string): string {
  const parts = path.split('\\')
  return parts[parts.length - 2] ?? 'Unknown'
}

// For the filter workbench rule engine: return the full (unpaged) file list,
// optionally filtered to a single collection folder. Used server-side only —
// never sent over IPC directly.
export function getAllDocumentInsights(folder?: string): DocumentInsight[] {
  if (!cached) cached = buildAll()
  if (!folder) return cached
  return cached.filter((r) => folderOf(r.fullPath) === folder)
}

const MAX_LIMIT = 500
const DEFAULT_LIMIT = 100

function compareBy(key: InsightsSortKey, dir: SortDirection) {
  const m = dir === 'asc' ? 1 : -1
  return (a: DocumentInsight, b: DocumentInsight): number => {
    switch (key) {
      case 'name':
        return a.fileName.localeCompare(b.fileName) * m
      case 'extraction':
        return (a.extractionPct - b.extractionPct) * m
      case 'warnings':
        return (a.warnings - b.warnings) * m
      case 'pages':
        return (a.pageCount - b.pageCount) * m
    }
  }
}

export function listDocumentInsights(params?: InsightsListParams): InsightsListResult {
  if (!cached) cached = buildAll()
  const q = (params?.search ?? '').trim().toLowerCase()
  const folderFilter = params?.folder
  const filtered = cached.filter((r) => {
    if (q && !r.fileName.toLowerCase().includes(q)) return false
    if (folderFilter && folderOf(r.fullPath) !== folderFilter) return false
    return true
  })

  const sortKey: InsightsSortKey = params?.sort ?? 'name'
  const sortDir: SortDirection = params?.sortDir ?? 'asc'
  const sorted = [...filtered].sort(compareBy(sortKey, sortDir))

  const offset = Math.max(0, params?.offset ?? 0)
  const limit = Math.min(MAX_LIMIT, Math.max(1, params?.limit ?? DEFAULT_LIMIT))

  let sumExtraction = 0
  let lowConfidenceCount = 0
  let totalWarnings = 0
  for (const r of filtered) {
    sumExtraction += r.extractionPct
    if (r.extractionPct < 85) lowConfidenceCount++
    totalWarnings += r.warnings
  }
  const avgExtractionPct = filtered.length === 0 ? 0 : Math.round(sumExtraction / filtered.length)

  return {
    rows: sorted.slice(offset, offset + limit),
    total: sorted.length,
    offset,
    limit,
    aggregates: { avgExtractionPct, lowConfidenceCount, totalWarnings }
  }
}

export function listInsightsGroups(params?: { search?: string }): InsightsGroup[] {
  if (!cached) cached = buildAll()
  const q = (params?.search ?? '').trim().toLowerCase()
  const filtered = q
    ? cached.filter((r) => r.fileName.toLowerCase().includes(q))
    : cached

  const byFolder = new Map<
    string,
    { sumExtraction: number; low: number; warn: number; count: number }
  >()
  for (const r of filtered) {
    const folder = folderOf(r.fullPath)
    const agg = byFolder.get(folder) ?? { sumExtraction: 0, low: 0, warn: 0, count: 0 }
    agg.sumExtraction += r.extractionPct
    if (r.extractionPct < 85) agg.low++
    agg.warn += r.warnings
    agg.count++
    byFolder.set(folder, agg)
  }

  return Array.from(byFolder.entries())
    .map(([folder, agg]) => ({
      folder,
      fileCount: agg.count,
      avgExtractionPct: agg.count === 0 ? 0 : Math.round(agg.sumExtraction / agg.count),
      lowConfidenceCount: agg.low,
      totalWarnings: agg.warn
    }))
    .sort((a, b) => a.folder.localeCompare(b.folder))
}
