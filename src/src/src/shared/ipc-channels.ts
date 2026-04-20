export const IpcChannel = {
  // App lifecycle
  AppQuit: 'app:quit',
  AppOpenExternal: 'app:open-external',
  AppGetVersion: 'app:get-version',

  // Mode
  ModeGet: 'mode:get',
  ModeSet: 'mode:set',

  // Folders (content detection)
  FoldersList: 'folders:list',
  FoldersAdd: 'folders:add',
  FoldersRemove: 'folders:remove',
  FoldersUpdatePath: 'folders:update-path',
  FoldersPickDirectory: 'folders:pick-directory',

  // LLM providers
  LlmListProviders: 'llm:list-providers',
  LlmUpdateKey: 'llm:update-key',
  LlmListModels: 'llm:list-models',
  LlmAddModel: 'llm:add-model',
  LlmSetDefaultModel: 'llm:set-default-model',
  LlmTestConnection: 'llm:test-connection',

  // Admin settings
  SettingsGet: 'settings:get',
  SettingsUpdate: 'settings:update',

  // Progress / jobs
  ProgressSummary: 'progress:summary',
  ProgressJobs: 'progress:jobs',
  ProgressHistory: 'progress:history',

  // Topics
  TopicsList: 'topics:list',
  TopicsGenerate: 'topics:generate',
  TopicsReview: 'topics:review',
  TopicsApprove: 'topics:approve',

  // IPFS / community (stubbed)
  IpfsStatus: 'ipfs:status',
  IpfsSetAllocation: 'ipfs:set-allocation',

  // Privacy
  PrivacyListTerms: 'privacy:list-terms',
  PrivacyUpdateTerms: 'privacy:update-terms',

  // Diagnostics
  DiagnosticsWorkers: 'diagnostics:workers',
  DiagnosticsRestartWorker: 'diagnostics:restart-worker',
  DiagnosticsTailLog: 'diagnostics:tail-log'
} as const

export type IpcChannelName = (typeof IpcChannel)[keyof typeof IpcChannel]
