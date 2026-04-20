import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Trash2, Plus, Lock, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'

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
