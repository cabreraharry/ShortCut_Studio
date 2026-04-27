import type {
  AppSettings,
  ClassifiedFilename,
  ClassifyRequest,
  ClipboardPromptResult,
  DataSource,
  DataSourceState,
  DbMode,
  DedupSummary,
  DevPaths,
  DevRunStorybookResult,
  DevSqlResult,
  DevStorybookInfo,
  DevStorybookScreenshot,
  NetworkSummary,
  SystemCheckResult,
  DriveInfo,
  FileTypeFilter,
  FilterPreset,
  FilterPreviewResult,
  FilterRuleSet,
  FolderRow,
  FsEntry,
  InsightsGroup,
  InsightsListParams,
  InsightsListResult,
  IpfsStatus,
  Job,
  KnowledgeMapGraph,
  KnowledgeMapParams,
  LlmModel,
  LlmProvider,
  LlmTestResult,
  PrivacyTerm,
  ProgressHistoryPoint,
  ProgressSummary,
  SuperCategory,
  TimeRange,
  TopicDistribution,
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
  dataSource: {
    get: () => Promise<DataSourceState>
    set: (next: DataSource) => Promise<DataSourceState>
  }
  folders: {
    list: () => Promise<FolderRow[]>
    add: (paths: string[], forceInclude?: 'Y' | 'N') => Promise<FolderRow[]>
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
    autoOrganize: () => Promise<{ jobId: string }>
    review: () => Promise<TopicReviewItem[]>
    approve: (items: TopicReviewItem[]) => Promise<void>
    distribution: () => Promise<TopicDistribution[]>
    reject: (topicName: string) => Promise<void>
    rename: (from: string, to: string) => Promise<void>
    merge: (from: string, into: string) => Promise<void>
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
  system: {
    openFile: (path: string) => Promise<{ via: 'localhost' | 'shell' | 'none' }>
    revealFolder: (path: string) => Promise<{ via: 'localhost' | 'shell' }>
    listDrives: () => Promise<DriveInfo[]>
    listChildren: (path: string) => Promise<FsEntry[]>
  }
  insights: {
    dedupSummary: () => Promise<DedupSummary>
    list: (params?: InsightsListParams) => Promise<InsightsListResult>
    groups: (params?: { search?: string }) => Promise<InsightsGroup[]>
  }
  filters: {
    preview: (ruleSet: FilterRuleSet) => Promise<FilterPreviewResult>
    listPresets: () => Promise<FilterPreset[]>
    savePreset: (name: string, ruleSet: FilterRuleSet) => Promise<FilterPreset>
    deletePreset: (id: number) => Promise<void>
    classify: (req: ClassifyRequest) => Promise<{ jobId: string }>
    onClassifyProgress: (
      cb: (p: import('./types').ClassifyProgress) => void
    ) => () => void
    clipboardPrompt: (
      filenames: import('./types').ClassifyFileInput[]
    ) => Promise<ClipboardPromptResult>
    clipboardApply: (
      filenames: import('./types').ClassifyFileInput[],
      responseText: string
    ) => Promise<ClassifiedFilename[]>
  }
  knowledgeMap: {
    graph: (params?: KnowledgeMapParams) => Promise<KnowledgeMapGraph>
  }
  dev: {
    openDevTools: () => Promise<void>
    closeDevTools: () => Promise<void>
    reload: () => Promise<void>
    hardReset: () => Promise<void>
    getPaths: () => Promise<DevPaths>
    sqlSelect: (sql: string) => Promise<DevSqlResult>
    getStorybookInfo: () => Promise<DevStorybookInfo>
    listStorybookScreenshots: () => Promise<DevStorybookScreenshot[]>
    captureStorybook: () => Promise<DevRunStorybookResult>
    openStorybookFolder: () => Promise<void>
    onStorybookLog: (
      cb: (p: import('./types').DevStorybookLog) => void
    ) => () => void
    onToggle: (cb: () => void) => () => void
    systemCheck: () => Promise<SystemCheckResult>
  }
  network: {
    summary: () => Promise<NetworkSummary>
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
