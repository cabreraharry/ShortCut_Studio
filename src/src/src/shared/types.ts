export type DbMode = 'publ' | 'priv'

export type DataSource = 'demo' | 'prod'

export interface DataSourceState {
  current: DataSource
  prodAvailable: boolean
}

export interface AppSettings {
  recId: number
  localhostPort: number
  numTopicThreshold: number
  cpuPerfThreshold: number
  setupCompleted: boolean
  welcomeOnStartup: boolean
}

export interface FolderRow {
  id: number
  path: string
  include: 'Y' | 'N'
  procRound: number
  lastUpdCt: number
  fileCount?: number
  dupeCount?: number
  privacyMatchCount?: number
}

export interface DedupSummary {
  totalDocs: number
  uniqueMasterIds: number
  dedupPct: number
}

export interface DocumentInsight {
  fileId: number
  fileName: string
  fullPath: string
  extractionPct: number
  pageCount: number
  warnings: number
}

export type InsightsSortKey = 'name' | 'extraction' | 'warnings' | 'pages'
export type SortDirection = 'asc' | 'desc'

export interface InsightsListParams {
  search?: string
  folder?: string
  offset?: number
  limit?: number
  sort?: InsightsSortKey
  sortDir?: SortDirection
}

export interface InsightsAggregates {
  avgExtractionPct: number
  lowConfidenceCount: number
  totalWarnings: number
}

export interface InsightsGroup {
  folder: string
  fileCount: number
  avgExtractionPct: number
  lowConfidenceCount: number
  totalWarnings: number
}

// ---------- Filter Workbench ----------

export type AiLabel = 'publication' | 'other' | 'unlabeled'

export type FilterRuleType =
  | 'minPages'
  | 'maxPages'
  | 'filenameIncludes'
  | 'filenameExcludes'
  | 'aiLabel'
  | 'extractionMin'
  | 'maxWarnings'

export interface FilterRule {
  id: string
  type: FilterRuleType
  value: string | number
  enabled: boolean
}

export interface FilterRuleSet {
  folder?: string
  rules: FilterRule[]
}

export interface FilterPreset {
  id: number
  name: string
  ruleSet: FilterRuleSet
  createdAt: number
  lastUsed?: number
}

export interface FilterPreviewResult {
  matchedCount: number
  excludedCount: number
  totalCount: number
  sampleMatched: DocumentInsight[]
  sampleExcluded: DocumentInsight[]
}

export type ClassifierProvider =
  | 'claude'
  | 'openai'
  | 'gemini'
  | 'ollama'
  | 'mock'
  | 'clipboard'

export interface ClassifyFileInput {
  fileId: number
  fileName: string
}

export interface ClassifyRequest {
  folder?: string
  filenames: ClassifyFileInput[]
  provider: ClassifierProvider
  model?: string
  batchSize?: number
}

export interface ClassifyProgress {
  jobId: string
  phase: 'queued' | 'running' | 'done' | 'error'
  completed: number
  total: number
  currentBatch?: number
  error?: string
  failedBatches?: number
}

export interface ClassifiedFilename {
  fileId: number
  fileName: string
  label: AiLabel
  confidence: number
  reason?: string
}

export interface ClipboardPromptResult {
  prompt: string
  filenames: ClassifyFileInput[]
}

// ---------- Knowledge Map ----------

export type KnowledgeNodeKind = 'self' | 'superCategory' | 'topic' | 'file'

export interface KnowledgeNode {
  id: string
  kind: KnowledgeNodeKind
  label: string
  fileCount?: number
  topicCount?: number
  pageCount?: number
  extractionPct?: number
  aiLabel?: AiLabel
  superCategoryId?: number
  topicName?: string
  fileId?: number
  fullPath?: string
}

export interface KnowledgeEdge {
  from: string
  to: string
  kind: 'hasTopic' | 'hasFile' | 'owns'
}

export interface KnowledgeMapStats {
  totalFiles: number
  totalTopics: number
  totalSuperCategories: number
  filesWithoutTopic: number
  topicsWithoutSuperCategory: number
}

export interface KnowledgeMapGraph {
  nodes: KnowledgeNode[]
  edges: KnowledgeEdge[]
  stats: KnowledgeMapStats
}

export interface KnowledgeMapParams {
  search?: string
  superCategoryId?: number
  sampleFilesPerTopic?: number
}

export interface InsightsListResult {
  rows: DocumentInsight[]
  total: number
  offset: number
  limit: number
  aggregates: InsightsAggregates
}

export interface DriveInfo {
  letter: string
  label: string
  freeBytes: number
  totalBytes: number
}

export interface FsEntry {
  name: string
  path: string
  isDir: boolean
  fileCount?: number
  sizeBytes?: number
}

export interface FileTypeFilter {
  extension: string    // e.g. '.pdf'
  label: string        // e.g. 'PDF'
  enabled: boolean
}

export interface LlmProvider {
  providerId: number
  providerName: string
  hasApiKey: 'Y' | 'N'
  apiKey: string
  apiHost: string
  isDefault: 'Y' | 'N'
  supported: 'Y' | 'N'
  allowAddModel: 'Y' | 'N'
}

export interface LlmModel {
  modelId: number
  providerId: number
  modelName: string
  providerDefault: 'Y' | 'N'
}

export interface LlmTestResult {
  ok: boolean
  latencyMs?: number
  error?: string
}

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'paused'
export type JobKind = 'scan' | 'rescan' | 'topics' | 'classify' | 'postprocess'

export interface Job {
  id: string
  kind: JobKind
  status: JobStatus
  label: string
  startedAt?: number
  finishedAt?: number
  progress?: { current: number; total: number }
  error?: string
}

export interface ProgressSummary {
  totalFiles: number
  processedLocal: number
  processedPeer: number
  remaining: number
  rangeLabel: string
  deltaLocal: number
  deltaPeer: number
  etaDays?: number
  rangeBudget?: number
}

export interface ProgressHistoryPoint {
  ts: number
  cumulativeLocal: number
  cumulativePeer: number
}

export type TimeRange = '5h' | '12h' | '24h' | '1d' | '2d' | '3d' | '5d' | '10d' | 'all'

export interface Topic {
  topicId: number
  topicName: string
  folderName: string
  manualGenerated: 'Y' | 'N'
  superCategoryId?: number
  fileCount: number
}

export interface SuperCategory {
  superCategoryId: number
  name: string
  topicNames: string[]
}

export interface TopicListResult {
  topics: Topic[]
  scanDbMissing: boolean
}

export interface TopicReviewItem {
  suggestedTopic: string
  fileId: number
  fileName: string
  searchText: string
  linkName: string
  confidence?: number
  sampleFiles?: string[]
}

export interface TopicDistribution {
  topic: string
  fileCount: number
}

export interface IpfsStatus {
  running: boolean
  allocationGb: number
  minAllocationGb: number
  peerCount: number
  storedBytes: number
  sharedBytes: number
  drive?: string
}

export interface PrivacyTerm {
  term: string
  source: 'system' | 'user'
}

export interface WorkerStatus {
  name: string
  pid?: number
  status: 'running' | 'stopped' | 'crashed'
  lastHealthCheck?: number
  exitCode?: number
  restartCount: number
}

// ---------- Dev mode ----------

export interface DevPaths {
  appVersion: string
  electronVersion: string
  nodeVersion: string
  chromeVersion: string
  platform: string
  userData: string
  resources: string
  locAdmDb: string
  workersDir: string | null
  projectRoot: string | null
  isPackaged: boolean
}

export interface DevSqlResult {
  ok: boolean
  error?: string
  columns: string[]
  rows: unknown[][]
  truncated: boolean
  rowCount: number
  durationMs: number
}

export interface DevStorybookInfo {
  available: boolean
  mtime: number | null
  screenshotCount: number
  unpackedExists: boolean
  unpackedPath: string
  storybookDir: string
}

export type DevStorybookStream = 'stdout' | 'stderr' | 'system'

export interface DevStorybookLog {
  stream: DevStorybookStream
  line: string
  ts: number
}

export interface DevRunStorybookResult {
  ok: boolean
  exitCode: number | null
  error?: string
}

export interface DevStorybookScreenshot {
  name: string
  route: string
  dataUrl: string
  sizeBytes: number
}

/**
 * System-check surface for Dev-mode "System" tab. Today reports actual
 * status for the SCL_Demo workers + Ollama; IPFS + nginx are reserved
 * for the v2 ExecEngine integration.
 */
export type SystemCheckStatus = 'ok' | 'missing' | 'error' | 'reserved'

export interface SystemCheckItem {
  status: SystemCheckStatus
  detail?: string
  version?: string
  hintUrl?: string
  hintLabel?: string
}

export interface SystemCheckResult {
  workers: SystemCheckItem
  ollama: SystemCheckItem
  ipfs: SystemCheckItem
  nginx: SystemCheckItem
}
