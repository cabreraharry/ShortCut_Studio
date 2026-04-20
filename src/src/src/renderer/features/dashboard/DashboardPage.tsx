import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          The Progress Glass and job queue will land here in the Progress task.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Progress Glass — coming up</CardTitle>
          <CardDescription>
            Flagship visualization: two liquids (local + peer), time-range selector, ETA
            projection. Synthetic data in v1, real peer data when ExecEngine integration lands.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-48 rounded-md border border-dashed border-border/70 p-4 text-center text-sm text-muted-foreground">
            Placeholder — Progress Glass built in a later task
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
