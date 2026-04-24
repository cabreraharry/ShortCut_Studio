import { registerAppHandlers } from './app'
import { registerModeHandlers } from './mode'
import { registerDataSourceHandlers } from './dataSource'
import { registerFolderHandlers } from './folders'
import { registerFileTypeHandlers } from './fileTypes'
import { registerLlmHandlers } from './llm'
import { registerSettingsHandlers } from './settings'
import { registerProgressHandlers } from './progress'
import { registerTopicHandlers } from './topics'
import { registerSuperCategoryHandlers } from './superCategories'
import { registerIpfsHandlers } from './ipfs'
import { registerPrivacyHandlers } from './privacy'
import { registerDiagnosticsHandlers } from './diagnostics'
import { registerSystemHandlers } from './system'
import { registerInsightsHandlers } from './insights'
import { registerDriveHandlers } from './drives'
import { registerFilterHandlers } from './filters'
import { registerKnowledgeMapHandlers } from './knowledgeMap'
import { registerDevHandlers } from './dev'
import { registerSystemCheckHandlers } from './system-check'

export function registerIpcHandlers(): void {
  registerAppHandlers()
  registerModeHandlers()
  registerDataSourceHandlers()
  registerFolderHandlers()
  registerFileTypeHandlers()
  registerLlmHandlers()
  registerSettingsHandlers()
  registerProgressHandlers()
  registerTopicHandlers()
  registerSuperCategoryHandlers()
  registerIpfsHandlers()
  registerPrivacyHandlers()
  registerDiagnosticsHandlers()
  registerSystemHandlers()
  registerInsightsHandlers()
  registerDriveHandlers()
  registerFilterHandlers()
  registerKnowledgeMapHandlers()
  registerDevHandlers()
  registerSystemCheckHandlers()
}
