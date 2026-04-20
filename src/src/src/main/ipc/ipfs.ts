import { ipcMain } from 'electron'
import { IpcChannel } from '@shared/ipc-channels'
import { getExecEngine } from '../execengine/client'
import type { IpfsStatus } from '@shared/types'

export function registerIpfsHandlers(): void {
  ipcMain.handle(IpcChannel.IpfsStatus, async (): Promise<IpfsStatus> => {
    return getExecEngine().getIpfsStatus()
  })

  ipcMain.handle(IpcChannel.IpfsSetAllocation, async (_evt, gb: number) => {
    await getExecEngine().setIpfsAllocation(gb)
  })
}
