import { useState } from 'react'
import { Webhook, Save, Eye, EyeOff } from 'lucide-react'
import { Button, Card, Input, Select } from '@/shared/components/ui'
import { useSettingsStore } from '@/shared/stores/settingsStore'
import { maskUrl } from '@/lib/format'

const COUNTRIES = [
  { code: '+51', label: 'Perú (+51)' },
  { code: '+54', label: 'Argentina (+54)' },
  { code: '+52', label: 'México (+52)' },
  { code: '+57', label: 'Colombia (+57)' },
  { code: '+56', label: 'Chile (+56)' },
  { code: '+34', label: 'España (+34)' },
]

export function WebhookTab() {
  const settings = useSettingsStore((s) => s.settings)
  const updateSettings = useSettingsStore((s) => s.updateSettings)

  const [webhookUrl, setWebhookUrl] = useState(settings.webhookUrl)
  const [defaultCountryCode, setDefaultCountryCode] = useState(
    settings.defaultCountryCode,
  )
  const [showUrl, setShowUrl] = useState(false)

  const dirty =
    webhookUrl !== settings.webhookUrl ||
    defaultCountryCode !== settings.defaultCountryCode

  const handleSave = () => {
    void updateSettings({ webhookUrl: webhookUrl.trim(), defaultCountryCode })
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
            Webhook de envío n8n
          </h3>
        </div>
        <p className="text-sm text-ink-soft mb-4">
          Al enviar una campaña, VetCampaignManager hace un POST hacia esta URL
          con la lista de destinatarios y sus mensajes ya renderizados. n8n
          luego los reenvía por WhatsApp vía Evolution API.
        </p>

        <label className="text-sm text-ink-soft block mb-1.5">
          URL del webhook
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
            Vacío = modo demo. Verás el payload que se enviaría sin hacer la
            petición real (útil para pruebas).
          </p>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="text-md font-semibold text-ink mb-1">
          País por defecto
        </h3>
        <p className="text-sm text-ink-soft mb-4">
          Se usa para normalizar teléfonos sin código de país al importar el
          Excel. Los móviles peruanos son 9 dígitos empezando por 9.
        </p>
        <label className="text-sm text-ink-soft block mb-1.5">
          Prefijo país
        </label>
        <Select
          value={defaultCountryCode}
          onChange={(e) => setDefaultCountryCode(e.target.value)}
          className="max-w-xs"
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </Select>
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