import { Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { RouteErrorBoundary } from './components/layout/RouteErrorBoundary'
import { Toaster } from './components/ui/toaster'
import { TooltipProvider } from './components/ui/tooltip'
import DashboardPage from './features/dashboard/DashboardPage'
import FoldersPage from './features/folders/FoldersPage'
import TopicsPage from './features/topics/TopicsPage'
import InsightsPage from './features/insights/InsightsPage'
import FilterWorkbenchPage from './features/filters/FilterWorkbenchPage'
import KnowledgeMapPage from './features/knowledge-map/KnowledgeMapPage'
import LlmPage from './features/llm/LlmPage'
import CommunityPage from './features/community/CommunityPage'
import PrivacyPage from './features/privacy/PrivacyPage'
import SettingsPage from './features/settings/SettingsPage'
import AboutPage from './features/about/AboutPage'
import GettingStartedPage from './features/getting-started/GettingStartedPage'
import SetupWizard from './features/setup/SetupWizard'
import { FirstRunGuard } from './features/setup/FirstRunGuard'
import { WelcomeOnLaunchDialog } from './features/welcome/WelcomeOnLaunchDialog'

export default function App() {
  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={100}>
      <AppShell>
        <FirstRunGuard>
        <RouteErrorBoundary>
        <Routes>
          <Route path="/setup" element={<SetupWizard />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/folders" element={<FoldersPage />} />
          <Route path="/topics" element={<TopicsPage />} />
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="/filters" element={<FilterWorkbenchPage />} />
          <Route path="/topic-map" element={<KnowledgeMapPage />} />
          <Route path="/llm" element={<LlmPage />} />
          <Route path="/community" element={<CommunityPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/getting-started" element={<GettingStartedPage />} />
        </Routes>
        </RouteErrorBoundary>
        </FirstRunGuard>
        <WelcomeOnLaunchDialog />
        <Toaster />
      </AppShell>
    </TooltipProvider>
  )
}
