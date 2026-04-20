import { registerAppHandlers } from './app'
import { registerModeHandlers } from './mode'
import { registerFolderHandlers } from './folders'
import { registerLlmHandlers } from './llm'
import { registerSettingsHandlers } from './settings'
import { registerProgressHandlers } from './progress'
import { registerTopicHandlers } from './topics'
import { registerIpfsHandlers } from './ipfs'
import { registerPrivacyHandlers } from './privacy'
import { registerDiagnosticsHandlers } from './diagnostics'

export function registerIpcHandlers(): void {
  registerAppHandlers()
  registerModeHandlers()
  registerFolderHandlers()
  registerLlmHandlers()
  registerSettingsHandlers()
  registerProgressHandlers()
  registerTopicHandlers()
  registerIpfsHandlers()
  registerPrivacyHandlers()
  registerDiagnosticsHandlers()
}
