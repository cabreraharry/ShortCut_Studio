import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Globe2,
  Plug,
  PlugZap,
  Loader2,
  Check,
  X,
  AlertCircle,
  HeartPulse,
  Save
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { HelpHint } from '@/components/ui/help-hint'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { api } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import type {
  ExecEngineConnectionState,
  ExecEngineConnectionStatus
} from '@shared/types'

const STATE_LABELS: Record<ExecEngineConnectionState, { label: string; tone: string; icon: React.ReactNode }> = {
  'not-configured': {
    label: 'Not configured',
    tone: 'border-muted bg-muted/30 text-muted-foreground',
    icon: <Plug className="h-3 w-3" />
  },
  disconnected: {
    label: 'Disconnected',
    tone: 'border-muted bg-muted/30 text-muted-foreground',
    icon: <Plug className="h-3 w-3" />
  },
  connecting: {
    label: 'Connecting…',
    tone: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
    icon: <Loader2 className="h-3 w-3 animate-spin" />
  },
  connected: {
    label: 'Connected',
    tone: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    icon: <PlugZap className="h-3 w-3" />
  },
  expired: {
    label: 'Token expired',
    tone: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
    icon: <AlertCircle className="h-3 w-3" />
  },
  error: {
    label: 'Error',
    tone: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400',
    icon: <X className="h-3 w-3" />
  }
}

function formatExpiry(epochSec: number): string {
  const remainingMs = epochSec * 1000 - Date.now()
  if (remainingMs <= 0) return 'expired'
  const hours = Math.floor(remainingMs / 3_600_000)
  const minutes = Math.floor((remainingMs % 3_600_000) / 60_000)
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export function ExecEngineCard(): JSX.Element {
  const qc = useQueryClient()
  const { data: status } = useQuery({
    queryKey: ['execengine-status'],
    queryFn: () => api.execengine.getStatus(),
    refetchInterval: 10_000
  })
  const [signInOpen, setSignInOpen] = useState(false)

  const healthCheck = useMutation({
    mutationFn: () => api.execengine.healthCheck(),
    onSuccess: (s) => {
      qc.setQueryData(['execengine-status'], s)
      toast({
        title: s.healthOk ? 'SIS reachable' : 'SIS unreachable',
        description: s.healthOk
          ? `${s.healthLatencyMs}ms`
          : (s.lastError ?? 'No response'),
        variant: s.healthOk ? 'success' : 'destructive'
      })
    }
  })

  const signOut = useMutation({
    mutationFn: () => api.execengine.signOut(),
    onSuccess: (s) => {
      qc.setQueryData(['execengine-status'], s)
      toast({ title: 'Signed out', variant: 'success' })
    }
  })

  if (!status) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>ExecEngine</CardTitle>
          <CardDescription>Loading connection state…</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const stateInfo = STATE_LABELS[status.state]
  const isConnected = status.state === 'connected'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe2 className="h-4 w-4" />
          ExecEngine connection
          <HelpHint
            size="sm"
            label="Authenticate this client (Consumer Peer) against the ExecEngine Sign-In Service. The session token is valid for 24h and persists across app restarts. Once connected, the dashboard reads from the real backend instead of the local-only fallback."
          />
        </CardTitle>
        <CardDescription>
          Sign in to the ExecEngine SIS. Your password is never stored — only the issued session token.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className={cn('gap-1.5', stateInfo.tone)}>
            {stateInfo.icon}
            {stateInfo.label}
          </Badge>
          {status.healthOk !== undefined && (
            <Badge
              variant="outline"
              className={cn(
                'gap-1.5',
                status.healthOk
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                  : 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400'
              )}
            >
              <HeartPulse className="h-3 w-3" />
              {status.healthOk ? `${status.healthLatencyMs}ms` : 'unreachable'}
            </Badge>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            <span className="font-mono">
              {status.config.sisHost}:{status.config.sisPort}
            </span>
          </span>
        </div>

        {status.session && (
          <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Active session</span>
              <span className="text-muted-foreground">
                expires in {formatExpiry(status.session.expiresAt)}
              </span>
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5 font-mono text-[11px] text-muted-foreground">
              <div>cp_id: {status.session.cpId}</div>
              <div>master_id: {status.session.masterId}</div>
            </div>
          </div>
        )}

        {status.lastError && status.state === 'error' && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
            {status.lastError}
          </div>
        )}

        <ConfigForm config={status.config} />

        <div className="flex flex-wrap items-center gap-2">
          {isConnected ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => signOut.mutate()}
              disabled={signOut.isPending}
            >
              {signOut.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Sign out
            </Button>
          ) : (
            <Button size="sm" onClick={() => setSignInOpen(true)}>
              <PlugZap className="mr-1 h-3 w-3" />
              Sign in to ExecEngine
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => healthCheck.mutate()}
            disabled={healthCheck.isPending}
          >
            {healthCheck.isPending ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <HeartPulse className="mr-1 h-3 w-3" />
            )}
            Health check
          </Button>
        </div>
      </CardContent>

      <SignInDialog open={signInOpen} onOpenChange={setSignInOpen} />
    </Card>
  )
}

function ConfigForm({
  config
}: {
  config: ExecEngineConnectionStatus['config']
}): JSX.Element {
  const qc = useQueryClient()
  const [host, setHost] = useState(config.sisHost)
  const [port, setPort] = useState(String(config.sisPort))

  // Reset draft state if the underlying config changes (e.g. via another dialog).
  useEffect(() => {
    setHost(config.sisHost)
    setPort(String(config.sisPort))
  }, [config.sisHost, config.sisPort])

  const dirty = host !== config.sisHost || port !== String(config.sisPort)
  const saveConfig = useMutation({
    mutationFn: () =>
      api.execengine.setConfig({ sisHost: host.trim(), sisPort: Number(port) }),
    onSuccess: (s) => {
      qc.setQueryData(['execengine-status'], s)
      toast({ title: 'Connection settings saved', variant: 'success' })
    },
    onError: (err) =>
      toast({
        title: 'Could not save',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive'
      })
  })

  return (
    <div className="grid grid-cols-[1fr_120px_auto] items-end gap-2">
      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          SIS host
        </span>
        <Input value={host} onChange={(e) => setHost(e.target.value)} className="h-8 text-xs" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Port
        </span>
        <Input
          type="number"
          value={port}
          onChange={(e) => setPort(e.target.value)}
          className="h-8 text-xs"
        />
      </label>
      <Button
        variant="outline"
        size="sm"
        disabled={!dirty || saveConfig.isPending}
        onClick={() => saveConfig.mutate()}
      >
        {saveConfig.isPending ? (
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
        ) : (
          <Save className="mr-1 h-3 w-3" />
        )}
        Save
      </Button>
    </div>
  )
}

function SignInDialog({
  open,
  onOpenChange
}: {
  open: boolean
  onOpenChange: (next: boolean) => void
}): JSX.Element {
  const qc = useQueryClient()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [cpId, setCpId] = useState('')

  // Reset form when dialog closes so leftover password doesn't sit in memory.
  useEffect(() => {
    if (!open) {
      setUsername('')
      setPassword('')
      setCpId('')
    }
  }, [open])

  const signIn = useMutation({
    mutationFn: () =>
      api.execengine.signIn({
        username: username.trim(),
        password,
        cpId: cpId.trim() || undefined
      }),
    onSuccess: (result) => {
      qc.setQueryData(['execengine-status'], result.status)
      if (result.ok) {
        toast({ title: 'Connected to ExecEngine', variant: 'success' })
        onOpenChange(false)
      } else {
        toast({
          title: 'Sign-in failed',
          description: result.message ?? result.status.lastError ?? 'unknown',
          variant: 'destructive'
        })
      }
    },
    onError: (err) =>
      toast({
        title: 'Sign-in failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive'
      })
  })

  const canSubmit = username.trim().length > 0 && password.length > 0 && !signIn.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlugZap className="h-4 w-4" /> Sign in to ExecEngine
          </DialogTitle>
          <DialogDescription>
            Your credentials are sent only to the configured SIS host. The password is never stored — only the issued 24h session token.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (canSubmit) signIn.mutate()
          }}
          className="space-y-3"
        >
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium">Username</span>
            <Input
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium">Password</span>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="flex items-center gap-1 text-xs font-medium">
              CP instance ID
              <HelpHint
                size="xs"
                label="Optional. SIS will auto-assign one if you leave this blank — useful when this is a fresh peer install. Set it explicitly when re-binding to an existing peer identity."
              />
            </span>
            <Input
              value={cpId}
              onChange={(e) => setCpId(e.target.value)}
              placeholder="Leave blank to auto-assign"
              className="font-mono text-xs"
            />
          </label>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {signIn.isPending ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  <Check className="mr-1 h-3 w-3" />
                  Sign in
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
