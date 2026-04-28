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
import { RealLocalExecEngineClient } from './realLocal'

/**
 * Skeleton for a fully-connected ExecEngine Consumer Peer client.
 *
 * **Status**: SIS authentication is real and working. Every other method
 * still falls back to the local + mock data sources because the Queue-TCP
 * transport (CBR / CDREQ / CSCT message exchange with Agent Hub) isn't
 * implemented in this client yet. As individual Queue methods land, the
 * relevant override here gets filled in.
 *
 * Each method's JSDoc documents the protocol mapping it WILL use. See
 * `protocol.ts` for the exact wire types and
 * `D:/ExecEngine/V2/docu_V2/Consumer_Peer_Integration.md` for the canonical
 * spec. Until then, we extend `RealLocalExecEngineClient` so feature code
 * keeps working — using this client is functionally equivalent to using the
 * local one, plus the connection-status surface tells the user "yes, we are
 * authenticated to ExecEngine".
 */
export class RealExecEngineClient extends RealLocalExecEngineClient {
  /**
   * **Future protocol**: send `CSCT` (or a dedicated stats query) and read
   * the corresponding response. For now, real local counts from SCLFolder.
   */
  override getProgressSummary(range: TimeRange): Promise<ProgressSummary> {
    return super.getProgressSummary(range)
  }

  /**
   * **Future protocol**: poll Agent Hub history. ProgressSnapshots writer
   * (Round-3-ish) feeds the equivalent local view.
   */
  override getProgressHistory(range: TimeRange): Promise<ProgressHistoryPoint[]> {
    return super.getProgressHistory(range)
  }

  /**
   * **Future protocol**: per-stage queries against Agent Hub's TaskTypeID
   * aggregates. For now, real local SCLFolder reads + estimated References.
   */
  override getProgressByStage(range: TimeRange): Promise<ProgressByStage> {
    return super.getProgressByStage(range)
  }

  /**
   * **Future protocol**: `CSCT` request returns the next assigned task. We
   * could surface in-flight CSCT/TRSC pairs as Jobs.
   */
  override listJobs(): Promise<Job[]> {
    return super.listJobs()
  }

  /**
   * **Future protocol**: peer-to-IPFS-Guardian query (no message type spec'd
   * yet in the Consumer Peer doc).
   */
  override getIpfsStatus(): Promise<IpfsStatus> {
    return super.getIpfsStatus()
  }

  /**
   * **Future protocol**: peer-local config write + replication notification
   * to Agent Hub.
   */
  override setIpfsAllocation(gb: number): Promise<void> {
    return super.setIpfsAllocation(gb)
  }

  /**
   * **Future protocol**: combination of `CSMS` (peer stats) + Agent Hub
   * pending-queue counts (CBR, CDREQ, CSCT in flight).
   */
  override getNetworkSummary(): Promise<NetworkSummary> {
    return super.getNetworkSummary()
  }

  // ---- Topic management — local-DB-only on the protocol design ----
  // The Consumer Peer doc doesn't describe a wire format for topic review,
  // rename, or merge. These remain local SQLite operations.

  override getTopicReview(): Promise<TopicReviewItem[]> {
    return super.getTopicReview()
  }

  override getTopicDistribution(): Promise<TopicDistribution[]> {
    return super.getTopicDistribution()
  }

  override rejectTopic(topicName: string): Promise<void> {
    return super.rejectTopic(topicName)
  }

  override renameTopic(from: string, to: string): Promise<void> {
    return super.renameTopic(from, to)
  }

  override mergeTopic(from: string, into: string): Promise<void> {
    return super.mergeTopic(from, into)
  }

  override bumpGenerateTicks(): void {
    super.bumpGenerateTicks()
  }
}
