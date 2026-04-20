import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function TopicsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Topics</h1>
        <p className="text-sm text-muted-foreground">
          Browse, trigger generation, review AI suggestions, curate super-categories.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Topic management</CardTitle>
          <CardDescription>Tree + review queue + super-categories built in the Topics task.</CardDescription>
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
