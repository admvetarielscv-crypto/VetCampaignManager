import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Send,
  Tag,
  Users,
} from 'lucide-react'
import { Button, Card, Modal, Stat } from '@/shared/components/ui'
import { useCampaignStore } from '@/shared/stores/campaignStore'
import { useSettingsStore } from '@/shared/stores/settingsStore'
import { useAuth } from '@/shared/hooks/useAuth'
import {
  buildCampaignPayload,
  buildSendableRecipients,
  type N8nCampaignPayload,
} from '@/lib/campaign'
import { newId } from '@/lib/id'
import { maskUrl } from '@/lib/format'
import { sendCampaign } from '@/integrations/n8n'
import { recordCampaign, recordAudit } from '@/storage/exports'

type SendStatus = 'idle' | 'sending' | 'success' | 'error'

export function SendCampaign() {
  const navigate = useNavigate()
  const result = useCampaignStore((s) => s.result)
  const recipientEnabled = useCampaignStore((s) => s.recipientEnabled)
  const fileName = useCampaignStore((s) => s.rawFileName)
  const setPhase = useCampaignStore((s) => s.setPhase)
  const resetStore = useCampaignStore((s) => s.reset)

  const categories = useSettingsStore((s) => s.categories)
  const templates = useSettingsStore((s) => s.templates)
  const settings = useSettingsStore((s) => s.settings)
  const auth = useAuth()

  const [status, setStatus] = useState<SendStatus>('idle')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [payload, setPayload] = useState<N8nCampaignPayload | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)

  // Build the sendable list + payload up front (memoized).
  const sendable = useMemo(() => {
    if (!result) return []
    return buildSendableRecipients(
      result.recipients,
      categories,
      templates,
      recipientEnabled,
    )
  }, [result, categories, templates, recipientEnabled])

  // Build a preview payload (never sent if user cancels).
  const previewPayload = useMemo<N8nCampaignPayload | null>(() => {
    if (sendable.length === 0) return null
    return buildCampaignPayload(sendable, {
      campaignId: newId(),
      schema: 'vetcampaign/v1',
      source: 'VetCampaignManager',
    })
  }, [sendable])

  const categoryCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const { recipient } of sendable) {
      m.set(recipient.category, (m.get(recipient.category) ?? 0) + 1)
    }
    return [...m.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [sendable])

  const missingTemplates = useMemo(
    () => sendable.some(({ message }) => !message.template),
    [sendable],
  )

  // Guard: redirect back if no campaign or no sendable recipients.
  useEffect(() => {
    if (!result) {
      toast.info('Importa un archivo Excel primero.')
      navigate('/campaign', { replace: true })
      return
    }
    if (sendable.length === 0 && status !== 'success') {
      toast.error('No hay destinatarios habilitados. Vuelve a la revisión.')
      navigate('/campaign/preview', { replace: true })
    }
  }, [result, sendable.length, navigate, status])

  if (!result) return null

  const handleBack = () => {
    setPhase('preview')
    navigate('/campaign/preview')
  }

  const handleConfirm = async () => {
    if (!previewPayload || !result) return
    setConfirmOpen(false)
    setStatus('sending')
    setSendError(null)
    // Snapshot the payload that was actually dispatched.
    setPayload(previewPayload)
    const res = await sendCampaign(previewPayload, settings.webhookUrl)
    const totals = result.totals
    // Persist campaign + audit entry (no-ops in localStorage mode).
    void recordCampaign({
      id: previewPayload.campaign.id,
      sentBy: auth.userId,
      totalRecipients: totals.totalRows,
      enabledRecipients: sendable.length,
      invalidRecipients: totals.invalid,
      duplicateRecipients: totals.duplicate,
      payload: previewPayload,
      status: res.ok ? 'sent' : 'failed',
      errorMessage: res.ok ? null : (res.error ?? 'Error desconocido'),
    })
    void recordAudit({
      userId: auth.userId,
      action: 'campaign.send',
      entityType: 'campaign',
      entityId: previewPayload.campaign.id,
      metadata: {
        recipientCount: sendable.length,
        mock: res.mock,
        ok: res.ok,
        status: res.status,
      },
    })
    if (res.ok) {
      setStatus('success')
      if (res.mock) {
        toast.success('Campaña simulada (modo demo).', {
          description: res.detail,
        })
      } else {
        toast.success('Campaña enviada al servicio de mensajería.', {
          description: `Webhook respondió ${res.status}.`,
        })
      }
    } else {
      setStatus('error')
      setSendError(res.error ?? 'Error desconocido.')
      toast.error('No se pudo enviar la campaña.', {
        description: res.error,
      })
    }
  }

  const handleNewCampaign = () => {
    resetStore()
    navigate('/campaign')
  }

  // ── Success screen ──
  if (status === 'success') {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card className="p-8 text-center">
          <div className="mx-auto mb-3 rounded-md bg-vegetal-soft text-vegetal p-3 w-fit">
            <CheckCircle2 size={28} />
          </div>
          <h2 className="text-lg font-semibold text-ink">
            Campaña enviada
          </h2>
          <p className="text-sm text-ink-soft mt-1 max-w-md mx-auto">
            {payload?.recipients.length ?? 0} mensaje(s) fueron enviados al
            servicio de mensajería. Los destinatarios los recibirán a través de
            WhatsApp en los próximos minutos.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <Stat size="sm" label="Destinatarios" value={payload?.recipients.length ?? 0} />
            <Stat size="sm" label="Campaña ID" value={(payload?.campaign.id ?? '').slice(0, 8)} mono />
          </div>
          <div className="mt-6 flex items-center justify-center gap-2">
            <Button variant="secondary" size="md" onClick={() => navigate('/campaign/preview')}>
              <ArrowLeft size={14} />
              Volver a la revisión
            </Button>
            <Button variant="primary" size="md" onClick={handleNewCampaign}>
              Empezar nueva campaña
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  // ── Confirm / dispatch screen ──
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-4">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft size={14} />
          Volver a la revisión
        </Button>
        <span className="text-sm text-ink-soft truncate">
          <span className="font-medium text-ink">{fileName}</span>
        </span>
      </div>

      {/* Warning if any recipient has no resolved template */}
      {missingTemplates && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-warn/30 bg-warn-soft/40 p-3 text-sm text-warn">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            Algunos destinatarios no tienen plantilla asignada (ni específica
            ni Predeterminada) y serán omitidos. Crea una plantilla
            Predeterminada en Ajustes para cubrirlos.
          </span>
        </div>
      )}

      <Card className="p-5">
        <h2 className="text-md font-semibold text-ink flex items-center gap-2">
          <Send size={16} className="text-clay" />
          Confirmar envío
        </h2>
        <p className="text-sm text-ink-soft mt-1">
          Al confirmar, se hará un <strong>único POST</strong> al webhook de n8n
          con los mensajes ya renderizados. n8n los enviará por WhatsApp vía
          Evolution API.
        </p>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Stat
            size="sm"
            icon={<Users size={14} />}
            label="Destinatarios"
            value={sendable.length}
            tone="vegetal"
          />
          <Stat
            size="sm"
            icon={<Tag size={14} />}
            label="Categorías"
            value={categoryCounts.length}
            tone="neutral"
          />
          <Stat
            size="sm"
            label="Modo"
            value={settings.webhookUrl ? 'Real' : 'Demo'}
            tone={settings.webhookUrl ? 'vegetal' : 'warn'}
          />
        </div>

        {/* Category breakdown */}
        <div className="mt-5">
          <p className="text-sm font-medium text-ink mb-2">Desglose por categoría</p>
          {categoryCounts.length === 0 ? (
            <p className="text-sm text-ink-mute">Sin destinatarios.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {categoryCounts.map((c) => (
                <span
                  key={c.name}
                  className="inline-flex items-center gap-1.5 rounded-md bg-mist-soft border border-mist px-2.5 py-1 text-xs"
                >
                  <span className="font-medium text-ink">{c.name}</span>
                  <span className="text-ink-mute tnum">{c.count}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Webhook status */}
        <div className="mt-5 flex items-center gap-2 rounded-sm bg-mist-soft/40 border border-mist p-3 text-xs">
          {settings.webhookUrl ? (
            <>
              <span className="h-2 w-2 rounded-full bg-vegetal shrink-0" />
              <span className="text-ink-soft">
                Webhook configurado:{' '}
                <span className="font-mono">{maskUrl(settings.webhookUrl)}</span>
              </span>
            </>
          ) : (
            <>
              <span className="h-2 w-2 rounded-full bg-warn shrink-0" />
              <span className="text-ink-soft">
                Webhook vacío — modo demo. No se hará una petición real.
                Configúralo en Ajustes → Webhook.
              </span>
            </>
          )}
        </div>

        {/* Error state */}
        {status === 'error' && sendError && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-danger/30 bg-danger-soft/40 p-3 text-sm text-danger">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">No se pudo enviar la campaña.</p>
              <p className="mt-0.5">{sendError}</p>
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-2 border-t border-mist pt-4">
          {status === 'error' && (
            <Button variant="secondary" size="md" onClick={() => setStatus('idle')}>
              Intentar de nuevo
            </Button>
          )}
          <Button
            variant="primary"
            size="lg"
            onClick={() => setConfirmOpen(true)}
            disabled={status === 'sending' || sendable.length === 0}
          >
            {status === 'sending' ? 'Enviando…' : 'Enviar campaña'}
            <Send size={16} />
          </Button>
        </div>
      </Card>

      {/* Confirmation modal */}
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="¿Confirmar envío?"
        description={
          sendable.length > 0
            ? `Se enviarán ${sendable.length} mensaje(s) de WhatsApp. Esta acción no se puede deshacer.`
            : ''
        }
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" onClick={handleConfirm}>
              Sí, enviar
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink">
          Revisa que los destinatarios sean correctos.{' '}
          {settings.webhookUrl
            ? 'El webhook recibirá el payload completo ahora.'
            : 'Estás en modo demo: no se hará una petición real.'}
        </p>
      </Modal>
</div>
  )
}
