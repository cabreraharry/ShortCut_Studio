import type {
  IpfsStatus,
  Job,
  ProgressHistoryPoint,
  ProgressSummary,
  TimeRange
} from '@shared/types'
import { MockExecEngineClient } from './mock'

/**
 * Client contract for ExecEngine (the distributed P2P task scheduler
 * at D:/ExecEngine/). v1 uses the mock; v2 swaps in a real implementation
 * that speaks the Consumer Peer protocol.
 *
 * Feature code depends on this interface — no `if (v1)` branches in
 * consumers.
 */
export interface IExecEngineClient {
  getProgressSummary(range: TimeRange): Promise<ProgressSummary>
  getProgressHistory(range: TimeRange): Promise<ProgressHistoryPoint[]>
  listJobs(): Promise<Job[]>

  getIpfsStatus(): Promise<IpfsStatus>
  setIpfsAllocation(gb: number): Promise<void>
}

let client: IExecEngineClient | null = null

export function getExecEngine(): IExecEngineClient {
  if (!client) client = new MockExecEngineClient()
  return client
}
