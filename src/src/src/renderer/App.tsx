import { Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
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

export default function App() {
  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={100}>
      <AppShell>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/folders" element={<FoldersPage />} />
          <Route path="/topics" element={<TopicsPage />} />
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="/filters" element={<FilterWorkbenchPage />} />
          <Route path="/knowledge-map" element={<KnowledgeMapPage />} />
          <Route path="/llm" element={<LlmPage />} />
          <Route path="/community" element={<CommunityPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
        <Toaster />
      </AppShell>
    </TooltipProvider>
  )
}
