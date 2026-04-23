import { useEffect, type ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { InfoSection } from './InfoSection'
import { DevOverlay } from '@/components/dev/DevOverlay'
import { api } from '@/lib/api'
import { useDevModeStore } from '@/stores/devMode'

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const toggleOverlay = useDevModeStore((s) => s.toggleOverlay)

  useEffect(() => {
    const off = api.dev.onToggle(() => toggleOverlay())
    return off
  }, [toggleOverlay])

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <Header />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="p-6">{children}</div>
        </main>
      </div>
      <InfoSection />
      <DevOverlay />
    </div>
  )
}
