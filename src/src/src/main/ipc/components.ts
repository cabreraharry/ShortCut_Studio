import { ipcMain } from 'electron'
import { IpcChannel } from '@shared/ipc-channels'
import type { ComponentId, ComponentStatus } from '@shared/components-manifest'
import { detectAllComponents } from '../components/detector'
import { installComponent } from '../components/installer'

export function registerComponentsHandlers(): void {
  ipcMain.handle(IpcChannel.ComponentsList, async (): Promise<ComponentStatus[]> => {
    return detectAllComponents()
  })
  ipcMain.handle(IpcChannel.ComponentsInstall, async (_evt, id: ComponentId): Promise<void> => {
    await installComponent(id)
  })
}
