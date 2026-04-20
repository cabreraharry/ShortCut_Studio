import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { useEffect, useState } from 'react'

function useTheme() {
  const [isDark, setIsDark] = useState(true)
  useEffect(() => {
    const root = document.documentElement
    if (isDark) root.classList.add('dark')
    else root.classList.remove('dark')
  }, [isDark])
  return { isDark, toggle: () => setIsDark((v) => !v) }
}

export function Header() {
  const qc = useQueryClient()
  const { data: mode } = useQuery({
    queryKey: ['mode'],
    queryFn: () => api.mode.get()
  })
  const setMode = useMutation({
    mutationFn: (next: 'publ' | 'priv') => api.mode.set(next),
    onSuccess: () => {
      qc.invalidateQueries()
    }
  })
  const { isDark, toggle } = useTheme()

  const current = mode ?? 'publ'
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card/50 px-4">
      <div className="flex items-center gap-2 text-sm font-semibold tracking-tight">
        <span>SCL Admin</span>
        <span className="text-xs font-normal text-muted-foreground">v0.2</span>
      </div>
      <div className="flex items-center gap-2">
        <ModeToggle
          value={current}
          onChange={(next) => setMode.mutate(next)}
        />
        <Button variant="ghost" size="icon" onClick={toggle} title="Toggle theme">
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>
    </header>
  )
}

function ModeToggle({
  value,
  onChange
}: {
  value: 'publ' | 'priv'
  onChange: (next: 'publ' | 'priv') => void
}) {
  return (
    <div className="inline-flex items-center rounded-md border border-border bg-muted/30 p-0.5 text-xs">
      <button
        type="button"
        onClick={() => onChange('publ')}
        className={cn(
          'rounded px-3 py-1 transition-colors',
          value === 'publ'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        Public
      </button>
      <button
        type="button"
        onClick={() => onChange('priv')}
        className={cn(
          'rounded px-3 py-1 transition-colors',
          value === 'priv'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        Private
      </button>
    </div>
  )
}
