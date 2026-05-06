import type { ComponentId, ComponentStatus } from './components-manifest'
import type {
  AppNotification,
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
  ErrorListQuery,
  ErrorListResult,
  ExecEngineConfig,
  ExecEngineConnectionStatus,
  ExecEngineSignInRequest,
  ExecEngineSignInResult,
  FileTypeFilter,
  FilterPreset,
  FilterPreviewResult,
  FilterRuleSet,
  FolderRow,
  FsEntry,
  ShellFolder,
  InsightsGroup,
  InsightsListParams,
  InsightsListResult,
  IpfsStatus,
  Job,
  KnowledgeMapGraph,
  KnowledgeMapParams,
  NotificationAction,
  NotificationListQuery,
  NotificationListResult,
  LlmCompleteRequest,
  LlmCompleteResult,
  LlmDiscoverResult,
  LlmModel,
  LlmOpenAiUsageResult,
  LlmProvider,
  LlmTestResult,
  LoginItemSettings,
  PrivacyTerm,
  ProgressByStage,
  ProgressHistoryPoint,
  ProgressSummary,
  RecordRendererErrorPayload,
  SuperCategory,
  TimeRange,
  TopicDistribution,
  TopicListResult,
  TopicReviewItem,
  UpdaterStatus,
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
    getLoginItem: () => Promise<LoginItemSettings>
    setLoginItem: (next: LoginItemSettings) => Promise<LoginItemSettings>
  }
  mode: {
    get: () => Promise<DbMode>
    set: (mode: DbMode) => Promise<void>
    /**
     * Subscribe to main-process mode change broadcasts. The callback fires
     * synchronously after every successful set (whether triggered by this
     * window or another). Returns an unsubscribe function. The renderer
     * uses this to keep its `useMode()` hook in sync — without it, an
     * in-flight query started in publ mode could land its response in
     * the priv-mode cache slot.
     */
    onChanged: (cb: (mode: DbMode) => void) => () => void
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
    // True toggle of an existing row's Include flag — the Switch on each
    // folder row uses this so flipping a row no longer creates a sibling
    // Exclude entry the way `add(path, 'N')` would.
    setInclude: (id: number, include: 'Y' | 'N') => Promise<void>
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
    discoverModels: (providerId: number) => Promise<LlmDiscoverResult>
    complete: (req: LlmCompleteRequest) => Promise<LlmCompleteResult>
    fetchOpenAiUsage: (providerId: number) => Promise<LlmOpenAiUsageResult>
  }
  settings: {
    get: () => Promise<AppSettings>
    update: (patch: Partial<AppSettings>) => Promise<void>
  }
  progress: {
    summary: (range: TimeRange) => Promise<ProgressSummary>
    jobs: () => Promise<Job[]>
    history: (range: TimeRange) => Promise<ProgressHistoryPoint[]>
    byStage: (range: TimeRange) => Promise<ProgressByStage>
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
    listErrors: (query?: ErrorListQuery) => Promise<ErrorListResult>
    clearErrors: () => Promise<{ deleted: number }>
    recordRendererError: (payload: RecordRendererErrorPayload) => Promise<void>
  }
  system: {
    openFile: (path: string) => Promise<{ via: 'localhost' | 'shell' | 'none' }>
    revealFolder: (path: string) => Promise<{ via: 'localhost' | 'shell' }>
    listDrives: () => Promise<DriveInfo[]>
    listChildren: (path: string) => Promise<FsEntry[]>
    shellFolders: () => Promise<ShellFolder[]>
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
  execengine: {
    getStatus: () => Promise<ExecEngineConnectionStatus>
    setConfig: (config: ExecEngineConfig) => Promise<ExecEngineConnectionStatus>
    signIn: (req: ExecEngineSignInRequest) => Promise<ExecEngineSignInResult>
    signOut: () => Promise<ExecEngineConnectionStatus>
    healthCheck: () => Promise<ExecEngineConnectionStatus>
  }
  components: {
    list: () => Promise<ComponentStatus[]>
    install: (id: ComponentId) => Promise<void>
  }
  updater: {
    status: () => Promise<UpdaterStatus>
    check: () => Promise<UpdaterStatus>
    apply: () => Promise<UpdaterStatus>
    onStatusChanged: (cb: (status: UpdaterStatus) => void) => () => void
  }
  notifications: {
    list: (query?: NotificationListQuery) => Promise<NotificationListResult>
    markRead: (id: number | 'all') => Promise<{ ok: true }>
    dismiss: (id: number | 'all') => Promise<{ dismissed: number }>
    unreadCount: () => Promise<number>
    getMute: () => Promise<boolean>
    setMute: (muted: boolean) => Promise<{ muted: boolean }>
    test: () => Promise<AppNotification | null>
    /** Subscribe to new notification broadcasts (badge refresh / live drawer). */
    onNew: (cb: (n: AppNotification) => void) => () => void
    /** Subscribe to OS-toast click action payloads (route navigation). */
    onClickAction: (cb: (action: NotificationAction) => void) => () => void
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
