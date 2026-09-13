import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from '@/shared/components/layout/AppShell'
import { Spinner } from '@/shared/components/ui/Spinner'
import { Login } from '@/features/auth/Login'
import { useAuth } from '@/shared/hooks/useAuth'
import { HAS_SUPABASE } from '@/integrations/supabase'

const HomePage = lazy(() => import('@/features/home/Home'))
const ExcelImportPage = lazy(() =>
  import('@/features/excel-import/ExcelImport').then((m) => ({
    default: m.ExcelImport,
  })),
)
const CampaignPreviewPage = lazy(() =>
  import('@/features/campaign-preview/CampaignPreview').then((m) => ({
    default: m.CampaignPreview,
  })),
)
const SendCampaignPage = lazy(() =>
  import('@/features/send-campaign/SendCampaign').then((m) => ({
    default: m.SendCampaign,
  })),
)
const SettingsPage = lazy(() =>
  import('@/features/settings/Settings').then((m) => ({ default: m.Settings })),
)
const HistoryPage = lazy(() =>
  import('@/features/history/History').then((m) => ({ default: m.History })),
)

function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const location = useLocation()
  if (!HAS_SUPABASE) {
    return <>{children}</>
  }
  // Session check in flight: WAIT. Redirecting here (instead of waiting)
  // unmounts this guard on every bounce, so each remount restarts the check
  // and the app ping-pongs between "/" and "/login" forever.
  if (auth.loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    )
  }
  if (!auth.authenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  return <>{children}</>
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="campaign" element={<ExcelImportPage />} />
        <Route path="campaign/preview" element={<CampaignPreviewPage />} />
        <Route path="campaign/send" element={<SendCampaignPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export function AppRouter() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <Spinner />
        </div>
      }
    >
      <AppRoutes />
    </Suspense>
  )
}