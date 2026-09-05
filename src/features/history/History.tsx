import { useEffect, useState } from 'react'
import { History as HistoryIcon, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { Card, Table, Tbody, Td, Th, Thead, Tr } from '@/shared/components/ui'
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
            El historial guardará cada campaña que envíes: a quién, cuándo y
            cuántos mensajes salieron.
          </p>
          <p className="text-xs text-ink-mute mt-2">
            Pídele al técnico de la clínica que conecte la app con la cuenta
            central para activarlo.
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
        No se pudo cargar el historial. Revisa tu conexión e intenta de nuevo.
        <span className="block mt-1 text-xs opacity-70">{error}</span>
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
    <div className="space-y-4 animate-rise">
      <div className="flex items-center gap-2">
        <HistoryIcon className="text-ink-soft" size={18} />
        <h2 className="text-md font-semibold text-ink">Historial de campañas</h2>
      </div>
      <Card className="overflow-hidden">
        <Table>
          <Thead className="bg-mist-soft/40">
            <tr>
              <Th>Fecha</Th>
              <Th>Estado</Th>
              <Th className="text-right">Enviados</Th>
              <Th className="text-right">Inválidos</Th>
              <Th className="text-right">Duplicados</Th>
            </tr>
          </Thead>
          <Tbody>
            {records.map((r) => (
              <Tr key={r.id}>
                <Td className="text-ink-soft">{fmtDate(r.createdAt)}</Td>
                <Td>
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
                </Td>
                <Td className="text-right font-mono tnum text-ink">{r.enabledRecipients}</Td>
                <Td className="text-right font-mono tnum text-ink-soft">{r.invalidRecipients}</Td>
                <Td className="text-right font-mono tnum text-ink-soft">{r.duplicateRecipients}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Card>
    </div>
  )
}