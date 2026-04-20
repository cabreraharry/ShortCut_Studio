import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  FolderTree,
  Tags,
  Bot,
  Globe,
  ShieldCheck,
  Settings
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/folders', label: 'Folders', icon: FolderTree },
  { to: '/topics', label: 'Topics', icon: Tags },
  { to: '/llm', label: 'LLMs', icon: Bot },
  { to: '/community', label: 'Community', icon: Globe },
  { to: '/privacy', label: 'Privacy', icon: ShieldCheck },
  { to: '/settings', label: 'Settings', icon: Settings }
] as const

export function Sidebar() {
  return (
    <aside className="w-56 shrink-0 border-r border-border bg-card/50">
      <nav className="flex flex-col gap-0.5 p-2">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
