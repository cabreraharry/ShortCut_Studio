export type DbMode = 'publ' | 'priv'

export interface AppSettings {
  recId: number
  localhostPort: number
  numTopicThreshold: number
  cpuPerfThreshold: number
}

export interface FolderRow {
  id: number
  path: string
  include: 'Y' | 'N'
  procRound: number
  lastUpdCt: number
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
}

export interface ProgressHistoryPoint {
  ts: number
  cumulativeLocal: number
  cumulativePeer: number
}

export type TimeRange = '12h' | '24h' | '2d' | '5d' | '10d' | 'all'

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
