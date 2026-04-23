import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { AiLabel, FilterRule, FilterRuleType } from '@shared/types'

interface RuleBuilderProps {
  rules: FilterRule[]
  onChange: (rules: FilterRule[]) => void
}

const TYPE_LABELS: Record<FilterRuleType, string> = {
  minPages: 'Pages ≥',
  maxPages: 'Pages ≤',
  filenameIncludes: 'Filename includes',
  filenameExcludes: 'Filename excludes',
  aiLabel: 'AI label =',
  extractionMin: 'Extraction % ≥',
  maxWarnings: 'Warnings ≤'
}

const TYPE_HINTS: Record<FilterRuleType, string> = {
  minPages: 'number (e.g. 2)',
  maxPages: 'number (e.g. 200)',
  filenameIncludes: 'substring (e.g. paper)',
  filenameExcludes: 'substring (e.g. readme)',
  aiLabel: 'publication | other | unlabeled',
  extractionMin: 'percent (e.g. 85)',
  maxWarnings: 'number (e.g. 0)'
}

function newRuleId(): string {
  return `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

function defaultValueFor(type: FilterRuleType): string | number {
  switch (type) {
    case 'minPages':
      return 2
    case 'maxPages':
      return 500
    case 'filenameIncludes':
    case 'filenameExcludes':
      return ''
    case 'aiLabel':
      return 'publication' as AiLabel
    case 'extractionMin':
      return 85
    case 'maxWarnings':
      return 0
  }
}

export function RuleBuilder({ rules, onChange }: RuleBuilderProps): JSX.Element {
  const addRule = (): void => {
    onChange([
      ...rules,
      { id: newRuleId(), type: 'minPages', value: defaultValueFor('minPages'), enabled: true }
    ])
  }
  const updateRule = (id: string, patch: Partial<FilterRule>): void => {
    onChange(
      rules.map((r) => {
        if (r.id !== id) return r
        const next: FilterRule = { ...r, ...patch }
        // If type changed, reset value to a sane default for the new type.
        if (patch.type && patch.type !== r.type) {
          next.value = defaultValueFor(patch.type)
        }
        return next
      })
    )
  }
  const removeRule = (id: string): void => {
    onChange(rules.filter((r) => r.id !== id))
  }

  return (
    <div className="space-y-2">
      {rules.length === 0 && (
        <div className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
          No rules yet. Add one below to start narrowing files.
        </div>
      )}
      {rules.map((rule) => (
        <RuleRow
          key={rule.id}
          rule={rule}
          onToggle={(enabled) => updateRule(rule.id, { enabled })}
          onTypeChange={(type) => updateRule(rule.id, { type })}
          onValueChange={(value) => updateRule(rule.id, { value })}
          onRemove={() => removeRule(rule.id)}
        />
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addRule}>
        <Plus className="mr-1 h-3 w-3" /> Add rule
      </Button>
    </div>
  )
}

function RuleRow({
  rule,
  onToggle,
  onTypeChange,
  onValueChange,
  onRemove
}: {
  rule: FilterRule
  onToggle: (enabled: boolean) => void
  onTypeChange: (type: FilterRuleType) => void
  onValueChange: (value: string | number) => void
  onRemove: () => void
}): JSX.Element {
  const isNumeric =
    rule.type === 'minPages' ||
    rule.type === 'maxPages' ||
    rule.type === 'extractionMin' ||
    rule.type === 'maxWarnings'
  const isLabel = rule.type === 'aiLabel'

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md border border-border bg-card/40 p-2',
        !rule.enabled && 'opacity-50'
      )}
    >
      <input
        type="checkbox"
        checked={rule.enabled}
        onChange={(e) => onToggle(e.target.checked)}
        className="h-3.5 w-3.5 cursor-pointer accent-primary"
        aria-label={`${rule.enabled ? 'Disable' : 'Enable'} this rule`}
      />
      <select
        value={rule.type}
        onChange={(e) => onTypeChange(e.target.value as FilterRuleType)}
        className="rounded-md border border-border bg-background px-2 py-1 text-xs"
      >
        {(Object.keys(TYPE_LABELS) as FilterRuleType[]).map((t) => (
          <option key={t} value={t}>
            {TYPE_LABELS[t]}
          </option>
        ))}
      </select>
      {isLabel ? (
        <select
          value={String(rule.value)}
          onChange={(e) => onValueChange(e.target.value)}
          className="rounded-md border border-border bg-background px-2 py-1 text-xs"
        >
          <option value="publication">publication</option>
          <option value="other">other</option>
          <option value="unlabeled">unlabeled</option>
        </select>
      ) : (
        <Input
          value={String(rule.value)}
          onChange={(e) =>
            onValueChange(isNumeric ? Number(e.target.value) || 0 : e.target.value)
          }
          placeholder={TYPE_HINTS[rule.type]}
          type={isNumeric ? 'number' : 'text'}
          className="h-7 w-48 text-xs"
        />
      )}
      <IconButton
        tip="Remove this rule"
        className="ml-auto h-7 w-7"
        onClick={onRemove}
      >
        <X className="h-3.5 w-3.5" />
      </IconButton>
    </div>
  )
}
