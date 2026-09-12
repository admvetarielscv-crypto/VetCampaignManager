/**
 * Current tenant + branch context. Only meaningful in Supabase mode — in
 * localStorage mode, the app is single-tenant/single-sede and this store
 * holds a synthetic "default" tenant.
 *
 * Branch rule (migration 0003): the current user's `tenant_members.branch_id`
 * is NULL for owner/admin (they see ALL branches of the tenant, and the first
 * branch is selected by default) or a concrete branch id for branch-bound
 * members (receptionists).
 */
import { create } from 'zustand'
import { HAS_SUPABASE, requireSupabase } from '@/integrations/supabase'

export interface Branch {
  id: number
  name: string
}

export interface Tenant {
  id: string
  slug: string
  name: string
  defaultCountryCode: string
  role: 'owner' | 'admin' | 'recepcionista'
  /** Branch the member is bound to. NULL = owner/admin (all branches). */
  branchId: number | null
}

interface TenantState {
  tenants: Tenant[]
  currentTenantId: string | null
  /** Branches of the CURRENT tenant (Supabase mode only). */
  branches: Branch[]
  /** Sede the app is operating on right now (Supabase mode only). */
  currentBranchId: number | null
  hydrated: boolean

  hydrate: () => Promise<void>
  /** Re-fetch branches of the current tenant and re-resolve the context. */
  loadBranches: () => Promise<void>
  setCurrent: (tenantId: string) => void
  setCurrentBranch: (branchId: number) => void
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
  branchId: null,
}

/** Initial state, re-used by `reset` and by the store constructor. */
function initialState() {
  return {
    tenants: HAS_SUPABASE ? ([] as Tenant[]) : [LOCAL_TENANT],
    currentTenantId: HAS_SUPABASE ? null : LOCAL_TENANT_ID,
    branches: [] as Branch[],
    currentBranchId: null as number | null,
    hydrated: !HAS_SUPABASE,
  }
}

export const useTenantStore = create<TenantState>((set, get) => ({
  ...initialState(),

  hydrate: async () => {
    if (!HAS_SUPABASE) {
      set({ hydrated: true })
      return
    }
    const sb = requireSupabase()
    const { data, error } = await sb
      .from('tenant_members')
      .select(
        'role, branch_id, tenant:tenants(id, slug, name, default_country_code)',
      )
    if (error) {
      console.error('Failed to hydrate tenants', error)
      set({ hydrated: true })
      return
    }
    const tenants: Tenant[] = (data ?? []).flatMap(
      (row: {
        role: Tenant['role']
        branch_id: number | null
        tenant: {
          id: string
          slug: string
          name: string
          default_country_code: string
        }[] | null
      }) => {
        const list = row.tenant ?? []
        return list.map((t) => ({
          id: t.id,
          slug: t.slug,
          name: t.name,
          defaultCountryCode: t.default_country_code,
          role: row.role,
          branchId: row.branch_id,
        }))
      },
    )
    const currentTenantId = tenants[0]?.id ?? null
    set({ tenants, currentTenantId, hydrated: true })

    // Branches of the current tenant + resolved branch context.
    await get().loadBranches()
  },

  loadBranches: async () => {
    if (!HAS_SUPABASE) return
    const currentTenantId = get().currentTenantId
    if (!currentTenantId) return
    const sb = requireSupabase()
    const { data, error } = await sb
      .from('branches')
      .select('id, name')
      .eq('tenant_id', Number(currentTenantId))
      .order('name')
    if (error) {
      console.error('Failed to hydrate branches', error)
      return
    }
    const branches: Branch[] = data ?? []
    const bound = get().tenants.find((t) => t.id === currentTenantId)?.branchId
    // Branch-bound members land in their sede; owners/admins (branchId null)
    // keep their current selection when still valid, else default to the
    // first branch. They may switch from the top bar.
    const prev = get().currentBranchId
    const currentBranchId =
      bound ??
      (prev !== null && branches.some((b) => b.id === prev)
        ? prev
        : (branches[0]?.id ?? null))
    set({ branches, currentBranchId })
  },

  setCurrent: (tenantId) => {
    set({ currentTenantId: tenantId })
    void get().loadBranches()
  },

  setCurrentBranch: (branchId) => set({ currentBranchId: branchId }),

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
      branchId: null,
    }
    set((s) => ({
      tenants: [...s.tenants, tenant],
      currentTenantId: tenant.id,
    }))
    await get().loadBranches()
    return tenant
  },

  reset: () => set({ ...initialState() }),
}))
