import type {
  IpfsStatus,
  Job,
  NetworkSummary,
  ProgressByStage,
  ProgressHistoryPoint,
  ProgressSummary,
  StageProgress,
  TimeRange,
  TopicDistribution,
  TopicReviewItem
} from '@shared/types'
import { getLocalProgressCounts, getStageProgressCounts } from '../db/scl-folder'
import type { IExecEngineClient } from './client'
import { MockExecEngineClient } from './mock'

/**
 * Hybrid client: real local progress sourced from SCLFolder_*.db, everything
 * else delegated to the mock until ExecEngine's HTTP/FastAPI consumer-peer
 * layer ships. Peer counts stay 0 by design — there's no peer data to read
 * yet, and faking it would mislead the user during real scans.
 */
export class RealLocalExecEngineClient implements IExecEngineClient {
  private readonly mock = new MockExecEngineClient()

  async getProgressSummary(range: TimeRange): Promise<ProgressSummary> {
    // Defer to mock for the per-range delta + ETA labels — those depend on a
    // history we don't yet record (ProgressSnapshots is empty in v1). Replace
    // only the four numbers that come from a real on-disk count.
    const synthetic = await this.mock.getProgressSummary(range)
    const { totalFiles, processedLocal } = getLocalProgressCounts()
    if (totalFiles === 0) {
      // No SCL DB yet (fresh install pre-scan). Keep mock numbers so the
      // dashboard isn't a wall of zeros for first-launch users.
      return synthetic
    }
    const processedPeer = 0
    const remaining = Math.max(0, totalFiles - processedLocal - processedPeer)
    return {
      ...synthetic,
      totalFiles,
      processedLocal,
      processedPeer,
      remaining
    }
  }

  async getProgressByStage(range: TimeRange): Promise<ProgressByStage> {
    const synthetic = await this.mock.getProgressSummary(range)
    const counts = getStageProgressCounts()
    if (counts.totalFiles === 0) {
      // Fresh install pre-scan: defer entirely to the mock's synthetic per-stage
      // shape so the dashboard isn't a wall of zeros while the user is still
      // configuring folders.
      return this.mock.getProgressByStage(range)
    }

    // Real per-stage deltas need ProgressSnapshots populated by a background
    // timer (v1.5). Until then, scale the synthetic delta by each stage's
    // share of the total processed pool so the right-hand bottle stays
    // proportionally honest.
    const dl = synthetic.deltaLocal
    const stage = (n: number, est = false): StageProgress => ({
      processedLocal: n,
      processedPeer: 0,
      remaining: Math.max(0, counts.totalFiles - n),
      deltaLocal: counts.scan === 0 ? 0 : Math.floor((dl * n) / counts.scan),
      deltaPeer: 0,
      estimated: est
    })

    // References has no SCL_Demo column yet. Estimate as `llm * (0.55 / 0.72)`
    // — same ratio the dashboard used to apply via ARTIFACT_COEFFICIENTS so the
    // visual continuity for users isn't a sudden jump.
    const referencesCount = Math.floor((counts.llm * 0.55) / 0.72)

    return {
      totalFiles: counts.totalFiles,
      rangeLabel: synthetic.rangeLabel,
      rangeBudget: synthetic.rangeBudget,
      etaDays: synthetic.etaDays,
      stages: {
        scan: stage(counts.scan),
        llm: stage(counts.llm),
        references: stage(referencesCount, /* estimated */ true),
        km: stage(counts.km)
      }
    }
  }

  // History uses the same per-range curve as the mock for now. Real history
  // requires writing ProgressSnapshots from a background timer — separate
  // task. Range labels stay coherent with the summary above.
  getProgressHistory(range: TimeRange): Promise<ProgressHistoryPoint[]> {
    return this.mock.getProgressHistory(range)
  }

  listJobs(): Promise<Job[]> {
    return this.mock.listJobs()
  }

  getIpfsStatus(): Promise<IpfsStatus> {
    return this.mock.getIpfsStatus()
  }

  setIpfsAllocation(gb: number): Promise<void> {
    return this.mock.setIpfsAllocation(gb)
  }

  getTopicReview(): Promise<TopicReviewItem[]> {
    return this.mock.getTopicReview()
  }

  getTopicDistribution(): Promise<TopicDistribution[]> {
    return this.mock.getTopicDistribution()
  }

  rejectTopic(topicName: string): Promise<void> {
    return this.mock.rejectTopic(topicName)
  }

  renameTopic(from: string, to: string): Promise<void> {
    return this.mock.renameTopic(from, to)
  }

  mergeTopic(from: string, into: string): Promise<void> {
    return this.mock.mergeTopic(from, into)
  }

  bumpGenerateTicks(): void {
    this.mock.bumpGenerateTicks()
  }

  getNetworkSummary(): Promise<NetworkSummary> {
    return this.mock.getNetworkSummary()
  }
}
