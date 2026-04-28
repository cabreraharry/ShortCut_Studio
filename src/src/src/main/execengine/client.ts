import type {
  IpfsStatus,
  Job,
  NetworkSummary,
  ProgressByStage,
  ProgressHistoryPoint,
  ProgressSummary,
  TimeRange,
  TopicDistribution,
  TopicReviewItem
} from '@shared/types'
import { isConnected, onConnectionChange } from './authState'
import { RealExecEngineClient } from './real'
import { RealLocalExecEngineClient } from './realLocal'

/**
 * Client contract for ExecEngine (the distributed P2P task scheduler
 * at D:/ExecEngine/).
 *
 * The factory below picks an implementation based on the live SIS auth state:
 * - **Connected** to ExecEngine (SIS session valid): `RealExecEngineClient`.
 *   Inherits all data methods from `RealLocalExecEngineClient` for now —
 *   individual methods get overridden as the Queue-TCP transport lands.
 * - **Otherwise**: `RealLocalExecEngineClient` (local SCLFolder reads + mock
 *   delegation for peer/IPFS/network).
 *
 * The cached client is invalidated when the connection state flips, so a
 * post-signin `getExecEngine()` call returns the upgraded implementation.
 * Feature code depends on this interface only — no `if (v1)` branches.
 */
export interface IExecEngineClient {
  getProgressSummary(range: TimeRange): Promise<ProgressSummary>
  getProgressHistory(range: TimeRange): Promise<ProgressHistoryPoint[]>
  getProgressByStage(range: TimeRange): Promise<ProgressByStage>
  listJobs(): Promise<Job[]>

  getIpfsStatus(): Promise<IpfsStatus>
  setIpfsAllocation(gb: number): Promise<void>

  getTopicReview(): Promise<TopicReviewItem[]>
  getTopicDistribution(): Promise<TopicDistribution[]>
  rejectTopic(topicName: string): Promise<void>
  renameTopic(from: string, to: string): Promise<void>
  mergeTopic(from: string, into: string): Promise<void>
  bumpGenerateTicks(): void

  getNetworkSummary(): Promise<NetworkSummary>
}

let client: IExecEngineClient | null = null
let lastConnected = false
let unsubscribe: (() => void) | null = null

function buildClient(connected: boolean): IExecEngineClient {
  return connected ? new RealExecEngineClient() : new RealLocalExecEngineClient()
}

export function getExecEngine(): IExecEngineClient {
  // Subscribe once: any connection-state flip busts the cached client so the
  // next call rebuilds the right implementation.
  if (!unsubscribe) {
    unsubscribe = onConnectionChange((status) => {
      const nowConnected = status.state === 'connected'
      if (nowConnected !== lastConnected) {
        lastConnected = nowConnected
        client = null
      }
    })
  }
  if (!client) {
    lastConnected = isConnected()
    client = buildClient(lastConnected)
  }
  return client
}
