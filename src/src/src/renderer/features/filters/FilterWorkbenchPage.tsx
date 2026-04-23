import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bot, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'
import type {
  ClassifyFileInput,
  FilterPreset,
  FilterRuleSet
} from '@shared/types'
import { RuleBuilder } from './RuleBuilder'
import { PreviewPanel } from './PreviewPanel'
import { ClassifyDialog } from './ClassifyDialog'
import { PresetsMenu } from './PresetsMenu'

export default function FilterWorkbenchPage(): JSX.Element {
  const { data: groups = [] } = useQuery({
    queryKey: ['insights-groups', ''],
    queryFn: () => api.insights.groups()
  })
  const [ruleSet, setRuleSet] = useState<FilterRuleSet>({ rules: [] })
  const [classifyOpen, setClassifyOpen] = useState(false)

  const folders = useMemo(() => groups.map((g) => g.folder), [groups])

  const loadPreset = (preset: FilterPreset): void => {
    setRuleSet(preset.ruleSet)
  }

  // Pull matching filenames from the preview to know what to classify.
  // For now, we classify ALL files in the selected folder (up to a cap) rather
  // than only matched ones — so the user can classify before their rules narrow.
  const { data: allFilesResult } = useQuery({
    queryKey: ['filter-all-files', ruleSet.folder],
    queryFn: () =>
      api.insights.list({
        folder: ruleSet.folder,
        limit: 500,
        offset: 0,
        sort: 'name',
        sortDir: 'asc'
      })
  })
  const classifiableFilenames: ClassifyFileInput[] = useMemo(
    () =>
      (allFilesResult?.rows ?? []).map((r) => ({
        fileId: r.fileId,
        fileName: r.fileName
      })),
    [allFilesResult]
  )

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <SlidersHorizontal className="h-6 w-6" />
            Filter workbench
          </h1>
          <p className="text-sm text-muted-foreground">
            Compose filter rules to isolate publications from noise. Tune live, classify filenames with AI,
            save presets. Per the product constraint: we&apos;re not a file manager — we&apos;re a PreScanner.
          </p>
        </div>
        <PresetsMenu activeRuleSet={ruleSet} onLoad={loadPreset} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rules</CardTitle>
            <CardDescription>
              All enabled rules must pass (AND). Disable a rule to A/B-test without deleting it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Folder scope
              </label>
              <select
                value={ruleSet.folder ?? ''}
                onChange={(e) =>
                  setRuleSet((r) => ({ ...r, folder: e.target.value || undefined }))
                }
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              >
                <option value="">All folders</option>
                {folders.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            <RuleBuilder
              rules={ruleSet.rules}
              onChange={(rules) => setRuleSet((r) => ({ ...r, rules }))}
            />

            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <Button
                type="button"
                onClick={() => setClassifyOpen(true)}
                disabled={classifiableFilenames.length === 0}
              >
                <Bot className="mr-1 h-4 w-4" />
                Classify with AI
              </Button>
              <span className="text-[11px] text-muted-foreground">
                {classifiableFilenames.length} file{classifiableFilenames.length === 1 ? '' : 's'} in scope
              </span>
            </div>
          </CardContent>
        </Card>

        <PreviewPanel ruleSet={ruleSet} />
      </div>

      <ClassifyDialog
        open={classifyOpen}
        onOpenChange={setClassifyOpen}
        filenames={classifiableFilenames}
        onApplied={() => {
          // Preview auto-refreshes via React Query invalidation in ClassifyDialog.
        }}
      />
    </div>
  )
}
