import { useEffect, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
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
  const location = useLocation()
  const isSetupRoute = location.pathname === '/setup'

  useEffect(() => {
    const off = api.dev.onToggle(() => toggleOverlay())
    return off
  }, [toggleOverlay])

  // The setup wizard is a full-screen takeover with no sidebar / header / info
  // section, so it can focus the user on one task without distraction.
  if (isSetupRoute) {
    return (
      <div className="flex h-full flex-col bg-background text-foreground">
        {children}
        <DevOverlay />
      </div>
    )
  }

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
