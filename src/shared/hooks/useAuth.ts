/**
 * Auth hook for Supabase mode.
 *
 * Returns the current session, user, and current tenant context. In
 * localStorage mode (no Supabase configured), returns a synthetic session so
 * the rest of the app behaves as if logged in (single-user MVP).
 */
import { useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, HAS_SUPABASE } from '@/integrations/supabase'

export interface AuthContext {
  /** True when the app has a valid session (real or synthetic) */
  authenticated: boolean
  /** Current user id (real Supabase user id or synthetic in localStorage mode) */
  userId: string
  /** Display label for the current user (email in Supabase mode, "Local" in localStorage) */
  userLabel: string
  /** Current tenant context — only meaningful in Supabase mode */
  tenantId: string | null
  /** Sign out (no-op in localStorage mode) */
  signOut: () => Promise<void>
}

const LOCAL_USER_ID = 'local-user'
const LOCAL_USER_LABEL = 'Usuario local'

export function useAuth(): AuthContext {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(HAS_SUPABASE)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => {
      sub.subscription.unsubscribe()
    }
  }, [])

  if (!HAS_SUPABASE) {
    return {
      authenticated: true,
      userId: LOCAL_USER_ID,
      userLabel: LOCAL_USER_LABEL,
      tenantId: null,
      signOut: async () => {},
    }
  }

  if (loading) {
    return {
      authenticated: false,
      userId: '',
      userLabel: '',
      tenantId: null,
      signOut: async () => {},
    }
  }

  const user: User | null = session?.user ?? null
  return {
    authenticated: user !== null,
    userId: user?.id ?? '',
    userLabel: user?.email ?? '',
    tenantId: null, // populated by tenantStore after login
    signOut: async () => {
      if (supabase) await supabase.auth.signOut()
    },
  }
}