import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from './EmptyState'

// Standardised error-state card for failed React Query reads. Pages call this
// when useQueryState returns kind:'error' so the recovery UX is consistent
// (one Try-again button, the error message visible but not scary).

interface Props {
  error?: Error
  onRetry: () => void
  // Optional override for the heading. Defaults to a generic "Couldn't load
  // this page" — pages with more specific framing (e.g. "Couldn't load
  // topics") should pass a title.
  title?: string
}

export function QueryErrorState({ error, onRetry, title }: Props): JSX.Element {
  return (
    <EmptyState
      variant="error"
      title={title ?? "Couldn't load this page"}
      description={error?.message ?? 'Something went wrong fetching the data. Try again, or check Settings → Errors for details.'}
      action={
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Try again
        </Button>
      }
    />
  )
}
