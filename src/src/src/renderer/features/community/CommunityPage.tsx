import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function CommunityPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Community</h1>
        <p className="text-sm text-muted-foreground">
          IPFS storage allocation, drive selection, peer status. Stubbed for v1 — backend wiring comes with ExecEngine integration.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>IPFS & peer sharing</CardTitle>
          <CardDescription>GB allocator, drive picker, persuasion cards built in the Community task.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Placeholder — feature built in a later task.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
