import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function LlmPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">LLMs</h1>
        <p className="text-sm text-muted-foreground">
          Configure providers, API keys, and per-job model selection.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>LLM configuration</CardTitle>
          <CardDescription>Providers, onboarding modal, test connection built in the LLM task.</CardDescription>
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
