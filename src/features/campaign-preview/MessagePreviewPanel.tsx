import { AlertTriangle, Image as ImageIcon, MessageSquare, Star, Tag, X } from 'lucide-react'
import { Chip, EmptyState, MessagePreview } from '@/shared/components/ui'
import { useSettingsStore } from '@/shared/stores/settingsStore'
import { renderMessageForRecipient } from '@/lib/campaign'
import type { Recipient } from '@/lib/types'

interface Props {
  recipient: Recipient | null
  onClose: () => void
}

const statusTone: Record<Recipient['phoneStatus'], 'vegetal' | 'danger' | 'warn'> = {
  valid: 'vegetal',
  invalid: 'danger',
  duplicate: 'warn',
}

const statusLabel: Record<Recipient['phoneStatus'], string> = {
  valid: 'Válido',
  invalid: 'Inválido',
  duplicate: 'Duplicado',
}

export function MessagePreviewPanel({ recipient, onClose }: Props) {
  const categories = useSettingsStore((s) => s.categories)
  const templates = useSettingsStore((s) => s.templates)

  if (!recipient) {
    return (
      <div className="rounded-md border border-mist bg-paper p-6">
        <EmptyState
          icon={<MessageSquare size={22} />}
          title="Selecciona un destinatario"
          description="Haz clic en una fila de la tabla para ver cómo recibirá su mensaje de WhatsApp."
        />
      </div>
    )
  }

  const msg = renderMessageForRecipient(recipient, categories, templates)
  const templateName = msg.template?.name
  const isDefault = msg.template?.isDefault ?? false
  const boundCategoryName =
    msg.template && msg.template.categoryId
      ? categories.find((c) => c.id === msg.template!.categoryId)?.name
      : null

  return (
    <div className="rounded-md border border-mist bg-paper sticky top-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between px-4 py-3 border-b border-mist">
        <div className="min-w-0">
          <p className="text-2xs uppercase tracking-wide text-ink-mute">
            Vista previa
          </p>
          <h3 className="text-md font-semibold text-ink truncate">
            {recipient.owner || 'Propietario vacío'}
          </h3>
          <p className="text-xs text-ink-mute mt-0.5">
            {recipient.pet && <span>{recipient.pet} · </span>}
            <span style={{ fontFamily: 'var(--font-mono)' }}>
              {recipient.normalizedPhone || recipient.rawPhone || '—'}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Chip tone={statusTone[recipient.phoneStatus]}>
            {statusLabel[recipient.phoneStatus]}
          </Chip>
          <button
            onClick={onClose}
            className="rounded-sm p-1 text-ink-mute hover:bg-mist-soft hover:text-ink transition-colors"
            title="Cerrar"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Category line */}
      <div className="px-4 py-2.5 flex items-center gap-1.5 text-sm bg-mist-soft/30 border-b border-mist">
        <Tag size={12} className="text-ink-mute" />
        <span className="text-ink-soft">Categoría:</span>
        <span className="font-medium text-ink">{recipient.category}</span>
      </div>

      {/* Template info */}
      <div className="px-4 py-3 border-b border-mist space-y-1.5">
        {msg.template ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-ink-mute">Plantilla:</span>
            <span className="font-medium text-ink">{templateName}</span>
            {isDefault && (
              <span className="inline-flex items-center gap-1 rounded-sm bg-clay-soft text-clay px-1.5 py-0.5 text-2xs font-medium">
                <Star size={10} />
                Predeterminada
              </span>
            )}
            {boundCategoryName && (
              <span className="text-2xs text-ink-mute">
                (para {boundCategoryName})
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-start gap-2 text-sm text-warn">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>
              No hay plantilla Predeterminada ni asociada a esta categoría. Crea
              una en <strong>Ajustes → Plantillas</strong> antes de enviar.
            </span>
          </div>
        )}

        {msg.template?.media && (
          <div className="flex items-center gap-2 text-sm">
            <ImageIcon size={14} className="text-vegetal" />
            <span className="text-ink-soft">
              Se enviará con imagen:{' '}
              <span className="font-medium text-ink truncate">
                {msg.template.media.fileName}
              </span>
            </span>
          </div>
        )}

        {msg.unknown.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-danger">
            <AlertTriangle size={12} />
            Variable(s) desconocida(s):
            <code className="font-mono">
              {msg.unknown.map((v) => `{{${v}}}`).join(', ')}
            </code>
          </div>
        )}

        {msg.empty.length > 0 && msg.text && (
          <div className="flex items-center gap-2 text-xs text-warn">
            <AlertTriangle size={12} />
            Dato(s) vacío(s) en el destinatario:
            {msg.empty.map((v) => `{{${v}}}`).join(', ')}
          </div>
        )}
      </div>

      {/* WhatsApp bubble preview */}
      <div className="p-4">
        <MessagePreview
          recipientName={recipient.owner || 'Destinatario'}
          message={msg.text}
          caption={false}
          mediaUrl={msg.template?.media?.data ?? null}
        />
      </div>
    </div>
  )
}