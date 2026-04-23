import type {
  IpfsStatus,
  Job,
  ProgressHistoryPoint,
  ProgressSummary,
  TimeRange,
  TopicDistribution,
  TopicReviewItem
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

  getTopicReview(): Promise<TopicReviewItem[]>
  getTopicDistribution(): Promise<TopicDistribution[]>
  rejectTopic(topicName: string): Promise<void>
  renameTopic(from: string, to: string): Promise<void>
  mergeTopic(from: string, into: string): Promise<void>
  bumpGenerateTicks(): void
}

let client: IExecEngineClient | null = null

export function getExecEngine(): IExecEngineClient {
  if (!client) client = new MockExecEngineClient()
  return client
}
