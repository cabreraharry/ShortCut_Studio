import { Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import DashboardPage from './features/dashboard/DashboardPage'
import FoldersPage from './features/folders/FoldersPage'
import TopicsPage from './features/topics/TopicsPage'
import LlmPage from './features/llm/LlmPage'
import CommunityPage from './features/community/CommunityPage'
import PrivacyPage from './features/privacy/PrivacyPage'
import SettingsPage from './features/settings/SettingsPage'

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/folders" element={<FoldersPage />} />
        <Route path="/topics" element={<TopicsPage />} />
        <Route path="/llm" element={<LlmPage />} />
        <Route path="/community" element={<CommunityPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </AppShell>
  )
}
