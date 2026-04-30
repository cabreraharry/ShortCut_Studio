import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Power } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import type { LoginItemSettings } from '@shared/types'

export function StartupCard(): JSX.Element {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['login-item'],
    queryFn: () => api.app.getLoginItem()
  })

  const setMutation = useMutation({
    mutationFn: (next: LoginItemSettings) => api.app.setLoginItem(next),
    onSuccess: (saved) => {
      qc.setQueryData(['login-item'], saved)
      toast({
        title: saved.openAtLogin ? 'Auto-start enabled' : 'Auto-start disabled',
        description: saved.openAtLogin
          ? saved.startHidden
            ? 'ShortCut Studio will launch on login, hidden in the system tray.'
            : 'ShortCut Studio will open at login.'
          : 'ShortCut Studio will no longer start with Windows.'
      })
    },
    onError: (err: Error) => {
      toast({
        title: 'Failed to update startup setting',
        description: err.message,
        variant: 'destructive'
      })
    }
  })

  const openAtLogin = data?.openAtLogin ?? false
  const startHidden = data?.startHidden ?? false

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Power className="h-4 w-4" />
          Startup
        </CardTitle>
        <CardDescription>
          Launch ShortCut Studio automatically when you sign in to Windows. Appears in
          Task Manager → Startup apps. The setting is per-user and applies immediately.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : (
          <>
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={openAtLogin}
                disabled={setMutation.isPending}
                onChange={(e) =>
                  setMutation.mutate({
                    openAtLogin: e.target.checked,
                    startHidden: e.target.checked ? startHidden : false
                  })
                }
                className="h-4 w-4 cursor-pointer accent-primary"
              />
              <div className="min-w-0">
                <div className="text-sm font-medium">Launch at Windows startup</div>
                <div className="text-xs text-muted-foreground">
                  Adds a registry entry under HKCU\…\Run that points at this install.
                </div>
              </div>
            </label>
            <label
              className={
                openAtLogin
                  ? 'flex cursor-pointer items-center gap-3 pl-7'
                  : 'flex items-center gap-3 pl-7 opacity-50'
              }
            >
              <input
                type="checkbox"
                checked={startHidden}
                disabled={!openAtLogin || setMutation.isPending}
                onChange={(e) =>
                  setMutation.mutate({
                    openAtLogin: true,
                    startHidden: e.target.checked
                  })
                }
                className="h-4 w-4 cursor-pointer accent-primary"
              />
              <div className="min-w-0">
                <div className="text-sm font-medium">Start minimized to the system tray</div>
                <div className="text-xs text-muted-foreground">
                  Skip showing the main window on launch. Use the tray icon (or this Settings
                  page) to open it later.
                </div>
              </div>
            </label>
          </>
        )}
      </CardContent>
    </Card>
  )
}
