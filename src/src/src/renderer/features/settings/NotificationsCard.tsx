import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, BellOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { api } from '@/lib/api'
import { toast } from '@/hooks/use-toast'

export function NotificationsCard() {
  const qc = useQueryClient()

  const { data: muted = false } = useQuery({
    queryKey: ['notifications', 'mute'],
    queryFn: () => api.notifications.getMute()
  })

  const setMute = useMutation({
    mutationFn: (next: boolean) => api.notifications.setMute(next),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
    }
  })

  const fireTest = useMutation({
    mutationFn: () => api.notifications.test(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      toast({
        title: 'Test notification fired',
        description: muted
          ? 'OS toast suppressed (currently muted). Check the bell icon for the in-app entry.'
          : 'Look for a Windows toast in the bottom-right corner. If you do not see one, enable ShortCut Studio in Windows → Settings → System → Notifications.'
      })
    }
  })

  return (
    <Card id="notifications">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {muted ? (
            <BellOff className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Bell className="h-4 w-4" />
          )}
          Notifications
        </CardTitle>
        <CardDescription>
          OS toasts pop up in the Windows notification area when something
          important happens — worker crash, LLM provider error, drive
          disappeared, update available. The bell icon in the header keeps a
          rolling history of the last 500 events.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">Pause OS toasts</p>
            <p className="text-xs text-muted-foreground">
              In-app entries keep recording so you can review them later. Useful
              during a long focus session.
            </p>
          </div>
          <Switch
            checked={muted}
            onCheckedChange={(next) => setMute.mutate(next)}
            aria-label="Mute OS toasts"
          />
        </div>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">Test notification</p>
            <p className="text-xs text-muted-foreground">
              Fire a sample event to confirm Windows is showing toasts. The
              first time, Windows may ask you to allow ShortCut Studio in
              System → Notifications.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fireTest.mutate()}
            disabled={fireTest.isPending}
          >
            Fire test
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
