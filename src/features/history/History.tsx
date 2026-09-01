import { useEffect, useState } from 'react'
import { History as HistoryIcon, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { Card } from '@/shared/components/ui'
import { listCampaigns, type CampaignRecord } from '@/storage/exports'
import { HAS_SUPABASE } from '@/integrations/supabase'

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-PE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function History() {
  const [records, setRecords] = useState<CampaignRecord[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!HAS_SUPABASE) {
      setRecords([])
      return
    }
    listCampaigns(50)
      .then(setRecords)
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Error al cargar el historial.')
      })
  }, [])

  if (!HAS_SUPABASE) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <HistoryIcon className="text-ink-soft" size={18} />
          <h2 className="text-md font-semibold text-ink">Historial de campañas</h2>
        </div>
        <Card className="p-6 text-center">
          <p className="text-sm text-ink-soft">
            El historial de campañas se guarda cuando Supabase está configurado.
          </p>
          <p className="text-xs text-ink-mute mt-2">
            Define <code className="text-2xs">VITE_SUPABASE_URL</code> y{' '}
            <code className="text-2xs">VITE_SUPABASE_ANON_KEY</code> en tu{' '}
            <code className="text-2xs">.env</code> para habilitar esta vista.
          </p>
        </Card>
      </div>
    )
  }

  if (records === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-ink-soft">
        <Loader2 className="animate-spin" size={14} />
        Cargando historial…
      </div>
    )
  }

  if (error) {
    return (
      <Card className="p-4 border-danger/30 bg-danger-soft/30 text-danger text-sm">
        {error}
      </Card>
    )
  }

  if (records.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <HistoryIcon className="text-ink-soft" size={18} />
          <h2 className="text-md font-semibold text-ink">Historial de campañas</h2>
        </div>
        <Card className="p-6 text-center">
          <p className="text-sm text-ink-soft">
            Aún no has enviado ninguna campaña. Cuando envíes una, aparecerá aquí con el detalle de destinatarios y resultado.
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <HistoryIcon className="text-ink-soft" size={18} />
        <h2 className="text-md font-semibold text-ink">Historial de campañas</h2>
      </div>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-mist-soft/40">
            <tr>
              <th className="text-left text-2xs font-semibold uppercase tracking-wide text-ink-mute px-3 py-2">
                Fecha
              </th>
              <th className="text-left text-2xs font-semibold uppercase tracking-wide text-ink-mute px-3 py-2">
                Estado
              </th>
              <th className="text-right text-2xs font-semibold uppercase tracking-wide text-ink-mute px-3 py-2">
                Enviados
              </th>
              <th className="text-right text-2xs font-semibold uppercase tracking-wide text-ink-mute px-3 py-2">
                Inválidos
              </th>
              <th className="text-right text-2xs font-semibold uppercase tracking-wide text-ink-mute px-3 py-2">
                Duplicados
              </th>
              <th className="text-left text-2xs font-semibold uppercase tracking-wide text-ink-mute px-3 py-2">
                ID
              </th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id} className="border-t border-mist">
                <td className="px-3 py-2 text-ink-soft">{fmtDate(r.createdAt)}</td>
                <td className="px-3 py-2">
                  {r.status === 'sent' ? (
                    <span className="inline-flex items-center gap-1 text-vegetal">
                      <CheckCircle2 size={12} />
                      <span className="text-xs">Enviado</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-danger" title={r.errorMessage ?? ''}>
                      <AlertCircle size={12} />
                      <span className="text-xs">Falló</span>
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-mono tnum text-ink">{r.enabledRecipients}</td>
                <td className="px-3 py-2 text-right font-mono tnum text-ink-soft">{r.invalidRecipients}</td>
                <td className="px-3 py-2 text-right font-mono tnum text-ink-soft">{r.duplicateRecipients}</td>
                <td className="px-3 py-2 font-mono text-2xs text-ink-mute">
                  {r.id.slice(0, 12)}…
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}