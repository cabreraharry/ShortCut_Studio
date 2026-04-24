import { NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard,
  FolderTree,
  Tags,
  FileSearch,
  SlidersHorizontal,
  Network,
  Bot,
  Globe,
  ShieldCheck,
  Settings,
  Info,
  Rocket
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { Tip } from '@/components/ui/cursor-tooltip'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  tip: string
}

const SECTIONS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'Library',
    items: [
      {
        to: '/dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        tip: 'See processing progress at a glance — local vs. peer contributions'
      },
      {
        to: '/folders',
        label: 'Folders',
        icon: FolderTree,
        tip: 'Pick which folders to scan for eBooks and research papers'
      },
      {
        to: '/topics',
        label: 'Topics',
        icon: Tags,
        tip: 'Review AI-generated topic classifications and group them into super-categories'
      },
      {
        to: '/insights',
        label: 'Insights',
        icon: FileSearch,
        tip: 'Extraction quality per file — spot low-confidence documents'
      },
      {
        to: '/knowledge-map',
        label: 'Knowledge Map',
        icon: Network,
        tip: 'See how your library is organized: super-categories → topics → sample files'
      }
    ]
  },
  {
    label: 'Integrations',
    items: [
      {
        to: '/community',
        label: 'Community',
        icon: Globe,
        tip: 'Manage IPFS allocation for peer-shared processing'
      },
      {
        to: '/filters',
        label: 'Filters',
        icon: SlidersHorizontal,
        tip: 'Compose filter rules to isolate publications from noise'
      },
      {
        to: '/privacy',
        label: 'Privacy',
        icon: ShieldCheck,
        tip: 'Maintain private terms that route matching files to the Private library'
      }
    ]
  },
  {
    label: 'Configuration',
    items: [
      {
        to: '/llm',
        label: 'LLMs',
        icon: Bot,
        tip: 'Configure LLM providers and API keys (Ollama, OpenAI, Claude, Gemini)'
      },
      {
        to: '/settings',
        label: 'Settings',
        icon: Settings,
        tip: 'Paths, admin values, and worker diagnostics'
      }
    ]
  },
  {
    label: 'Help',
    items: [
      {
        to: '/getting-started',
        label: 'Getting started',
        icon: Rocket,
        tip: 'A short guide to your first 10 minutes with ShortCut Studio'
      },
      {
        to: '/about',
        label: 'About',
        icon: Info,
        tip: 'What ShortCut Studio is, how it works, and who it’s for'
      }
    ]
  }
]

export function Sidebar() {
  const { data: topicReview = [] } = useQuery({
    queryKey: ['topicReview'],
    queryFn: () => api.topics.review(),
    refetchInterval: 10_000
  })
  const { data: workers = [] } = useQuery({
    queryKey: ['diagnostics-workers'],
    queryFn: () => api.diagnostics.workers(),
    refetchInterval: 10_000
  })

  const topicBadge = topicReview.length > 0 ? topicReview.length.toString() : null
  const workersNeedAttention = workers.some((w) => w.status !== 'running')
  const settingsBadge = workersNeedAttention ? '!' : null

  const badgeFor = (to: string): string | null => {
    if (to === '/topics') return topicBadge
    if (to === '/settings') return settingsBadge
    return null
  }

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-card/50">
      <nav className="flex flex-col gap-3 overflow-y-auto p-2 pt-3">
        {SECTIONS.map((section) => (
          <div key={section.label} className="flex flex-col gap-0.5">
            <div className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {section.label}
            </div>
            {section.items.map(({ to, label, icon: Icon, tip }) => {
              const badge = badgeFor(to)
              return (
                <Tip key={to} content={tip}>
                  <NavLink
                    to={to}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-accent text-accent-foreground'
                          : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          aria-hidden
                          className={cn(
                            'absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r bg-gradient-to-b from-glass-local to-glass-peer transition-opacity',
                            isActive ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        <Icon className={cn('h-4 w-4', isActive && 'text-primary')} />
                        <span className="flex-1">{label}</span>
                        {badge && (
                          <span
                            className={cn(
                              'ml-auto inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold',
                              badge === '!'
                                ? 'bg-amber-500/25 text-amber-800 dark:text-amber-400'
                                : 'bg-primary/20 text-primary'
                            )}
                          >
                            {badge}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                </Tip>
              )
            })}
          </div>
        ))}
      </nav>
      <div className="mt-auto border-t border-border/60 p-3 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          All systems nominal
        </div>
      </div>
    </aside>
  )
}

