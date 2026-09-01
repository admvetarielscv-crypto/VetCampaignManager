/**
 * Current tenant context. Only meaningful in Supabase mode — in localStorage
 * mode, the app is single-tenant and this store holds a synthetic "default"
 * tenant that all localStorage reads/writes scope to.
 */
import { create } from 'zustand'
import { HAS_SUPABASE, requireSupabase } from '@/integrations/supabase'

export interface Tenant {
  id: string
  slug: string
  name: string
  defaultCountryCode: string
  role: 'owner' | 'admin' | 'recepcionista'
}

interface TenantState {
  tenants: Tenant[]
  currentTenantId: string | null
  hydrated: boolean

  hydrate: () => Promise<void>
  setCurrent: (tenantId: string) => void
  createTenant: (name: string, slug: string) => Promise<Tenant>
  reset: () => void
}

const LOCAL_TENANT_ID = 'local-tenant'
const LOCAL_TENANT: Tenant = {
  id: LOCAL_TENANT_ID,
  slug: 'local',
  name: 'Clínica local',
  defaultCountryCode: '+51',
  role: 'owner',
}

export const useTenantStore = create<TenantState>((set) => ({
  tenants: HAS_SUPABASE ? [] : [LOCAL_TENANT],
  currentTenantId: HAS_SUPABASE ? null : LOCAL_TENANT_ID,
  hydrated: !HAS_SUPABASE,

  hydrate: async () => {
    if (!HAS_SUPABASE) {
      set({ hydrated: true })
      return
    }
    const sb = requireSupabase()
    const { data, error } = await sb
      .from('tenant_members')
      .select('role, tenant:tenants(id, slug, name, default_country_code)')
    if (error) {
      console.error('Failed to hydrate tenants', error)
      set({ hydrated: true })
      return
    }
    const tenants: Tenant[] = (data ?? []).flatMap((row: {
      role: Tenant['role']
      tenant: { id: string; slug: string; name: string; default_country_code: string }[] | null
    }) => {
      const list = row.tenant ?? []
      return list.map((t) => ({
        id: t.id,
        slug: t.slug,
        name: t.name,
        defaultCountryCode: t.default_country_code,
        role: row.role,
      }))
    })
    set({
      tenants,
      currentTenantId: tenants[0]?.id ?? null,
      hydrated: true,
    })
  },

  setCurrent: (tenantId) => set({ currentTenantId: tenantId }),

  createTenant: async (name, slug) => {
    const sb = requireSupabase()
    const { data, error } = await sb
      .from('tenants')
      .insert({ name, slug })
      .select('id, slug, name, default_country_code')
      .single()
    if (error) throw error
    const tenant: Tenant = {
      id: data.id,
      slug: data.slug,
      name: data.name,
      defaultCountryCode: data.default_country_code,
      role: 'owner',
    }
    set((s) => ({
      tenants: [...s.tenants, tenant],
      currentTenantId: tenant.id,
    }))
    return tenant
  },

  reset: () =>
    set({
      tenants: HAS_SUPABASE ? [] : [LOCAL_TENANT],
      currentTenantId: HAS_SUPABASE ? null : LOCAL_TENANT_ID,
      hydrated: !HAS_SUPABASE,
    }),
}))