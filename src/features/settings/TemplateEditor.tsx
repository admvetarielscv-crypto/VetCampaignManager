import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Save, Trash2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import {
  Button,
  Input,
  MessagePreview,
  Select,
  Textarea,
} from '@/shared/components/ui'
import { VARIABLES, DEMO_CONTEXT, renderTemplate } from '@/lib/template'
import { CAPTION_WARN_CHARS } from '@/lib/image'
import { useSettingsStore } from '@/shared/stores/settingsStore'
import type { MessageTemplate, TemplateMedia } from '@/lib/types'
import { TemplateMediaPicker } from './TemplateMediaPicker'

interface Props {
  template: MessageTemplate
  onDelete?: (id: string) => void
}

const EMPTY_BODY = 'Hola {{owner}} 👋\n\nNos encantaría ver a {{pet}} 🐾\n\nResponde para agendar.'

export function TemplateEditor({ template, onDelete }: Props) {
  const categories = useSettingsStore((s) => s.categories)
  const allTemplates = useSettingsStore((s) => s.templates)
  const updateTemplate = useSettingsStore((s) => s.updateTemplate)
  const removeTemplate = useSettingsStore((s) => s.removeTemplate)

  const [name, setName] = useState(template.name)
  const [body, setBody] = useState(template.body)
  const [categoryId, setCategoryId] = useState<string | null>(template.categoryId)
  const [isDefault, setIsDefault] = useState(template.isDefault)
  const [media, setMedia] = useState<TemplateMedia | null>(template.media ?? null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const render = useMemo(() => renderTemplate(body, DEMO_CONTEXT), [body])
  const unknownVars = render.unknown
  const oneDefaultEnforced = isDefault && !template.isDefault

  const insertVariable = (key: string) => {
    const el = textareaRef.current
    const token = `{{${key}}}`
    if (!el) {
      setBody((b) => b + token)
      return
    }
    const start = el.selectionStart ?? body.length
    const end = el.selectionEnd ?? start
    const next = body.slice(0, start) + token + body.slice(end)
    setBody(next)
    // Restore caret right after inserted token, on next tick.
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + token.length
      el.setSelectionRange(pos, pos)
    })
  }

  const dirty =
    name !== template.name ||
    body !== template.body ||
    categoryId !== template.categoryId ||
    isDefault !== template.isDefault ||
    JSON.stringify(media ?? null) !== JSON.stringify(template.media ?? null)

  const handleSave = async () => {
    const next: MessageTemplate = {
      ...template,
      name: name.trim() || 'Sin nombre',
      body,
      categoryId,
      isDefault,
      media,
    }
    try {
      // saveTemplate inside updateTemplate already enforces one-default invariant.
      await updateTemplate(next)
    } catch (err) {
      const quota =
        err instanceof Error && err.name === 'QuotaExceededError'
      toast.error(
        quota
          ? 'La imagen pesa demasiado para guardarla aquí. Prueba con una más pequeña o quítala de otra plantilla.'
          : 'No se pudo guardar. Vuelve a intentar.',
      )
    }
  }

  const handleDelete = async () => {
    await removeTemplate(template.id)
    onDelete?.(template.id)
  }

  const onChangeBody = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setBody(e.target.value)
  }

  // For the dropdown: "Predeterminada (fallback)" + each category name.
  // Categories already bound to another template are disabled to enforce the
  // "at most one template per category" invariant.
  const availableCategories = categories
  const boundCategoryIds = new Set(
    allTemplates
      .filter((t) => t.id !== template.id && t.categoryId)
      .map((t) => t.categoryId as string),
  )

  return (
    <div className="space-y-4">
      {/* Top row: name + binding */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-ink-soft block mb-1.5">
            Nombre de la plantilla
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="p. ej. Recordatorio vacuna"
          />
        </div>
        <div>
          <label className="text-sm text-ink-soft block mb-1.5">
            Categoría
          </label>
          <Select
            value={categoryId ?? ''}
            onChange={(e) => {
              const v = e.target.value
              setCategoryId(v === '' ? null : v)
              if (v === '') setIsDefault(true)
            }}
          >
            <option value="">Para todas las categorías</option>
            {availableCategories.map((c) => (
              <option
                key={c.id}
                value={c.id}
                disabled={boundCategoryIds.has(c.id)}
              >
                {c.name}
                {boundCategoryIds.has(c.id) ? ' (ya tiene plantilla)' : ''}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {categoryId !== null && (
        <label className="flex items-center gap-2 text-sm text-ink-soft cursor-pointer">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="accent-vegetal"
          />
          Marcar también como el mensaje para todas las categorías
        </label>
      )}

      {categoryId === null && (
        <p className="text-xs text-ink-mute">
          Este mensaje lo reciben todos los clientes cuya categoría no tenga
          un mensaje propio.
        </p>
      )}

      {oneDefaultEnforced && (
        <div className="flex items-start gap-2 rounded-sm bg-warn-soft/50 border border-warn/20 p-2.5 text-xs text-warn">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            Solo puede existir un mensaje "para todas las categorías". Si
            marcas este, el anterior dejará de serlo.
          </span>
        </div>
      )}

      {/* Variable chips */}
      <div>
        <label className="text-sm text-ink-soft block mb-1.5">
          Datos que puedes usar en el mensaje
        </label>
        <div className="flex flex-wrap gap-2">
          {VARIABLES.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => insertVariable(v.key)}
              className="inline-flex items-center gap-1 rounded-md bg-mist-soft hover:bg-vegetal-soft hover:text-vegetal border border-mist px-2 py-1 text-xs font-mono transition-colors"
              title={`Insertar ${v.label}`}
            >
              {`{{${v.key}}}`}
              <span className="font-sans text-ink-mute ml-1">{v.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Body + preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-ink-soft block mb-1.5">
            Mensaje
          </label>
          <Textarea
            ref={textareaRef}
            value={body}
            onChange={onChangeBody}
            rows={12}
            className="leading-relaxed"
            placeholder={EMPTY_BODY}
          />
          {unknownVars.length > 0 && (
            <div className="flex items-center gap-2 mt-2 text-xs text-danger">
              <AlertTriangle size={12} />
              Estos códigos no se van a reemplazar, revísalos:{' '}
              <code className="font-mono">
                {unknownVars.map((v) => `{{${v}}}`).join(', ')}
              </code>
            </div>
          )}
        </div>

        <MessagePreview
          recipientName={DEMO_CONTEXT.owner}
          message={render.text}
          mediaUrl={media?.data ?? null}
        />
      </div>

      {/* Attached image */}
      <TemplateMediaPicker media={media} onChange={setMedia} />

      {media && body.length > CAPTION_WARN_CHARS && (
        <div className="flex items-start gap-2 rounded-sm bg-warn-soft/50 border border-warn/20 p-2.5 text-xs text-warn">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            WhatsApp corta los mensajes largos cuando llevan imagen. Si el
            mensaje pasa de ~1024 caracteres, acórtalo para que no se corte.
          </span>
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center justify-between pt-2 border-t border-mist">
        <div>
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-ink-soft">¿Eliminar?</span>
              <Button
                variant="primary"
                size="sm"
                onClick={handleDelete}
              >
                Sí, eliminar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDelete(false)}
              >
                Cancelar
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={14} />
              Eliminar
            </Button>
          )}
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={handleSave}
          disabled={!dirty || !name.trim()}
        >
          <Save size={14} />
          Guardar
        </Button>
      </div>
    </div>
  )
}