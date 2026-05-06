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
        title: 'Sent a test notification',
        description: muted
          ? "Popup is hidden because they're paused right now. Open the bell icon up top to see the entry."
          : 'Look in the bottom-right corner of your screen for a popup. If nothing appears, allow ShortCut Studio in Windows → Settings → System → Notifications.'
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
          Get a popup in the bottom-right corner of your screen when something
          important happens — a worker stops, an LLM provider fails, a folder
          disappears, an update is ready. Popups appear even when you&rsquo;re
          working in another app. The bell icon in the header keeps a history
          of the last 500 events.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">Show popup notifications</p>
            <p className="text-xs text-muted-foreground">
              When off, popups stop appearing on screen but the bell icon keeps
              recording events so you can review them later. Useful during a
              long focus session.
            </p>
          </div>
          <Switch
            checked={!muted}
            onCheckedChange={(showPopups) => setMute.mutate(!showPopups)}
            aria-label="Show popup notifications"
          />
        </div>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">Send a test notification</p>
            <p className="text-xs text-muted-foreground">
              Sends a sample popup to confirm Windows is showing them. The
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
            Send test
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
