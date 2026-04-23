import { toast } from '@/hooks/use-toast'

export type ErrorKind = 'toast' | 'modal'

export interface MutationToastOptions {
  success?: string
  error?: string
  errorKind?: ErrorKind
  onModalError?: (message: string) => void
}

export interface MutationToastHandlers<TData, TError, TVariables> {
  onSuccess?: (data: TData, vars: TVariables) => void
  onError?: (err: TError, vars: TVariables) => void
}

export function toastMutationOptions<TData = unknown, TError = unknown, TVariables = unknown>(
  opts: MutationToastOptions
): MutationToastHandlers<TData, TError, TVariables> {
  return {
    onSuccess: () => {
      if (opts.success) toast({ title: opts.success, variant: 'success' })
    },
    onError: (err) => {
      const message = opts.error ?? errorMessage(err) ?? 'Something went wrong'
      if (opts.errorKind === 'modal') {
        opts.onModalError?.(message)
      } else {
        toast({ title: message, variant: 'destructive' })
      }
    }
  }
}

function errorMessage(err: unknown): string | undefined {
  if (!err) return undefined
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  if (typeof err === 'object' && 'message' in (err as Record<string, unknown>)) {
    const m = (err as Record<string, unknown>).message
    if (typeof m === 'string') return m
  }
  return undefined
}
