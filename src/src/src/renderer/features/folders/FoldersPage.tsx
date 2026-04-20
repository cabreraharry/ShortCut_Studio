import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function FoldersPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Folders</h1>
        <p className="text-sm text-muted-foreground">
          Content detection — pick which directories to scan and which to exclude.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Content detection</CardTitle>
          <CardDescription>
            Full table + file-type filters built in the Folders task.
          </CardDescription>
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
