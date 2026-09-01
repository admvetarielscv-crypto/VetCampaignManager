import { useEffect, useState } from 'react'
import { Plus, MessageSquare, Star } from 'lucide-react'
import { Button, Card, EmptyState } from '@/shared/components/ui'
import { useSettingsStore } from '@/shared/stores/settingsStore'
import { TemplateEditor } from './TemplateEditor'

export function TemplatesTab() {
  const templates = useSettingsStore((s) => s.templates)
  const categories = useSettingsStore((s) => s.categories)
  const addTemplate = useSettingsStore((s) => s.addTemplate)

  const [selectedId, setSelectedId] = useState<string | null>(
    templates[0]?.id ?? null,
  )

  // Keep selection valid if the list changes (e.g., delete, seed).
  useEffect(() => {
    if (!selectedId && templates.length > 0) {
      setSelectedId(templates[0].id)
    } else if (selectedId && !templates.some((t) => t.id === selectedId)) {
      setSelectedId(templates[0]?.id ?? null)
    }
  }, [templates, selectedId])

  const selected = templates.find((t) => t.id === selectedId) ?? null

  const categoryName = (id: string | null) => {
    if (id === null) return 'Predeterminada'
    return categories.find((c) => c.id === id)?.name ?? 'Categoría eliminada'
  }

  const handleNew = async () => {
    const created = await addTemplate({
      categoryId: null,
      name: 'Nueva plantilla',
      body: 'Hola {{owner}} 👋\n\nNos encantaría ver a {{pet}} 🐾\n\nResponde para agendar.',
      isDefault: templates.every((t) => !t.isDefault),
    })
    setSelectedId(created.id)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px,1fr] gap-5">
      {/* List */}
      <div className="space-y-3">
        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          onClick={handleNew}
        >
          <Plus size={14} />
          Nueva plantilla
        </Button>

        {templates.length === 0 ? (
          <Card>
            <EmptyState
              icon={<MessageSquare size={22} />}
              title="Sin plantillas"
              description="Crea al menos una plantilla Predeterminada para empezar a enviar campañas."
            />
          </Card>
        ) : (
          <div className="space-y-1.5">
            {templates.map((t) => {
              const active = t.id === selectedId
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className={`w-full text-left rounded-md border px-3 py-2.5 transition-colors ${
                    active
                      ? 'border-vegetal/40 bg-vegetal-soft/30'
                      : 'border-mist bg-paper hover:bg-mist-soft/30'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-ink truncate">
                      {t.name}
                    </span>
                    {t.isDefault && (
                      <span className="flex items-center gap-1 rounded-sm bg-clay-soft text-clay px-1.5 py-0.5 text-2xs font-medium shrink-0">
                        <Star size={10} />
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-2xs text-ink-mute mt-0.5 truncate">
                    {categoryName(t.categoryId)}
                  </p>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Editor */}
      <div>
        {selected ? (
          <Card className="p-5">
            <TemplateEditor key={selected.id} template={selected} onDelete={() => {}} />
          </Card>
        ) : (
          <Card>
            <EmptyState
              icon={<MessageSquare size={22} />}
              title="Selecciona o crea una plantilla"
              description="Las plantillas usan variables como {{owner}}, {{pet}} y {{category}}, que se reemplazan automáticamente al enviar la campaña."
            />
          </Card>
        )}
      </div>
    </div>
  )
}