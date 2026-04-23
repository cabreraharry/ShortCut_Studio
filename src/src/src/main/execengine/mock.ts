import type {
  IExecEngineClient
} from './client'
import type {
  IpfsStatus,
  Job,
  ProgressHistoryPoint,
  ProgressSummary,
  TimeRange,
  TopicDistribution,
  TopicReviewItem
} from '@shared/types'

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
    const hrs = this.elapsedHours()
    const processedLocal = Math.floor(4_102 + hrs * 5)
    const processedPeer = Math.floor(318 + Math.sin(hrs / 6) * 40 + hrs * 1.5)
    const remaining = Math.max(0, total - processedLocal - processedPeer)
    const deltaFactors: Record<TimeRange, number> = {
      '5h': 0.2,
      '12h': 0.5,
      '24h': 1,
      '1d': 1,
      '2d': 2,
      '3d': 3,
      '5d': 5,
      '10d': 10,
      all: 40
    }
    const f = deltaFactors[range]
    const deltaLocal = Math.floor(82 * f)
    const deltaPeer = Math.floor(63 * f)
    const rangeBudget = Math.max(deltaLocal + deltaPeer, 100) * 1.5
    return {
      totalFiles: total,
      processedLocal,
      processedPeer,
      remaining,
      rangeLabel: range === 'all' ? 'All time' : `Last ${range}`,
      deltaLocal,
      deltaPeer,
      etaDays: Math.round(remaining / Math.max(1, deltaLocal + deltaPeer)),
      rangeBudget: Math.ceil(rangeBudget)
    }
  }

  async getProgressHistory(range: TimeRange): Promise<ProgressHistoryPoint[]> {
    const hoursRange: Record<TimeRange, number> = {
      '5h': 5,
      '12h': 12,
      '24h': 24,
      '1d': 24,
      '2d': 48,
      '3d': 72,
      '5d': 120,
      '10d': 240,
      all: 720
    }
    const hours = hoursRange[range]
    const points: ProgressHistoryPoint[] = []
    const now = Date.now()
    const step = (hours * 60 * 60 * 1000) / 24
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
}
