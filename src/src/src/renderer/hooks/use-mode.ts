import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { api } from '@/lib/api'
import type { DbMode } from '@shared/types'

/**
 * Read the current Public/Private DB mode + subscribe to main-process
 * `mode:changed` broadcasts so React Query stays in sync across windows
 * (and across handler-driven flips that originate from another renderer).
 *
 * Mode-sensitive query keys MUST include the mode string — see usage
 * below — so an in-flight query started in publ mode lands its response
 * in a different cache slot than the new priv mode the renderer just
 * flipped to. Without that keying, the response from the old mode would
 * poison the active view (private topics with public file counts).
 *
 * Usage:
 *   const mode = useMode()
 *   useQuery({
 *     queryKey: ['topics', mode],
 *     queryFn: () => api.topics.list()
 *   })
 *
 * The hook returns 'publ' as the optimistic default so first-render
 * doesn't have to handle the loading state — the worst case is a brief
 * stale render against the wrong mode that the broadcast immediately
 * corrects when the actual ModeGet resolves.
 */
export function useMode(): DbMode {
  const qc = useQueryClient()
  const { data } = useQuery({
    queryKey: ['mode'],
    queryFn: () => api.mode.get(),
    // Mode rarely changes; once we have it, treat it as fresh until a
    // broadcast invalidates. Without staleTime: Infinity, useQuery
    // refetches on every focus event, racing the broadcast.
    staleTime: Infinity
  })
  // Subscribe to broadcasts AFTER the initial fetch so we don't miss
  // a flip that happens during boot. Calling setQueryData here is safe
  // and synchronous — the next read returns the updated value.
  useEffect(() => {
    const off = api.mode.onChanged((next) => {
      qc.setQueryData(['mode'], next)
    })
    return off
  }, [qc])
  return data ?? 'publ'
}
