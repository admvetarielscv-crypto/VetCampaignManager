import { useState } from 'react'
import { Webhook, Save, Eye, EyeOff, Building2 } from 'lucide-react'
import { Button, Card, Input } from '@/shared/components/ui'
import { useSettingsStore } from '@/shared/stores/settingsStore'
import { maskUrl } from '@/lib/format'

export function WebhookTab() {
  const settings = useSettingsStore((s) => s.settings)
  const updateSettings = useSettingsStore((s) => s.updateSettings)

  const [webhookUrl, setWebhookUrl] = useState(settings.webhookUrl)
  const [branchName, setBranchName] = useState(settings.branchName ?? '')
  const [showUrl, setShowUrl] = useState(false)

  const dirty =
    webhookUrl !== settings.webhookUrl ||
    branchName !== (settings.branchName ?? '')

  const handleSave = () => {
    void updateSettings({ webhookUrl: webhookUrl.trim(), branchName: branchName.trim() })
  }

  // Mask URL for display when not editing.
  const masked = webhookUrl ? maskUrl(webhookUrl) : ''

  return (
    <div className="space-y-4 max-w-2xl">
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="rounded-sm bg-vegetal-soft text-vegetal p-1.5">
            <Webhook size={16} />
          </span>
          <h3 className="text-md font-semibold text-ink">
            Conexión de envío
          </h3>
        </div>
        <p className="text-sm text-ink-soft mb-4">
          Este enlace conecta la app con tu WhatsApp: cuando envías una
          campaña, los mensajes salen por aquí. Pégalo una vez y queda
          guardado. Si no lo tienes, pídeselo a quien instaló el sistema.
        </p>

        <label className="text-sm text-ink-soft block mb-1.5">
          Enlace de conexión
        </label>
        <div className="flex gap-2">
          <Input
            type={showUrl ? 'url' : 'text'}
            value={showUrl ? webhookUrl : (webhookUrl ? masked : '')}
            onChange={(e) => setWebhookUrl(e.target.value)}
            readOnly={!showUrl && webhookUrl !== ''}
            placeholder="https://n8n.tu-clinica.com/webhook/campaign"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowUrl((s) => !s)}
            title={showUrl ? 'Ocultar' : 'Mostrar'}
          >
            {showUrl ? <EyeOff size={14} /> : <Eye size={14} />}
          </Button>
        </div>
        {!webhookUrl && (
          <p className="text-xs text-ink-mute mt-1.5">
            Si lo dejas vacío, la app queda en modo prueba: verás cómo sería
            el envío pero no se mandará nada de verdad.
          </p>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="text-md font-semibold text-ink mb-1">
          País de los teléfonos
        </h3>
        <p className="text-sm text-ink-soft mb-4">
          Los números del Excel se leen como celulares de Perú: 9 dígitos que
          empiezan con 9. Los números fijos o incompletos se marcan como
          inválidos y no se les envía.
        </p>
        <Input
          value={settings.defaultCountryCode}
          readOnly
          className="max-w-xs"
        />
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="rounded-sm bg-vegetal-soft text-vegetal p-1.5">
            <Building2 size={16} />
          </span>
          <h3 className="text-md font-semibold text-ink">Sede</h3>
        </div>
        <p className="text-sm text-ink-soft mb-4">
          Nombre de esta sede (por ejemplo "Sede Norte"). Cada campaña guardada
          en el historial llevará esta etiqueta, para que puedas comparar el
          rendimiento entre sedes en el panel.
        </p>
        <label className="text-sm text-ink-soft block mb-1.5">
          Nombre de la sede
        </label>
        <Input
          value={branchName}
          onChange={(e) => setBranchName(e.target.value)}
          placeholder="Sede Norte"
          className="max-w-xs"
        />
      </Card>

      <div className="flex justify-end">
        <Button
          variant="primary"
          size="md"
          onClick={handleSave}
          disabled={!dirty}
        >
          <Save size={14} />
          Guardar
        </Button>
      </div>
    </div>
  )
}