import type {
  IExecEngineClient
} from './client'
import type {
  IpfsStatus,
  Job,
  ProgressHistoryPoint,
  ProgressSummary,
  TimeRange
} from '@shared/types'

/**
 * v1 stub. Returns deterministic synthetic data that varies over time so
 * the Progress Glass looks alive during development. Peer counts follow a
 * slow sine wave; local counts grow with a linear trend.
 */
export class MockExecEngineClient implements IExecEngineClient {
  private readonly start = Date.now()
  private allocationGb = 0

  private elapsedHours(): number {
    return (Date.now() - this.start) / (1000 * 60 * 60)
  }

  async getProgressSummary(range: TimeRange): Promise<ProgressSummary> {
    const total = 12_483
    const hrs = this.elapsedHours()
    const processedLocal = Math.floor(4_102 + hrs * 5)
    const processedPeer = Math.floor(318 + Math.sin(hrs / 6) * 40 + hrs * 1.5)
    const remaining = Math.max(0, total - processedLocal - processedPeer)
    const deltaFactors: Record<TimeRange, number> = {
      '12h': 0.5,
      '24h': 1,
      '2d': 2,
      '5d': 5,
      '10d': 10,
      all: 40
    }
    const f = deltaFactors[range]
    return {
      totalFiles: total,
      processedLocal,
      processedPeer,
      remaining,
      rangeLabel: range === 'all' ? 'All time' : `Last ${range}`,
      deltaLocal: Math.floor(82 * f),
      deltaPeer: Math.floor(63 * f),
      etaDays: Math.round(remaining / Math.max(1, 82 * f + 63 * f))
    }
  }

  async getProgressHistory(range: TimeRange): Promise<ProgressHistoryPoint[]> {
    const hoursRange: Record<TimeRange, number> = {
      '12h': 12,
      '24h': 24,
      '2d': 48,
      '5d': 120,
      '10d': 240,
      all: 720
    }
    const hours = hoursRange[range]
    const points: ProgressHistoryPoint[] = []
    const now = Date.now()
    const step = (hours * 60 * 60 * 1000) / 24 // 24 points regardless of range
    for (let i = 24; i >= 0; i--) {
      const ts = now - i * step
      const h = (ts - this.start) / (1000 * 60 * 60)
      points.push({
        ts,
        cumulativeLocal: Math.floor(4_000 + h * 5),
        cumulativePeer: Math.floor(300 + h * 1.5)
      })
    }
    return points
  }

  async listJobs(): Promise<Job[]> {
    return [
      {
        id: 'scan-1',
        kind: 'scan',
        status: 'running',
        label: 'Scanning /Papers/NeurIPS',
        startedAt: Date.now() - 1000 * 60 * 3,
        progress: { current: 124, total: 340 }
      },
      {
        id: 'topics-1',
        kind: 'topics',
        status: 'queued',
        label: '4 files queued for topic generation'
      },
      {
        id: 'classify-1',
        kind: 'classify',
        status: 'paused',
        label: 'Classification paused — no LLM configured'
      }
    ]
  }

  async getIpfsStatus(): Promise<IpfsStatus> {
    return {
      running: false,
      allocationGb: this.allocationGb,
      minAllocationGb: 8,
      peerCount: 0,
      storedBytes: 0,
      sharedBytes: 0
    }
  }

  async setIpfsAllocation(gb: number): Promise<void> {
    this.allocationGb = gb
  }
}
