import { useState } from 'react'
import { Clipboard, ClipboardCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import type { ClassifiedFilename, ClassifyFileInput } from '@shared/types'

interface ClipboardPromptViewProps {
  filenames: ClassifyFileInput[]
  onApplied: (labels: ClassifiedFilename[]) => void
}

export function ClipboardPromptView({ filenames, onApplied }: ClipboardPromptViewProps): JSX.Element {
  const [prompt, setPrompt] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [response, setResponse] = useState<string>('')
  const [isApplying, setIsApplying] = useState(false)

  const loadPrompt = async (): Promise<void> => {
    const result = await api.filters.clipboardPrompt(filenames)
    setPrompt(result.prompt)
    try {
      await navigator.clipboard.writeText(result.prompt)
      setCopied(true)
      toast({ title: 'Prompt copied to clipboard' })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({ title: 'Copy failed — select the prompt text manually', variant: 'destructive' })
    }
  }

  const applyResponse = async (): Promise<void> => {
    if (!response.trim()) {
      toast({ title: 'Paste the AI response first', variant: 'destructive' })
      return
    }
    setIsApplying(true)
    try {
      const labels = await api.filters.clipboardApply(filenames, response)
      const classified = labels.filter((l) => l.label !== 'unlabeled').length
      toast({
        title: `Applied ${classified} label${classified === 1 ? '' : 's'}`,
        description: `${labels.length - classified} filename(s) were left unlabeled (not in response).`,
        variant: 'success'
      })
      onApplied(labels)
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : 'Failed to parse response',
        variant: 'destructive'
      })
    } finally {
      setIsApplying(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Step 1 — generate the prompt
        </div>
        <Button onClick={loadPrompt} variant="outline" size="sm" type="button">
          {copied ? (
            <>
              <ClipboardCheck className="mr-1 h-3 w-3" /> Copied!
            </>
          ) : (
            <>
              <Clipboard className="mr-1 h-3 w-3" /> Build &amp; copy prompt ({filenames.length} filenames)
            </>
          )}
        </Button>
        {prompt && (
          <textarea
            value={prompt}
            readOnly
            rows={6}
            className="mt-2 w-full resize-y rounded-md border border-border bg-muted/30 p-2 font-mono text-[11px]"
          />
        )}
      </div>

      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Step 2 — paste the AI's JSON response
        </div>
        <p className="mb-1 text-[11px] text-muted-foreground">
          Paste the prompt into Claude.ai / ChatGPT / Gemini. Copy its JSON reply. Paste it below.
        </p>
        <textarea
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          rows={8}
          placeholder='[{"fileName":"…","label":"publication","confidence":0.9,"reason":"…"}, …]'
          className="w-full resize-y rounded-md border border-border bg-background p-2 font-mono text-[11px]"
        />
        <div className="mt-2 flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={applyResponse}
            disabled={!response.trim() || isApplying}
          >
            {isApplying ? 'Applying…' : 'Apply labels'}
          </Button>
        </div>
      </div>
    </div>
  )
}
