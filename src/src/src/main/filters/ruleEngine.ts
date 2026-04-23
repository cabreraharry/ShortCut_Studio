import type {
  AiLabel,
  DocumentInsight,
  FilterRule,
  FilterRuleSet,
  FilterPreviewResult
} from '@shared/types'

function predicate(
  rule: FilterRule,
  file: DocumentInsight,
  labels: Map<number, AiLabel>
): boolean {
  switch (rule.type) {
    case 'minPages':
      return file.pageCount >= Number(rule.value)
    case 'maxPages':
      return file.pageCount <= Number(rule.value)
    case 'filenameIncludes': {
      const v = String(rule.value).toLowerCase()
      if (!v) return true
      return file.fileName.toLowerCase().includes(v)
    }
    case 'filenameExcludes': {
      const v = String(rule.value).toLowerCase()
      if (!v) return true
      return !file.fileName.toLowerCase().includes(v)
    }
    case 'aiLabel': {
      const want = String(rule.value) as AiLabel
      const got = labels.get(file.fileId) ?? 'unlabeled'
      return got === want
    }
    case 'extractionMin':
      return file.extractionPct >= Number(rule.value)
    case 'maxWarnings':
      return file.warnings <= Number(rule.value)
  }
}

export function applyRules(
  ruleSet: FilterRuleSet,
  files: DocumentInsight[],
  labels: Map<number, AiLabel>
): FilterPreviewResult {
  const activeRules = ruleSet.rules.filter((r) => r.enabled)
  const matched: DocumentInsight[] = []
  const excluded: DocumentInsight[] = []
  for (const file of files) {
    const passes = activeRules.every((r) => predicate(r, file, labels))
    if (passes) matched.push(file)
    else excluded.push(file)
  }
  return {
    matchedCount: matched.length,
    excludedCount: excluded.length,
    totalCount: files.length,
    sampleMatched: matched.slice(0, 10),
    sampleExcluded: excluded.slice(0, 10)
  }
}
