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

// Mirrors a subset of Electron's LoginItemSettings — what we actually expose
// in the UI. The OS holds the source of truth (registry on Windows), so we
// just round-trip through Electron's app.getLoginItemSettings/setLoginItemSettings.
export interface LoginItemSettings {
  openAtLogin: boolean
  // Whether to start with the main window hidden (tray-resident only). Maps
  // to passing `--hidden` in the launch args; window.ts checks the flag and
  // skips the initial show().
  startHidden: boolean
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
  | 'huggingface'
  | 'lmstudio'
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

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LlmCompleteRequest {
  messages: ChatMessage[]
  /** Override the configured default provider (LLM_Provider.IsDefault='Y'). */
  providerId?: number
  /** Override the provider's default model (Models.ProviderDefault='Y'). */
  modelName?: string
  /** Sampling temperature; default 0.2. The classifier passes 0 explicitly for deterministic JSON. */
  temperature?: number
  /** Cap on output tokens; default 1024. Override per-feature for long-reasoning calls. */
  maxTokens?: number
  /** When 'json', sets the provider's structured-output flag (OpenAI response_format, Gemini responseMimeType, Ollama format). */
  responseFormat?: 'text' | 'json'
  /** Free-form tag persisted to LLM_Usage for per-feature analytics (e.g. 'classifier', 'topic-rename', 'playground'). */
  feature?: string
}

export interface LlmCompleteResult {
  ok: boolean
  /** Text body of the response. Empty string is valid (e.g. Claude max_tokens with zero text blocks). */
  content?: string
  /** The model that actually served the request (after fallback resolution). */
  model?: string
  /** Provider name as stored in LLM_Provider.Provider_Name (e.g. 'OpenAI'). */
  providerName?: string
  latencyMs?: number
  usage?: { tokensIn: number; tokensOut: number }
  /** True when the provider clipped output (Claude stop_reason=='max_tokens', OpenAI finish_reason=='length'). */
  truncated?: boolean
  error?: string
}

export interface LlmDiscoverResult {
  ok: boolean
  latencyMs?: number
  count?: number
  /** Model names written to the Models table on success. */
  models?: string[]
  /** True when the provider has no /models endpoint and we used a hardcoded fallback list. */
  fallback?: boolean
  error?: string
}

// ---------- OpenAI inline usage fetch ----------
//
// One-off pull of today's spend from OpenAI's undocumented `/v1/usage` endpoint
// using the user's existing API key. Hidden gracefully on any failure — the
// dashboard-link button is the primary surface, the inline number is bonus
// polish for the only provider that exposes a usable usage API.

export interface LlmOpenAiUsageResult {
  ok: boolean
  /** USD spent today (UTC day boundary, matches OpenAI billing). */
  usdToday?: number
  error?: string
}

// ---------- ExecEngine connection ----------
//
// The Electron client is a "Consumer Peer" in the SCL ecosystem. It auths to
// the ExecEngine's SIS (Sign-In Service) over HTTP, receiving a stateless
// SHA256 session token valid for 24h. The token + identity (cp_id, master_id)
// are persisted to AdminData so reconnect is automatic across restarts; the
// password itself is never stored.
//
// Once authenticated, the client is supposed to exchange CBR / CDREQ / CSCT
// messages with the Agent Hub over a TCP queue (ports 44998/44999). That
// transport is not yet implemented in this client — `RealExecEngineClient`
// presently inherits all data methods from `RealLocalExecEngineClient`, which
// reads SCLFolder for local progress and falls back to the mock for peer
// data. As Queue-protocol methods land, individual `IExecEngineClient`
// methods will be overridden to talk to Agent Hub instead.

export interface ExecEngineConfig {
  sisHost: string
  sisPort: number
}

export interface ExecEngineSession {
  cpId: string
  masterId: string
  expiresAt: number  // epoch seconds
  /** When the token was issued, for debug display. */
  issuedAt: number
}

export type ExecEngineConnectionState =
  | 'not-configured'      // user has never tried to connect
  | 'disconnected'        // configured but no live session
  | 'connecting'          // signin in flight
  | 'connected'           // valid session
  | 'expired'             // token past expiry; needs re-signin
  | 'error'               // last attempt failed

export interface ExecEngineConnectionStatus {
  state: ExecEngineConnectionState
  config: ExecEngineConfig
  session?: ExecEngineSession
  /** Last error message, if any. Cleared on successful connect. */
  lastError?: string
  /** Latency of the most recent /health check, ms. Undefined if never checked. */
  healthLatencyMs?: number
  /** True if the most recent /health check succeeded. */
  healthOk?: boolean
}

export interface ExecEngineSignInRequest {
  username: string
  password: string
  /** Optional CP instance ID; SIS may auto-assign if absent. */
  cpId?: string
}

export interface ExecEngineSignInResult {
  ok: boolean
  status: ExecEngineConnectionStatus
  /** Server-supplied message (e.g. "Authentication successful"). */
  message?: string
}

export type ArtifactStage = 'scan' | 'llm' | 'references' | 'km'

export interface StageProgress {
  processedLocal: number
  processedPeer: number
  remaining: number
  deltaLocal: number
  deltaPeer: number
  /** True when the stage is derived from a coefficient (no real column yet). */
  estimated?: boolean
}

export interface ProgressByStage {
  totalFiles: number
  rangeLabel: string
  rangeBudget?: number
  etaDays?: number
  stages: Record<ArtifactStage, StageProgress>
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

// ---------- Network & DB monitoring (Consumer Peer dashboard) ----------

export interface AgentHubStatus {
  connected: boolean
  lastSyncMs: number | null         // ms since epoch of last successful poll
  peerId: string                    // CP_SIS_DB.PeerID equivalent
  authExpiresMs: number | null      // ms since epoch when auth expires
  hubServerId: string | null        // assigned AH_ServerID
}

export interface PendingRequests {
  cbr: number                       // ContentBuildRequest
  csct: number                      // ContentSelfCheckTrigger
  cdreq: number                     // ContentDataRequest
  avgAgeMs: number                  // average age of pending requests
  throughputPerSec: number          // recent successful responses / second
}

export interface DbFileInfo {
  name: string                      // friendly name e.g. 'loc_adm.db'
  path: string                      // absolute path on disk
  sizeBytes: number | null          // null if file missing (e.g. mode-specific DBs not present yet)
  reservedForV2?: boolean           // true for placeholder rows like Hash_Tracking_DB
}

export interface GrowthPoint {
  ts: number                        // ms since epoch
  totalRows: number                 // synthetic row count across local DBs
}

export interface NetworkSummary {
  agentHub: AgentHubStatus
  pending: PendingRequests
  dbFiles: DbFileInfo[]
  growth: GrowthPoint[]             // small series for the sparkline
  growthPctChange: number           // rounded % change over the series
}

// ---------- App-wide errors store ----------

export type AppErrorSource = 'ipc' | 'llm' | 'execengine' | 'worker' | 'renderer' | 'main'
export type AppErrorSeverity = 'error' | 'warning'

export interface AppError {
  id: number
  ts: number                        // ms since epoch
  source: AppErrorSource
  severity: AppErrorSeverity
  category: string | null           // ipc-channel / worker-name / sis-* / route hash
  message: string
  stack: string | null
  /** Already-serialized JSON (redacted). Renderer parses on demand. */
  context: string | null
}

export interface ErrorListQuery {
  limit?: number                    // default 50, max 200
  offset?: number                   // default 0
  source?: AppErrorSource | AppErrorSource[]
  severity?: AppErrorSeverity
  sinceTs?: number                  // ms since epoch; for "last 24h" badge
}

export interface ErrorListResult {
  rows: AppError[]
  total: number                     // total rows matching the filter (for pagination)
}

export interface RecordRendererErrorPayload {
  message: string
  stack?: string
  category?: string                 // e.g. route hash
  context?: Record<string, unknown>
}
