import { Navigate, Route, Routes } from 'react-router-dom'
import { useEffect } from 'react'
import { useAppContext } from './context/AppContext'
import { AppShell } from './layout/AppShell'
import { BillingPage } from './pages/BillingPage'
import { CampaignManagementPage } from './pages/CampaignManagementPage'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { ReportsPage } from './pages/ReportsPage'
import { SettingsPage } from './pages/SettingsPage'
import { UserManagementPage } from './pages/UserManagementPage'
import { AdAccountsPage } from './pages/AdAccountsPage'
import { BillsPage } from './pages/BillsPage'
import { TasksPage } from './pages/TasksPage'
import { CampaignTypesPage } from './pages/CampaignTypesPage'
import { RegisterPage } from './pages/RegisterPage'
import { MetaIntegrationsPage } from './pages/MetaIntegrationsPage'
import { MetaOAuthCallbackPage } from './pages/MetaOAuthCallbackPage'
import { AccountantWorkspacePage } from './pages/AccountantWorkspacePage'
import { TopUpMethodsPage } from './pages/TopUpMethodsPage'
import { AdminOperationsPage } from './pages/AdminOperationsPage'
import { CampaignTrackingPage } from './pages/CampaignTrackingPage'
import { DailyReportPage } from './pages/DailyReportPage'
import { AccountRequestsPage } from './pages/AccountRequestsPage'
import { RequireRole } from './components/RequireRole'
import { t } from './i18n'

function ProtectedLayout() {
  const { authReady, isAuthenticated, language } = useAppContext()
  if (!authReady) {
    return (
      <div className="login-page" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <p className="muted">{t(language, 'login.loading')}</p>
      </div>
    )
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return <AppShell />
}

function App() {
  const { theme } = useAppContext()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.setAttribute('lang', 'ar')
    document.documentElement.setAttribute('dir', 'rtl')
  }, [theme])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route
          path="/operations-pulse"
          element={
            <RequireRole allow={['super_admin']}>
              <AdminOperationsPage />
            </RequireRole>
          }
        />
        <Route
          path="/users"
          element={
            <RequireRole allow={['super_admin', 'admin']}>
              <UserManagementPage />
            </RequireRole>
          }
        />
        <Route
          path="/account-requests"
          element={
            <RequireRole allow={['super_admin', 'admin']}>
              <AccountRequestsPage />
            </RequireRole>
          }
        />
        <Route
          path="/campaigns"
          element={
            <RequireRole allow={['super_admin', 'employee', 'customer']}>
              <CampaignManagementPage />
            </RequireRole>
          }
        />
        <Route
          path="/campaign-tracking"
          element={
            <RequireRole allow={['super_admin', 'employee']}>
              <CampaignTrackingPage />
            </RequireRole>
          }
        />
        <Route
          path="/billing"
          element={
            <RequireRole allow={['super_admin', 'accountant', 'customer']}>
              <BillingPage />
            </RequireRole>
          }
        />
        <Route
          path="/ad-accounts"
          element={
            <RequireRole allow={['super_admin', 'employee', 'customer']}>
              <AdAccountsPage />
            </RequireRole>
          }
        />
        <Route path="/integrations/meta-callback" element={<MetaOAuthCallbackPage />} />
        <Route
          path="/integrations"
          element={
            <RequireRole allow={['super_admin', 'customer']}>
              <MetaIntegrationsPage />
            </RequireRole>
          }
        />
        <Route
          path="/workspace"
          element={
            <RequireRole allow={['super_admin', 'accountant']} orEmployeeTypes={['accounting']}>
              <AccountantWorkspacePage />
            </RequireRole>
          }
        />
        <Route
          path="/top-up-methods"
          element={
            <RequireRole allow={['super_admin', 'accountant']} orEmployeeTypes={['accounting']}>
              <TopUpMethodsPage />
            </RequireRole>
          }
        />
        <Route
          path="/bills"
          element={
            <RequireRole allow={['super_admin', 'accountant', 'customer']} orEmployeeTypes={['accounting']}>
              <BillsPage />
            </RequireRole>
          }
        />
        <Route path="/tasks" element={<TasksPage />} />
        <Route
          path="/campaign-types"
          element={
            <RequireRole allow={['super_admin']}>
              <CampaignTypesPage />
            </RequireRole>
          }
        />
        <Route
          path="/daily-report"
          element={
            <RequireRole allow={['super_admin']}>
              <DailyReportPage />
            </RequireRole>
          }
        />
        <Route
          path="/reports"
          element={
            <RequireRole allow={['super_admin']}>
              <ReportsPage />
            </RequireRole>
          }
        />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
