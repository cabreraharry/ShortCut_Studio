import type {
  IExecEngineClient
} from './client'
import type {
  ArtifactStage,
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

// ---------- Per-range demo profiles ----------
//
// Each TimeRange exposed in the UI gets a distinct demo "shape" so the
// Dashboard feels visibly different across 5h / 1d / 3d / 5d. Profiles below
// drive both ProgressSummary deltas and ProgressHistory curve characteristics.

type CurveKind = 'spike' | 'climb' | 'wave' | 'plateau'

interface RangeProfile {
  hours: number
  deltaLocal: number
  deltaPeer: number
  etaDays: number
  curve: CurveKind
  label: string
  /**
   * Multiplier on the baseline cumulative count. Lets each range show a
   * visibly distinct "All time" total in the demo so clicking 5h vs 5d
   * actually moves the bottle. Strictly speaking all-time is range-invariant,
   * but this is a demo and the original ±2% noise was imperceptible.
   */
  cumulativeScale: number
}

const RANGE_PROFILES: Record<TimeRange, RangeProfile> = {
  '5h':  { hours: 5,    deltaLocal: 38,   deltaPeer: 124,  etaDays: 14,  curve: 'spike',     label: 'Last 5h',   cumulativeScale: 0.58 },
  '12h': { hours: 12,   deltaLocal: 88,   deltaPeer: 198,  etaDays: 12,  curve: 'climb',     label: 'Last 12h',  cumulativeScale: 0.72 },
  '24h': { hours: 24,   deltaLocal: 162,  deltaPeer: 287,  etaDays: 11,  curve: 'climb',     label: 'Last 24h',  cumulativeScale: 0.85 },
  '1d':  { hours: 24,   deltaLocal: 162,  deltaPeer: 287,  etaDays: 11,  curve: 'climb',     label: 'Last 24h',  cumulativeScale: 0.85 },
  '2d':  { hours: 48,   deltaLocal: 286,  deltaPeer: 451,  etaDays: 9,   curve: 'wave',      label: 'Last 2d',   cumulativeScale: 1.02 },
  '3d':  { hours: 72,   deltaLocal: 410,  deltaPeer: 612,  etaDays: 8,   curve: 'wave',      label: 'Last 3d',   cumulativeScale: 1.20 },
  '5d':  { hours: 120,  deltaLocal: 612,  deltaPeer: 904,  etaDays: 6,   curve: 'plateau',   label: 'Last 5d',   cumulativeScale: 1.46 },
  '10d': { hours: 240,  deltaLocal: 1080, deltaPeer: 1480, etaDays: 5,   curve: 'plateau',   label: 'Last 10d',  cumulativeScale: 1.78 },
  all:   { hours: 720,  deltaLocal: 2900, deltaPeer: 3120, etaDays: 4,   curve: 'plateau',   label: 'All time',  cumulativeScale: 2.05 }
}

/** Maps t∈[0,1] to a "fraction of the period's delta accumulated by t". */
function curveValue(t: number, kind: CurveKind): number {
  if (t <= 0) return 0
  if (t >= 1) return 1
  switch (kind) {
    case 'spike': {
      // Flat first 70%, sharp final 30%. Visually: late surge.
      if (t < 0.7) return t * (0.08 / 0.7)
      const u = (t - 0.7) / 0.3
      return 0.08 + u * 0.92
    }
    case 'climb':
      // Steady linear growth.
      return t
    case 'wave': {
      // Linear with two superimposed undulations (work / rest cycles).
      const undulation = Math.sin(t * Math.PI * 2) * 0.08
      return Math.min(1, Math.max(0, t + undulation))
    }
    case 'plateau':
      // Fast early, leveling off. sqrt curve.
      return Math.sqrt(t)
  }
}

/**
 * v1 stub. Returns deterministic synthetic data that varies over time so
 * the Progress Glass looks alive during development. Peer counts follow a
 * slow sine wave; local counts grow with a linear trend.
 */
export class MockExecEngineClient implements IExecEngineClient {
  private readonly start = Date.now()
  private allocationGb = 0
  private readonly rejectedTopics = new Set<string>()
  private readonly renameMap = new Map<string, string>()
  private generateTicksExpiry = 0

  private elapsedHours(): number {
    return (Date.now() - this.start) / (1000 * 60 * 60)
  }

  async getProgressSummary(range: TimeRange): Promise<ProgressSummary> {
    const total = 12_483
    const profile = RANGE_PROFILES[range]
    const hrs = this.elapsedHours()

    // Each range gets its own cumulative scale so the dashboard shows visibly
    // distinct totals when the user clicks 5h vs 1d vs 5d. See cumulativeScale
    // on RangeProfile for the rationale.
    const baseLocal = (4_102 + hrs * 5) * profile.cumulativeScale
    const basePeer = (318 + Math.sin(hrs / 6) * 40 + hrs * 1.5) * profile.cumulativeScale
    const processedLocal = Math.floor(baseLocal)
    const processedPeer = Math.floor(basePeer)
    const remaining = Math.max(0, total - processedLocal - processedPeer)

    const deltaLocal = profile.deltaLocal
    const deltaPeer = profile.deltaPeer
    const rangeBudget = Math.max(deltaLocal + deltaPeer, 100) * 1.5

    return {
      totalFiles: total,
      processedLocal,
      processedPeer,
      remaining,
      rangeLabel: profile.label,
      deltaLocal,
      deltaPeer,
      etaDays: profile.etaDays,
      rangeBudget: Math.ceil(rangeBudget)
    }
  }

  async getProgressByStage(range: TimeRange): Promise<ProgressByStage> {
    // Pre-scan fallback: every stage is synthetic + flagged estimated. Mirrors
    // the per-tab coefficients the dashboard used to apply locally so the demo
    // visually still looks like four distinct stages.
    const summary = await this.getProgressSummary(range)
    const COEFF: Record<ArtifactStage, number> = {
      scan: 1.0,
      llm: 0.72,
      references: 0.55,
      km: 0.84
    }
    const stage = (k: ArtifactStage): StageProgress => {
      const c = COEFF[k]
      const processedLocal = Math.floor(summary.processedLocal * c)
      const processedPeer = Math.floor(summary.processedPeer * c)
      return {
        processedLocal,
        processedPeer,
        remaining: Math.max(0, summary.totalFiles - processedLocal - processedPeer),
        deltaLocal: Math.floor(summary.deltaLocal * c),
        deltaPeer: Math.floor(summary.deltaPeer * c),
        estimated: true
      }
    }
    return {
      totalFiles: summary.totalFiles,
      rangeLabel: summary.rangeLabel,
      rangeBudget: summary.rangeBudget,
      etaDays: summary.etaDays,
      stages: {
        scan: stage('scan'),
        llm: stage('llm'),
        references: stage('references'),
        km: stage('km')
      }
    }
  }

  async getProgressHistory(range: TimeRange): Promise<ProgressHistoryPoint[]> {
    const profile = RANGE_PROFILES[range]
    const points: ProgressHistoryPoint[] = []
    const now = Date.now()
    const step = (profile.hours * 60 * 60 * 1000) / 24

    // Cumulative-at-start = roughly today's all-time minus this range's delta.
    // We then walk forward 25 points (i = 24..0), each adding curveValue() *
    // total delta. The shape of curveValue() varies per range, so 5h's
    // history is end-loaded while 5d's plateaus.
    const finalLocal = Math.floor((4_102 + this.elapsedHours() * 5) * profile.cumulativeScale)
    const finalPeer = Math.floor(
      (318 + Math.sin(this.elapsedHours() / 6) * 40 + this.elapsedHours() * 1.5) *
        profile.cumulativeScale
    )
    const startLocal = finalLocal - profile.deltaLocal
    const startPeer = finalPeer - profile.deltaPeer

    for (let i = 24; i >= 0; i--) {
      const ts = now - i * step
      const t = (24 - i) / 24                 // 0..1 progression along the range
      const fraction = curveValue(t, profile.curve)
      points.push({
        ts,
        cumulativeLocal: Math.floor(startLocal + profile.deltaLocal * fraction),
        cumulativePeer: Math.floor(startPeer + profile.deltaPeer * fraction)
      })
    }
    return points
  }

  async listJobs(): Promise<Job[]> {
    const jobs: Job[] = [
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
    if (Date.now() < this.generateTicksExpiry) {
      const elapsed = 30 - Math.floor((this.generateTicksExpiry - Date.now()) / 1000)
      jobs.unshift({
        id: 'topics-gen',
        kind: 'topics',
        status: 'running',
        label: 'Generating topic suggestions (Gemini)…',
        startedAt: this.generateTicksExpiry - 30_000,
        progress: { current: Math.max(0, elapsed), total: 30 }
      })
    }
    return jobs
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

  async getTopicReview(): Promise<TopicReviewItem[]> {
    const seed: Array<{
      topic: string
      confidence: number
      samples: string[]
    }> = [
      { topic: 'Reinforcement Learning', confidence: 0.92, samples: ['RL_Survey_2024.pdf', 'PPO_vs_SAC.pdf', 'RainbowDQN.pdf'] },
      { topic: 'Graph Neural Networks', confidence: 0.88, samples: ['GCN_Kipf.pdf', 'GAT.pdf'] },
      { topic: 'Diffusion Models', confidence: 0.85, samples: ['DDPM.pdf', 'StableDiffusion.pdf', 'ImagenVideo.pdf'] },
      { topic: 'Retrieval-Augmented Generation', confidence: 0.81, samples: ['RAG_Lewis.pdf', 'REALM.pdf'] },
      { topic: 'Mixture of Experts', confidence: 0.78, samples: ['Switch_Transformer.pdf', 'GShard.pdf'] },
      { topic: 'Mechanistic Interpretability', confidence: 0.74, samples: ['Induction_Heads.pdf', 'SAE_Anthropic.pdf'] },
      { topic: 'Protein Folding', confidence: 0.71, samples: ['AlphaFold2.pdf', 'ESM_Atlas.pdf', 'RosettaFold.pdf'] },
      { topic: 'Constitutional AI', confidence: 0.67, samples: ['CAI_Paper.pdf', 'RLAIF.pdf'] },
      { topic: 'Speculative Decoding', confidence: 0.62, samples: ['SpecDecode.pdf', 'Medusa.pdf'] },
      { topic: 'Sparse Attention Mechanisms', confidence: 0.58, samples: ['Longformer.pdf', 'BigBird.pdf'] }
    ]
    return seed
      .filter((s) => !this.rejectedTopics.has(s.topic))
      .map((s, i) => {
        const finalTopic = this.renameMap.get(s.topic) ?? s.topic
        return {
          suggestedTopic: finalTopic,
          fileId: 1000 + i,
          fileName: s.samples[0] ?? 'unknown.pdf',
          searchText: finalTopic.toLowerCase(),
          linkName: `${finalTopic.replace(/\s+/g, '_')}.lnk`,
          confidence: s.confidence,
          sampleFiles: s.samples
        }
      })
  }

  async getTopicDistribution(): Promise<TopicDistribution[]> {
    const seed: TopicDistribution[] = [
      { topic: 'Transformers', fileCount: 412 },
      { topic: 'Reinforcement Learning', fileCount: 287 },
      { topic: 'Vision Models', fileCount: 241 },
      { topic: 'Diffusion Models', fileCount: 198 },
      { topic: 'Graph Neural Networks', fileCount: 164 },
      { topic: 'NLP Benchmarks', fileCount: 152 },
      { topic: 'Speech Recognition', fileCount: 137 },
      { topic: 'Recommender Systems', fileCount: 128 },
      { topic: 'Federated Learning', fileCount: 101 },
      { topic: 'Contrastive Learning', fileCount: 94 },
      { topic: 'Bayesian Deep Learning', fileCount: 82 },
      { topic: 'Meta-Learning', fileCount: 71 },
      { topic: 'Quantization', fileCount: 67 },
      { topic: 'AutoML', fileCount: 59 },
      { topic: 'Robustness & Adversarial', fileCount: 52 }
    ]
    return seed
  }

  async rejectTopic(topicName: string): Promise<void> {
    this.rejectedTopics.add(topicName)
  }

  async renameTopic(from: string, to: string): Promise<void> {
    this.renameMap.set(from, to)
  }

  async mergeTopic(from: string, _into: string): Promise<void> {
    this.rejectedTopics.add(from)
  }

  bumpGenerateTicks(): void {
    this.generateTicksExpiry = Date.now() + 30_000
  }

  async getNetworkSummary(): Promise<NetworkSummary> {
    const hrs = this.elapsedHours()
    const now = Date.now()

    // Agent Hub: present + healthy in the demo. Last sync drifts as time
    // passes; auth countdown ticks down from a 4-hour window.
    const lastSyncAgo = 28 + Math.floor((Math.sin(hrs * 4) + 1) * 30)        // 28..88s
    const authMs = 4 * 60 * 60 * 1000 - (Date.now() % (4 * 60 * 60 * 1000))  // 0..4h cycle

    // Pending requests: small numbers that ebb and flow with the same time-base
    // as Progress so the demo feels coherent.
    const cbr = 2 + Math.floor((Math.sin(hrs * 2) + 1) * 1.5)                // 2..5
    const csct = Math.floor((Math.cos(hrs * 3) + 1) * 0.6)                   // 0..1
    const cdreq = Math.floor((Math.sin(hrs * 1.7) + 1) * 0.7)                // 0..1
    const avgAgeMs = Math.floor(800 + (Math.cos(hrs * 5) + 1) * 600)         // 800..2000
    const throughput = 1.6 + (Math.sin(hrs * 0.8) + 1) * 0.6                 // 1.6..2.8

    // Growth sparkline: 12 points over the past few days. Slight upward
    // trend with a couple bumps — looks like real DB row growth.
    const growthPoints: NetworkSummary['growth'] = []
    const baseline = 8_400
    for (let i = 11; i >= 0; i--) {
      const ts = now - i * 6 * 60 * 60 * 1000  // every 6h
      const t = (11 - i) / 11
      const value = Math.floor(
        baseline + t * 1_200 + Math.sin((11 - i) * 1.3) * 90
      )
      growthPoints.push({ ts, totalRows: value })
    }
    const first = growthPoints[0].totalRows
    const last = growthPoints[growthPoints.length - 1].totalRows
    const growthPctChange = Math.round(((last - first) / first) * 100)

    return {
      agentHub: {
        connected: true,
        lastSyncMs: now - lastSyncAgo * 1000,
        peerId: 'CP-1001-A4F2',
        authExpiresMs: now + authMs,
        hubServerId: 'AH-EAST-7'
      },
      pending: {
        cbr,
        csct,
        cdreq,
        avgAgeMs,
        throughputPerSec: Math.round(throughput * 10) / 10
      },
      // dbFiles intentionally empty here — the IPC handler enriches with
      // real on-disk file sizes (from src/main/ipc/network.ts). Mock can't
      // know the resolved paths in dev vs packaged.
      dbFiles: [],
      growth: growthPoints,
      growthPctChange
    }
  }
}
