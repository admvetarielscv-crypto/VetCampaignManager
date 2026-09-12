import { type ReactNode } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import { useHydrateSettings } from '@/shared/hooks/useHydrateSettings'
import { useAuth } from '@/shared/hooks/useAuth'
import { useTenantStore } from '@/shared/stores/tenantStore'
import { HAS_SUPABASE } from '@/integrations/supabase'
import { Spinner } from '@/shared/components/ui'

export function AppProviders({ children }: { children: ReactNode }) {
  const settingsHydrated = useHydrateSettings()

  const auth = useAuth()
  const tenantStore = useTenantStore()

  if (HAS_SUPABASE && !tenantStore.hydrated && auth.authenticated) {
    void tenantStore.hydrate()
  }

  // Two distinct waits, kept separate on purpose:
  //  - waitingForAuth: the Supabase session check is still in flight.
  //  - waitingForSettings: settings need to hydrate, but they can only hydrate
  //    once the user is authenticated (Supabase) or immediately in
  //    localStorage mode. Pre-login, settings WILL stay false; treating that
  //    as a loading state would block /login forever (the original bug).
  const waitingForAuth = HAS_SUPABASE && auth.loading
  const waitingForSettings =
    !settingsHydrated && (!HAS_SUPABASE || auth.authenticated)
  const loading = waitingForAuth || waitingForSettings

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3">
        <Spinner className="h-6 w-6" />
        <p className="text-xs text-ink-mute">Cargando…</p>
      </div>
    )
  }

  return (
    <BrowserRouter>
      {children}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            borderRadius: 'var(--radius-md)',
            fontFamily: 'var(--font-sans)',
            border: '1px solid var(--color-mist)',
            background: 'var(--color-paper)',
            color: 'var(--color-ink)',
          },
        }}
      />
    </BrowserRouter>
  )
}