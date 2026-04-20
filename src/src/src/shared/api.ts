import type {
  AppSettings,
  DbMode,
  FileTypeFilter,
  FolderRow,
  IpfsStatus,
  Job,
  LlmModel,
  LlmProvider,
  LlmTestResult,
  PrivacyTerm,
  ProgressHistoryPoint,
  ProgressSummary,
  SuperCategory,
  TimeRange,
  TopicListResult,
  TopicReviewItem,
  WorkerStatus
} from './types'

/**
 * Shape of `window.electronAPI` exposed by preload.
 * Renderer imports this type; runtime calls are invoke-based.
 */
export interface ElectronAPI {
  app: {
    quit: () => void
    openExternal: (url: string) => Promise<void>
    getVersion: () => Promise<string>
  }
  mode: {
    get: () => Promise<DbMode>
    set: (mode: DbMode) => Promise<void>
  }
  folders: {
    list: () => Promise<FolderRow[]>
    add: (paths: string[]) => Promise<FolderRow[]>
    remove: (id: number) => Promise<void>
    updatePath: (id: number, newPath: string) => Promise<void>
    pickDirectory: () => Promise<string[]>
  }
  fileTypes: {
    list: () => Promise<FileTypeFilter[]>
    toggle: (extension: string, enabled: boolean) => Promise<void>
    add: (extension: string, label: string) => Promise<FileTypeFilter>
    remove: (extension: string) => Promise<void>
  }
  llm: {
    listProviders: () => Promise<LlmProvider[]>
    updateKey: (providerId: number, key: string) => Promise<void>
    listModels: (providerId: number) => Promise<LlmModel[]>
    addModel: (providerId: number, name: string) => Promise<LlmModel>
    setDefaultModel: (modelId: number) => Promise<void>
    testConnection: (providerId: number) => Promise<LlmTestResult>
  }
  settings: {
    get: () => Promise<AppSettings>
    update: (patch: Partial<AppSettings>) => Promise<void>
  }
  progress: {
    summary: (range: TimeRange) => Promise<ProgressSummary>
    jobs: () => Promise<Job[]>
    history: (range: TimeRange) => Promise<ProgressHistoryPoint[]>
  }
  topics: {
    list: () => Promise<TopicListResult>
    generate: (folderId?: number) => Promise<{ jobId: string }>
    review: () => Promise<TopicReviewItem[]>
    approve: (items: TopicReviewItem[]) => Promise<void>
  }
  superCategories: {
    list: () => Promise<SuperCategory[]>
    create: (name: string) => Promise<SuperCategory>
    rename: (id: number, name: string) => Promise<void>
    remove: (id: number) => Promise<void>
    assign: (topicName: string, superCategoryId: number) => Promise<void>
    unassign: (topicName: string) => Promise<void>
  }
  ipfs: {
    status: () => Promise<IpfsStatus>
    setAllocation: (gb: number) => Promise<void>
  }
  privacy: {
    listTerms: () => Promise<PrivacyTerm[]>
    updateTerms: (userTerms: string[]) => Promise<void>
  }
  diagnostics: {
    workers: () => Promise<WorkerStatus[]>
    restartWorker: (name: string) => Promise<void>
    tailLog: (name: string, lines?: number) => Promise<string>
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
