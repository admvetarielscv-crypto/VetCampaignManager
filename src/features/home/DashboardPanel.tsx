/**
 * Dashboard panel: aggregates the campaign history (localStorage or Supabase
 * via the storage seam) into month + branch views. Data math lives in
 * `lib/stats.ts`; this component only loads records and renders.
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart3,
  Building2,
  CheckCircle2,
  CopyX,
  Send,
  UserRoundX,
  Users,
} from 'lucide-react'
import {
  Card,
  EmptyState,
  Segmented,
  Stat,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '@/shared/components/ui'
import { Button, Spinner } from '@/shared/components/ui'
import { listCampaigns } from '@/storage/exports'
import type { CampaignRecord } from '@/lib/types'
import { groupByBranch, groupByMonth } from '@/lib/stats'

function fmtMonthMessages(n: number): string {
  return n.toLocaleString('es-PE')
}

export function DashboardPanel() {
  const navigate = useNavigate()
  const [records, setRecords] = useState<CampaignRecord[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [monthsView, setMonthsView] = useState('2')

  useEffect(() => {
    listCampaigns(400)
      .then(setRecords)
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Error al cargar el panel.')
      })
  }, [])

  const buckets = useMemo(
    () => groupByMonth(records ?? [], Number(monthsView)),
    [records, monthsView],
  )
  const branches = useMemo(() => groupByBranch(records ?? []), [records])
  const current = buckets[buckets.length - 1]
  const maxMessages = Math.max(1, ...buckets.map((b) => b.totals.messages))

  if (records === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-ink-soft">
        <Spinner />
        Cargando resumen…
      </div>
    )
  }

  if (error) {
    return (
      <Card className="p-4 border-danger/30 bg-danger-soft/30 text-danger text-sm">
        No se pudo cargar el resumen. Revisa tu conexión e intenta de nuevo.
        <span className="block mt-1 text-xs opacity-70">{error}</span>
      </Card>
    )
  }

  if (current && current.totals.campaigns === 0 && buckets.every((b) => b.totals.campaigns === 0)) {
    return (
      <EmptyState
        icon={<BarChart3 size={24} />}
        title="Aún no hay campañas registradas"
        description="Cuando envíes tu primera campaña, aquí verás cuántos mensajes salieron, cuántos contactos se excluyeron y cómo va mes a mes."
        action={
          <Button variant="primary" size="md" onClick={() => navigate('/campaign')}>
            Nueva campaña
          </Button>
        }
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-md font-semibold text-ink flex items-center gap-2">
          <BarChart3 size={16} className="text-vegetal" />
          Resumen de campañas
        </h2>
        <Segmented
          value={monthsView}
          onChange={setMonthsView}
          options={[
            { id: '2', label: 'Últimos 2 meses' },
            { id: '6', label: 'Últimos 6 meses' },
          ]}
        />
      </div>

      {/* Current month at a glance */}
      {current && (
        <Card className="p-5">
          <p className="text-sm text-ink-soft mb-3">
            Este mes <span className="text-ink-mute">({current.label})</span>
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <Stat
              size="sm"
              icon={<Send size={14} />}
              label="Campañas"
              value={current.totals.campaigns}
              tone="vegetal"
              mono
            />
            <Stat
              size="sm"
              icon={<Users size={14} />}
              label="Mensajes"
              value={fmtMonthMessages(current.totals.messages)}
              tone="vegetal"
              mono
            />
            <Stat
              size="sm"
              icon={<UserRoundX size={14} />}
              label="Inválidos"
              value={fmtMonthMessages(current.totals.invalid)}
              tone="neutral"
              mono
            />
            <Stat
              size="sm"
              icon={<CopyX size={14} />}
              label="Duplicados"
              value={fmtMonthMessages(current.totals.duplicate)}
              tone="neutral"
              mono
            />
            <Stat
              size="sm"
              icon={<CheckCircle2 size={14} />}
              label="Excluidos"
              value={fmtMonthMessages(current.totals.excluded)}
              tone="neutral"
              mono
            />
          </div>
        </Card>
      )}

      {/* Month-by-month bars */}
      <Card className="p-5">
        <p className="text-sm text-ink-soft mb-4">Mensajes enviados por mes</p>
        <div className="space-y-3">
          {buckets.map((b) => (
            <div key={b.key} className="flex items-center gap-3">
              <span className="text-xs text-ink-soft w-20 shrink-0">{b.label}</span>
              <div className="flex-1 h-5 rounded-sm bg-mist-soft/60 overflow-hidden">
                <div
                  className="h-full rounded-sm bg-vegetal/80"
                  style={{
                    width: `${(b.totals.messages / maxMessages) * 100}%`,
                  }}
                />
              </div>
              <span className="text-xs font-mono tnum text-ink w-24 text-right shrink-0">
                {fmtMonthMessages(b.totals.messages)} msj
              </span>
              <span className="text-2xs text-ink-mute w-16 text-right shrink-0 tnum">
                {b.totals.campaigns} camp.
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Branch breakdown (single row today, ready for multi-sede) */}
      {branches.length > 0 && (
        <Card className="overflow-hidden">
          <p className="text-sm text-ink-soft p-5 pb-3 flex items-center gap-2">
            <Building2 size={14} className="text-vegetal" />
            Por sede
          </p>
          <Table>
            <Thead className="bg-mist-soft/40">
              <tr>
                <Th>Sede</Th>
                <Th className="text-right">Campañas</Th>
                <Th className="text-right">Mensajes</Th>
                <Th className="text-right">Excluidos</Th>
              </tr>
            </Thead>
            <Tbody>
              {branches.map((b) => (
                <Tr key={b.branch}>
                  <Td className="text-ink">{b.branch}</Td>
                  <Td className="text-right font-mono tnum text-ink-soft">
                    {b.totals.campaigns}
                  </Td>
                  <Td className="text-right font-mono tnum text-ink">
                    {fmtMonthMessages(b.totals.messages)}
                  </Td>
                  <Td className="text-right font-mono tnum text-ink-soft">
                    {b.totals.excluded}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Card>
      )}
    </div>
  )
}
