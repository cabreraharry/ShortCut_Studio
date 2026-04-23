import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Trash2, Plus, Lock, ShieldCheck, Globe, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { PrivacyShield } from '@/components/visual/PrivacyShield'
import type { DbMode } from '@shared/types'

export default function PrivacyPage() {
  const qc = useQueryClient()
  const { data: terms = [] } = useQuery({
    queryKey: ['privacy-terms'],
    queryFn: () => api.privacy.listTerms()
  })
  const [userTerms, setUserTerms] = useState<string[]>([])
  const [newTerm, setNewTerm] = useState('')

  useEffect(() => {
    setUserTerms(terms.filter((t) => t.source === 'user').map((t) => t.term))
  }, [terms])

  const persist = useMutation({
    mutationFn: (next: string[]) => api.privacy.updateTerms(next),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['privacy-terms'] })
  })

  const systemTerms = terms.filter((t) => t.source === 'system')

  const addTerm = () => {
    const t = newTerm.trim().toLowerCase()
    if (!t || userTerms.includes(t)) return
    const next = [...userTerms, t]
    setUserTerms(next)
    persist.mutate(next)
    setNewTerm('')
  }

  const removeUserTerm = (t: string) => {
    const next = userTerms.filter((x) => x !== t)
    setUserTerms(next)
    persist.mutate(next)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Privacy</h1>
        <p className="text-sm text-muted-foreground">
          Files or folders whose path contains any of these terms are routed to the Private database. Matching uses case-insensitive substring — no regex.
        </p>
      </div>

      <PrivacyShield />

      <LibraryModeCard />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            System defaults
          </CardTitle>
          <CardDescription>
            Included out of the box. Add your own below to tailor to your workflow.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {systemTerms.map((t) => (
              <Badge key={t.term} variant="secondary" className="gap-1">
                <Lock className="h-3 w-3" />
                {t.term}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your terms</CardTitle>
          <CardDescription>
            Terms you've added. Changes apply on the next scan pass; files already classified stay put.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Add a private term (e.g. client-name, project-alpha)"
              value={newTerm}
              onChange={(e) => setNewTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addTerm()
              }}
              className="max-w-md"
            />
            <Button variant="outline" onClick={addTerm} disabled={!newTerm.trim()}>
              <Plus className="mr-1 h-3 w-3" />
              Add
            </Button>
          </div>
          {userTerms.length === 0 ? (
            <p className="text-xs text-muted-foreground">No user terms yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {userTerms.map((t) => (
                <div
                  key={t}
                  className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-xs"
                >
                  <Lock className="h-3 w-3" />
                  {t}
                  <button
                    type="button"
                    onClick={() => removeUserTerm(t)}
                    className="ml-0.5 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function LibraryModeCard() {
  const qc = useQueryClient()
  const { data: mode } = useQuery({
    queryKey: ['mode'],
    queryFn: () => api.mode.get()
  })
  const setMode = useMutation({
    mutationFn: (next: DbMode) => api.mode.set(next),
    onSuccess: () => qc.invalidateQueries()
  })
  const current: DbMode = mode ?? 'publ'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-4 w-4" />
          Library mode
        </CardTitle>
        <CardDescription>
          Your scans and topics live in <b>two separate databases</b>. Switch between them to keep work-related
          research walled off from personal study, or to share one while keeping the other invisible to peers.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <ModeOption
            kind="publ"
            active={current === 'publ'}
            onClick={() => setMode.mutate('publ')}
          />
          <ModeOption
            kind="priv"
            active={current === 'priv'}
            onClick={() => setMode.mutate('priv')}
          />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          The mode chip in the top-right header shows which library you&apos;re currently viewing. Click it any
          time to return here.
        </p>
      </CardContent>
    </Card>
  )
}

function ModeOption({
  kind,
  active,
  onClick
}: {
  kind: DbMode
  active: boolean
  onClick: () => void
}): JSX.Element {
  const isPrivate = kind === 'priv'
  const Icon = isPrivate ? Lock : Globe
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex flex-col gap-2 rounded-lg border p-4 text-left transition-all',
        active
          ? isPrivate
            ? 'border-rose-500/50 bg-rose-500/10 shadow-sm'
            : 'border-glass-local/50 bg-glass-local/10 shadow-sm'
          : 'border-border bg-card/40 hover:border-primary/40 hover:bg-accent/40'
      )}
    >
      <div className="flex items-center gap-2">
        <div
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-md',
            isPrivate
              ? active
                ? 'bg-rose-500/25 text-rose-800 dark:text-rose-300'
                : 'bg-muted/50 text-muted-foreground'
              : active
                ? 'bg-glass-local/25 text-glass-local'
                : 'bg-muted/50 text-muted-foreground'
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold">
            {isPrivate ? 'Private library' : 'Public library'}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {active ? 'Currently active' : 'Click to switch'}
          </div>
        </div>
        {active && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
      </div>
      <p className="text-xs text-muted-foreground">
        {isPrivate
          ? 'Scans and topics here are NEVER shared with peers or sent to remote LLMs. Files whose path contains any of your private terms (below) are auto-routed here.'
          : 'Shared with the peer network so duplicate files only need to be processed once. Use this for public research — papers, textbooks, open-source docs.'}
      </p>
    </button>
  )
}
