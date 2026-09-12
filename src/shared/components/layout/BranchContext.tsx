/**
 * Branch (sede) context for the top bar. Supabase mode only.
 *
 * - Branch-bound members (receptionists): a passive chip with their sede.
 * - Owner/admin (branch_id NULL): a selector when the tenant has more than
 *   one branch. Switching re-hydrates settings, since categories, templates
 *   and the webhook are branch-scoped.
 */
import { Building2 } from 'lucide-react'
import { Chip, Select } from '@/shared/components/ui'
import { useTenantStore } from '@/shared/stores/tenantStore'
import { useSettingsStore } from '@/shared/stores/settingsStore'
import { HAS_SUPABASE } from '@/integrations/supabase'

export function BranchContext() {
  const branches = useTenantStore((s) => s.branches)
  const currentBranchId = useTenantStore((s) => s.currentBranchId)
  const setCurrentBranch = useTenantStore((s) => s.setCurrentBranch)
  const memberBranchId = useTenantStore(
    (s) =>
      s.tenants.find((t) => t.id === s.currentTenantId)?.branchId ?? null,
  )
  const hydrateSettings = useSettingsStore((s) => s.hydrate)

  if (!HAS_SUPABASE || !currentBranchId || branches.length === 0) {
    return null
  }

  const current = branches.find((b) => b.id === currentBranchId)
  const canSwitch = memberBranchId === null && branches.length > 1

  return (
    <div className="flex items-center gap-2">
      {canSwitch ? (
        <Select
          value={String(currentBranchId)}
          onChange={(e) => {
            setCurrentBranch(Number(e.target.value))
            void hydrateSettings()
          }}
          className="h-7 w-auto text-xs py-0"
          aria-label="Sede activa"
          title="Estás viendo esta sede — cambia aquí para ver otra"
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
      ) : (
        <Chip tone="vegetal" title="Sede en la que estás trabajando">
          <Building2 size={11} />
          {current?.name}
        </Chip>
      )}
    </div>
  )
}
