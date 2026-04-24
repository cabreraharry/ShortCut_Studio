export const IpcChannel = {
  // App lifecycle
  AppQuit: 'app:quit',
  AppOpenExternal: 'app:open-external',
  AppGetVersion: 'app:get-version',

  // Mode
  ModeGet: 'mode:get',
  ModeSet: 'mode:set',

  // Data source (Demo vs Prod)
  DataSourceGet: 'dataSource:get',
  DataSourceSet: 'dataSource:set',

  // Folders (content detection)
  FoldersList: 'folders:list',
  FoldersAdd: 'folders:add',
  FoldersRemove: 'folders:remove',
  FoldersUpdatePath: 'folders:update-path',
  FoldersPickDirectory: 'folders:pick-directory',
  FileTypesList: 'file-types:list',
  FileTypesToggle: 'file-types:toggle',
  FileTypesAdd: 'file-types:add',
  FileTypesRemove: 'file-types:remove',

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
  TopicsAutoOrganize: 'topics:auto-organize',
  TopicsReview: 'topics:review',
  TopicsApprove: 'topics:approve',
  TopicsDistribution: 'topics:distribution',
  TopicsReject: 'topics:reject',
  TopicsRename: 'topics:rename',
  TopicsMerge: 'topics:merge',
  SuperCategoriesList: 'super-categories:list',
  SuperCategoriesCreate: 'super-categories:create',
  SuperCategoriesRename: 'super-categories:rename',
  SuperCategoriesRemove: 'super-categories:remove',
  SuperCategoriesAssign: 'super-categories:assign',
  SuperCategoriesUnassign: 'super-categories:unassign',

  // IPFS / community (stubbed)
  IpfsStatus: 'ipfs:status',
  IpfsSetAllocation: 'ipfs:set-allocation',

  // Privacy
  PrivacyListTerms: 'privacy:list-terms',
  PrivacyUpdateTerms: 'privacy:update-terms',

  // Diagnostics
  DiagnosticsWorkers: 'diagnostics:workers',
  DiagnosticsRestartWorker: 'diagnostics:restart-worker',
  DiagnosticsTailLog: 'diagnostics:tail-log',

  // System (OS shortcuts + filesystem helpers)
  SystemOpenFile: 'system:open-file',
  SystemRevealFolder: 'system:reveal-folder',
  SystemListDrives: 'system:list-drives',
  SystemListChildren: 'system:list-children',

  // Insights (dedup + folder health + document extraction)
  ProgressDedupSummary: 'progress:dedup-summary',
  FoldersHealth: 'folders:health',
  InsightsList: 'insights:list',
  InsightsGroups: 'insights:groups',

  // Filter Workbench
  FiltersPreview: 'filters:preview',
  FiltersListPresets: 'filters:list-presets',
  FiltersSavePreset: 'filters:save-preset',
  FiltersDeletePreset: 'filters:delete-preset',
  FiltersClassify: 'filters:classify',
  FiltersClassifyProgress: 'filters:classify-progress',
  FiltersClipboardPrompt: 'filters:clipboard-prompt',
  FiltersClipboardApply: 'filters:clipboard-apply',

  // Knowledge Map
  KnowledgeMapGraph: 'knowledge-map:graph',

  // Dev mode (Ctrl+Shift+D overlay)
  DevToggle: 'dev:toggle',
  DevOpenDevTools: 'dev:open-devtools',
  DevCloseDevTools: 'dev:close-devtools',
  DevReload: 'dev:reload',
  DevHardReset: 'dev:hard-reset',
  DevGetPaths: 'dev:get-paths',
  DevSqlSelect: 'dev:sql-select',
  DevGetStorybookInfo: 'dev:get-storybook-info',
  DevCaptureStorybook: 'dev:capture-storybook',
  DevOpenStorybookFolder: 'dev:open-storybook-folder',
  DevStorybookLog: 'dev:storybook-log',
  DevListStorybookScreenshots: 'dev:list-storybook-screenshots',
  DevSystemCheck: 'dev:system-check'
} as const

export type IpcChannelName = (typeof IpcChannel)[keyof typeof IpcChannel]
