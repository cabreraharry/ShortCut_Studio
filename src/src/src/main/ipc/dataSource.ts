// TODO: flip `PROD_AVAILABLE` to true once the real IExecEngineClient implements
// a successful `getPeers()` handshake at boot. Until then, the UI's Prod option
// is visible but disabled and the main process refuses to leave demo.
import { ipcMain } from 'electron'
import { IpcChannel } from '@shared/ipc-channels'
import type { DataSource, DataSourceState } from '@shared/types'

const PROD_AVAILABLE = false

let current: DataSource = 'demo'

export function getDataSource(): DataSource {
  return current
}

function snapshot(): DataSourceState {
  return { current, prodAvailable: PROD_AVAILABLE }
}

export function registerDataSourceHandlers(): void {
  ipcMain.handle(IpcChannel.DataSourceGet, () => snapshot())
  ipcMain.handle(IpcChannel.DataSourceSet, (_evt, next: DataSource) => {
    if (next === 'prod' && !PROD_AVAILABLE) {
      current = 'demo'
    } else {
      current = next
    }
    return snapshot()
  })
}
