import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannel } from '@shared/ipc-channels'
import type { ElectronAPI } from '@shared/api'

const api: ElectronAPI = {
  app: {
    quit: () => ipcRenderer.invoke(IpcChannel.AppQuit),
    openExternal: (url) => ipcRenderer.invoke(IpcChannel.AppOpenExternal, url),
    getVersion: () => ipcRenderer.invoke(IpcChannel.AppGetVersion),
    getLoginItem: () => ipcRenderer.invoke(IpcChannel.AppGetLoginItem),
    setLoginItem: (next) => ipcRenderer.invoke(IpcChannel.AppSetLoginItem, next)
  },
  mode: {
    get: () => ipcRenderer.invoke(IpcChannel.ModeGet),
    set: (mode) => ipcRenderer.invoke(IpcChannel.ModeSet, mode),
    onChanged: (cb) => {
      const listener = (_e: Electron.IpcRendererEvent, mode: import('@shared/types').DbMode) =>
        cb(mode)
      ipcRenderer.on(IpcChannel.ModeChanged, listener)
      return () => ipcRenderer.removeListener(IpcChannel.ModeChanged, listener)
    }
  },
  dataSource: {
    get: () => ipcRenderer.invoke(IpcChannel.DataSourceGet),
    set: (next) => ipcRenderer.invoke(IpcChannel.DataSourceSet, next)
  },
  folders: {
    list: () => ipcRenderer.invoke(IpcChannel.FoldersList),
    add: (paths, forceInclude) =>
      ipcRenderer.invoke(IpcChannel.FoldersAdd, paths, forceInclude),
    remove: (id) => ipcRenderer.invoke(IpcChannel.FoldersRemove, id),
    updatePath: (id, newPath) =>
      ipcRenderer.invoke(IpcChannel.FoldersUpdatePath, id, newPath),
    pickDirectory: () => ipcRenderer.invoke(IpcChannel.FoldersPickDirectory),
    setInclude: (id, include) =>
      ipcRenderer.invoke(IpcChannel.FoldersSetInclude, id, include)
  },
  fileTypes: {
    list: () => ipcRenderer.invoke(IpcChannel.FileTypesList),
    toggle: (extension, enabled) =>
      ipcRenderer.invoke(IpcChannel.FileTypesToggle, extension, enabled),
    add: (extension, label) =>
      ipcRenderer.invoke(IpcChannel.FileTypesAdd, extension, label),
    remove: (extension) =>
      ipcRenderer.invoke(IpcChannel.FileTypesRemove, extension)
  },
  llm: {
    listProviders: () => ipcRenderer.invoke(IpcChannel.LlmListProviders),
    updateKey: (providerId, key) =>
      ipcRenderer.invoke(IpcChannel.LlmUpdateKey, providerId, key),
    listModels: (providerId) =>
      ipcRenderer.invoke(IpcChannel.LlmListModels, providerId),
    addModel: (providerId, name) =>
      ipcRenderer.invoke(IpcChannel.LlmAddModel, providerId, name),
    setDefaultModel: (modelId) =>
      ipcRenderer.invoke(IpcChannel.LlmSetDefaultModel, modelId),
    testConnection: (providerId) =>
      ipcRenderer.invoke(IpcChannel.LlmTestConnection, providerId),
    discoverModels: (providerId) =>
      ipcRenderer.invoke(IpcChannel.LlmDiscoverModels, providerId),
    complete: (req) => ipcRenderer.invoke(IpcChannel.LlmComplete, req),
    fetchOpenAiUsage: (providerId) =>
      ipcRenderer.invoke(IpcChannel.LlmFetchOpenAiUsage, providerId)
  },
  settings: {
    get: () => ipcRenderer.invoke(IpcChannel.SettingsGet),
    update: (patch) => ipcRenderer.invoke(IpcChannel.SettingsUpdate, patch)
  },
  progress: {
    summary: (range) => ipcRenderer.invoke(IpcChannel.ProgressSummary, range),
    jobs: () => ipcRenderer.invoke(IpcChannel.ProgressJobs),
    history: (range) => ipcRenderer.invoke(IpcChannel.ProgressHistory, range),
    byStage: (range) => ipcRenderer.invoke(IpcChannel.ProgressByStage, range)
  },
  topics: {
    list: () => ipcRenderer.invoke(IpcChannel.TopicsList),
    generate: (folderId) =>
      ipcRenderer.invoke(IpcChannel.TopicsGenerate, folderId),
    autoOrganize: () => ipcRenderer.invoke(IpcChannel.TopicsAutoOrganize),
    review: () => ipcRenderer.invoke(IpcChannel.TopicsReview),
    approve: (items) => ipcRenderer.invoke(IpcChannel.TopicsApprove, items),
    distribution: () => ipcRenderer.invoke(IpcChannel.TopicsDistribution),
    reject: (topicName) => ipcRenderer.invoke(IpcChannel.TopicsReject, topicName),
    rename: (from, to) => ipcRenderer.invoke(IpcChannel.TopicsRename, from, to),
    merge: (from, into) => ipcRenderer.invoke(IpcChannel.TopicsMerge, from, into)
  },
  superCategories: {
    list: () => ipcRenderer.invoke(IpcChannel.SuperCategoriesList),
    create: (name) => ipcRenderer.invoke(IpcChannel.SuperCategoriesCreate, name),
    rename: (id, name) =>
      ipcRenderer.invoke(IpcChannel.SuperCategoriesRename, id, name),
    remove: (id) => ipcRenderer.invoke(IpcChannel.SuperCategoriesRemove, id),
    assign: (topicName, superCategoryId) =>
      ipcRenderer.invoke(
        IpcChannel.SuperCategoriesAssign,
        topicName,
        superCategoryId
      ),
    unassign: (topicName) =>
      ipcRenderer.invoke(IpcChannel.SuperCategoriesUnassign, topicName)
  },
  ipfs: {
    status: () => ipcRenderer.invoke(IpcChannel.IpfsStatus),
    setAllocation: (gb) =>
      ipcRenderer.invoke(IpcChannel.IpfsSetAllocation, gb)
  },
  privacy: {
    listTerms: () => ipcRenderer.invoke(IpcChannel.PrivacyListTerms),
    updateTerms: (userTerms) =>
      ipcRenderer.invoke(IpcChannel.PrivacyUpdateTerms, userTerms)
  },
  diagnostics: {
    workers: () => ipcRenderer.invoke(IpcChannel.DiagnosticsWorkers),
    restartWorker: (name) =>
      ipcRenderer.invoke(IpcChannel.DiagnosticsRestartWorker, name),
    tailLog: (name, lines) =>
      ipcRenderer.invoke(IpcChannel.DiagnosticsTailLog, name, lines),
    listErrors: (query) =>
      ipcRenderer.invoke(IpcChannel.DiagnosticsListErrors, query),
    clearErrors: () => ipcRenderer.invoke(IpcChannel.DiagnosticsClearErrors),
    recordRendererError: (payload) =>
      ipcRenderer.invoke(IpcChannel.DiagnosticsRecordRendererError, payload)
  },
  system: {
    openFile: (path) => ipcRenderer.invoke(IpcChannel.SystemOpenFile, path),
    revealFolder: (path) => ipcRenderer.invoke(IpcChannel.SystemRevealFolder, path),
    listDrives: () => ipcRenderer.invoke(IpcChannel.SystemListDrives),
    listChildren: (path) => ipcRenderer.invoke(IpcChannel.SystemListChildren, path),
    shellFolders: () => ipcRenderer.invoke(IpcChannel.SystemShellFolders)
  },
  insights: {
    dedupSummary: () => ipcRenderer.invoke(IpcChannel.ProgressDedupSummary),
    list: (params) => ipcRenderer.invoke(IpcChannel.InsightsList, params),
    groups: (params) => ipcRenderer.invoke(IpcChannel.InsightsGroups, params)
  },
  filters: {
    preview: (ruleSet) => ipcRenderer.invoke(IpcChannel.FiltersPreview, ruleSet),
    listPresets: () => ipcRenderer.invoke(IpcChannel.FiltersListPresets),
    savePreset: (name, ruleSet) =>
      ipcRenderer.invoke(IpcChannel.FiltersSavePreset, name, ruleSet),
    deletePreset: (id) => ipcRenderer.invoke(IpcChannel.FiltersDeletePreset, id),
    classify: (req) => ipcRenderer.invoke(IpcChannel.FiltersClassify, req),
    onClassifyProgress: (cb) => {
      const listener = (_: unknown, p: import('@shared/types').ClassifyProgress): void => cb(p)
      ipcRenderer.on(IpcChannel.FiltersClassifyProgress, listener)
      return () => ipcRenderer.removeListener(IpcChannel.FiltersClassifyProgress, listener)
    },
    clipboardPrompt: (filenames) =>
      ipcRenderer.invoke(IpcChannel.FiltersClipboardPrompt, filenames),
    clipboardApply: (filenames, responseText) =>
      ipcRenderer.invoke(IpcChannel.FiltersClipboardApply, filenames, responseText)
  },
  knowledgeMap: {
    graph: (params) => ipcRenderer.invoke(IpcChannel.KnowledgeMapGraph, params)
  },
  dev: {
    openDevTools: () => ipcRenderer.invoke(IpcChannel.DevOpenDevTools),
    closeDevTools: () => ipcRenderer.invoke(IpcChannel.DevCloseDevTools),
    reload: () => ipcRenderer.invoke(IpcChannel.DevReload),
    hardReset: () => ipcRenderer.invoke(IpcChannel.DevHardReset),
    getPaths: () => ipcRenderer.invoke(IpcChannel.DevGetPaths),
    sqlSelect: (sql) => ipcRenderer.invoke(IpcChannel.DevSqlSelect, sql),
    getStorybookInfo: () => ipcRenderer.invoke(IpcChannel.DevGetStorybookInfo),
    listStorybookScreenshots: () =>
      ipcRenderer.invoke(IpcChannel.DevListStorybookScreenshots),
    captureStorybook: () => ipcRenderer.invoke(IpcChannel.DevCaptureStorybook),
    openStorybookFolder: () =>
      ipcRenderer.invoke(IpcChannel.DevOpenStorybookFolder),
    onStorybookLog: (cb) => {
      const listener = (
        _: unknown,
        p: import('@shared/types').DevStorybookLog
      ): void => cb(p)
      ipcRenderer.on(IpcChannel.DevStorybookLog, listener)
      return () => ipcRenderer.removeListener(IpcChannel.DevStorybookLog, listener)
    },
    onToggle: (cb) => {
      const listener = (): void => cb()
      ipcRenderer.on(IpcChannel.DevToggle, listener)
      return () => ipcRenderer.removeListener(IpcChannel.DevToggle, listener)
    },
    systemCheck: () => ipcRenderer.invoke(IpcChannel.DevSystemCheck)
  },
  network: {
    summary: () => ipcRenderer.invoke(IpcChannel.NetworkSummary)
  },
  execengine: {
    getStatus: () => ipcRenderer.invoke(IpcChannel.ExecEngineGetStatus),
    setConfig: (config) => ipcRenderer.invoke(IpcChannel.ExecEngineSetConfig, config),
    signIn: (req) => ipcRenderer.invoke(IpcChannel.ExecEngineSignIn, req),
    signOut: () => ipcRenderer.invoke(IpcChannel.ExecEngineSignOut),
    healthCheck: () => ipcRenderer.invoke(IpcChannel.ExecEngineHealthCheck)
  },
  components: {
    list: () => ipcRenderer.invoke(IpcChannel.ComponentsList),
    install: (id) => ipcRenderer.invoke(IpcChannel.ComponentsInstall, id)
  },
  updater: {
    status: () => ipcRenderer.invoke(IpcChannel.UpdaterStatus),
    check: () => ipcRenderer.invoke(IpcChannel.UpdaterCheck),
    apply: () => ipcRenderer.invoke(IpcChannel.UpdaterApply),
    onStatusChanged: (cb) => {
      const listener = (_e: Electron.IpcRendererEvent, status: import('@shared/types').UpdaterStatus) =>
        cb(status)
      ipcRenderer.on(IpcChannel.UpdaterStatusChanged, listener)
      return () => ipcRenderer.removeListener(IpcChannel.UpdaterStatusChanged, listener)
    }
  }
}

contextBridge.exposeInMainWorld('electronAPI', api)
