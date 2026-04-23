import type { AiLabel, ClassifiedFilename } from '@shared/types'
import type { ClassifierAdapter, ClassifierAdapterOpts } from './index'

// Deterministic heuristic classifier. Useful for offline demos, tests, and as a
// fallback when the user has no provider configured. No network, no token cost.
//
// Rules (applied in order; first match wins):
//  - Contains common non-publication terms -> "other" (readme, tax, receipt, invoice, resume, notes, draft, todo)
//  - Matches a known publication suffix pattern (_[year], _vN, _preprint, _submitted) -> "publication"
//  - Known publication keywords (paper, survey, proceedings, thesis, arxiv, neurips, icml, iclr, cvpr, acl) -> "publication"
//  - Filename looks "academic" (Title_Case_With_Underscores, length > 20) -> "publication" at lower confidence
//  - Default -> "unlabeled"

const OTHER_TERMS = /\b(readme|license|tax|receipt|invoice|resume|cv|notes|draft|todo|meeting|agenda|personal)\b/i
const PUB_KEYWORDS =
  /\b(paper|survey|proceedings|thesis|dissertation|arxiv|neurips|nips|icml|iclr|cvpr|acl|naacl|emnlp|ieee|acm|nature|science|siggraph)\b/i
const PUB_SUFFIX = /(_\d{4}|_v\d+|_preprint|_submitted|_camera[-_]?ready)\.pdf$/i
const ACADEMIC_SHAPE = /^[A-Z][A-Za-z0-9]+(?:_[A-Za-z0-9]+){2,}\.pdf$/

function classifyOne(fileName: string): { label: AiLabel; confidence: number; reason: string } {
  if (OTHER_TERMS.test(fileName)) {
    return { label: 'other', confidence: 0.85, reason: 'matches non-publication keyword' }
  }
  if (PUB_SUFFIX.test(fileName)) {
    return { label: 'publication', confidence: 0.92, reason: 'matches publication suffix pattern' }
  }
  if (PUB_KEYWORDS.test(fileName)) {
    return { label: 'publication', confidence: 0.88, reason: 'matches publication keyword' }
  }
  if (ACADEMIC_SHAPE.test(fileName)) {
    return { label: 'publication', confidence: 0.62, reason: 'title_case_with_underscores shape' }
  }
  return { label: 'unlabeled', confidence: 0, reason: 'no rule matched' }
}

export const mockAdapter: ClassifierAdapter = {
  provider: 'mock',
  defaultModel: 'mock:heuristic',
  classify: async (opts: ClassifierAdapterOpts): Promise<ClassifiedFilename[]> => {
    return opts.filenames.map((f) => {
      const r = classifyOne(f.fileName)
      return {
        fileId: f.fileId,
        fileName: f.fileName,
        label: r.label,
        confidence: r.confidence,
        reason: r.reason
      }
    })
  }
}
