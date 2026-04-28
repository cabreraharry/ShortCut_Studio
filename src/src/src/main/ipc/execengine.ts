import { ipcMain } from 'electron'
import { IpcChannel } from '@shared/ipc-channels'
import type {
  ExecEngineConfig,
  ExecEngineConnectionStatus,
  ExecEngineSignInRequest,
  ExecEngineSignInResult
} from '@shared/types'
import {
  getStatus,
  runHealthCheck,
  setConfig,
  signIn,
  signOut
} from '../execengine/authState'

/**
 * IPC surface for the renderer to manage the SIS connection: read the
 * current status, change host/port config, sign in / out, force a health
 * check. The session token itself is never exposed — only metadata
 * (cpId, masterId, expiresAt, state).
 */
export function registerExecEngineHandlers(): void {
  ipcMain.handle(
    IpcChannel.ExecEngineGetStatus,
    (): ExecEngineConnectionStatus => getStatus()
  )

  ipcMain.handle(
    IpcChannel.ExecEngineSetConfig,
    (_evt, config: ExecEngineConfig): ExecEngineConnectionStatus => {
      // Light input validation — bad values would otherwise corrupt
      // AdminData. Caller (renderer) typically validates too.
      const sisHost = (config?.sisHost ?? '').trim()
      const sisPort = Number(config?.sisPort)
      if (!sisHost) throw new Error('VALIDATION: sisHost is required')
      if (!Number.isInteger(sisPort) || sisPort < 1 || sisPort > 65535) {
        throw new Error('VALIDATION: sisPort must be an integer between 1 and 65535')
      }
      return setConfig({ sisHost, sisPort })
    }
  )

  ipcMain.handle(
    IpcChannel.ExecEngineSignIn,
    (_evt, req: ExecEngineSignInRequest): Promise<ExecEngineSignInResult> => {
      // Defense-in-depth: typescript types don't survive IPC.
      if (!req || typeof req !== 'object') {
        throw new Error('VALIDATION: invalid signin request')
      }
      if (typeof req.username !== 'string' || !req.username) {
        throw new Error('VALIDATION: username is required')
      }
      if (typeof req.password !== 'string' || !req.password) {
        throw new Error('VALIDATION: password is required')
      }
      return signIn(req)
    }
  )

  ipcMain.handle(
    IpcChannel.ExecEngineSignOut,
    (): Promise<ExecEngineConnectionStatus> => signOut()
  )

  ipcMain.handle(
    IpcChannel.ExecEngineHealthCheck,
    (): Promise<ExecEngineConnectionStatus> => runHealthCheck()
  )
}
