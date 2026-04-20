import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannel } from '@shared/ipc-channels'
import type { ElectronAPI } from '@shared/api'

const api: ElectronAPI = {
  app: {
    quit: () => ipcRenderer.invoke(IpcChannel.AppQuit),
    openExternal: (url) => ipcRenderer.invoke(IpcChannel.AppOpenExternal, url),
    getVersion: () => ipcRenderer.invoke(IpcChannel.AppGetVersion)
  },
  mode: {
    get: () => ipcRenderer.invoke(IpcChannel.ModeGet),
    set: (mode) => ipcRenderer.invoke(IpcChannel.ModeSet, mode)
  },
  folders: {
    list: () => ipcRenderer.invoke(IpcChannel.FoldersList),
    add: (paths) => ipcRenderer.invoke(IpcChannel.FoldersAdd, paths),
    remove: (id) => ipcRenderer.invoke(IpcChannel.FoldersRemove, id),
    updatePath: (id, newPath) =>
      ipcRenderer.invoke(IpcChannel.FoldersUpdatePath, id, newPath),
    pickDirectory: () => ipcRenderer.invoke(IpcChannel.FoldersPickDirectory)
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
      ipcRenderer.invoke(IpcChannel.LlmTestConnection, providerId)
  },
  settings: {
    get: () => ipcRenderer.invoke(IpcChannel.SettingsGet),
    update: (patch) => ipcRenderer.invoke(IpcChannel.SettingsUpdate, patch)
  },
  progress: {
    summary: (range) => ipcRenderer.invoke(IpcChannel.ProgressSummary, range),
    jobs: () => ipcRenderer.invoke(IpcChannel.ProgressJobs),
    history: (range) => ipcRenderer.invoke(IpcChannel.ProgressHistory, range)
  },
  topics: {
    list: () => ipcRenderer.invoke(IpcChannel.TopicsList),
    generate: (folderId) =>
      ipcRenderer.invoke(IpcChannel.TopicsGenerate, folderId),
    review: () => ipcRenderer.invoke(IpcChannel.TopicsReview),
    approve: (items) => ipcRenderer.invoke(IpcChannel.TopicsApprove, items)
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
      ipcRenderer.invoke(IpcChannel.DiagnosticsTailLog, name, lines)
  }
}

contextBridge.exposeInMainWorld('electronAPI', api)
