import { useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ArrowRight,
  CheckCheck,
  Filter,
  RotateCcw,
  Search,
  Users,
  X,
} from 'lucide-react'
import { Button, Input, Select, Stat } from '@/shared/components/ui'
import { useCampaignStore } from '@/shared/stores/campaignStore'
import { useSettingsStore } from '@/shared/stores/settingsStore'
import {
  buildSendableRecipients,
  countByStatus,
} from '@/lib/campaign'
import { RecipientTable } from './RecipientTable'
import { MessagePreviewPanel } from './MessagePreviewPanel'
import { useRecipientFilters } from './useRecipientFilters'
import type { Recipient } from '@/lib/types'

export function CampaignPreview() {
  const navigate = useNavigate()
  const result = useCampaignStore((s) => s.result)
  const fileName = useCampaignStore((s) => s.rawFileName)
  const recipientEnabled = useCampaignStore((s) => s.recipientEnabled)
  const selectedId = useCampaignStore((s) => s.selectedId)
  const selectRecipient = useCampaignStore((s) => s.selectRecipient)
  const toggleRecipient = useCampaignStore((s) => s.toggleRecipient)
  const setEnabledBulk = useCampaignStore((s) => s.setEnabledBulk)
  const setPhase = useCampaignStore((s) => s.setPhase)
  const resetStore = useCampaignStore((s) => s.reset)

  const categories = useSettingsStore((s) => s.categories)
  const templates = useSettingsStore((s) => s.templates)

  // Guard: if there's no campaign in memory, go back to import with a toast.
  const notifiedRef = useRef(false)
  useEffect(() => {
    if (!result || result.recipients.length === 0) {
      if (!notifiedRef.current) {
        toast.info('Importa un archivo Excel para ver la campaña.')
        notifiedRef.current = true
      }
      navigate('/campaign', { replace: true })
    }
  }, [result, navigate])

  const tableRows = useMemo<Array<Recipient & { enabled: boolean }>>(() => {
    if (!result) return []
    return result.recipients.map((r) => ({
      ...r,
      enabled: recipientEnabled[r.id] ?? r.phoneStatus === 'valid',
    }))
  }, [result, recipientEnabled])

  const filters = useRecipientFilters(tableRows)

  const counts = useMemo(
    () => countByStatus(result?.recipients ?? []),
    [result],
  )

  const toSendCount = useMemo(() => {
    if (!result) return 0
    return buildSendableRecipients(
      result.recipients,
      categories,
      templates,
      recipientEnabled,
    ).length
  }, [result, categories, templates, recipientEnabled])

  const detectedCategoryNames = useMemo(() => {
    if (!result) return []
    return result.detectedCategories.map((c) => c.name)
  }, [result])

  const selectedRecipient: Recipient | null = useMemo(() => {
    if (!result || !selectedId) return null
    return result.recipients.find((r) => r.id === selectedId) ?? null
  }, [result, selectedId])

  if (!result) return null

  const handleBack = () => {
    setPhase('import')
    navigate('/campaign')
  }

  const handleNewFile = () => {
    resetStore()
    navigate('/campaign')
  }

  const handleSend = () => {
    if (toSendCount === 0) {
      toast.error('No hay destinatarios habilitados para enviar.')
      return
    }
    setPhase('send')
    navigate('/campaign/send')
  }

  return (
    <div className="p-6 max-w-7xl mx-auto animate-rise">
      {/* Top bar: back + file + new */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft size={14} />
            Volver
          </Button>
          <span className="text-sm text-ink-soft truncate">
            <span className="font-medium text-ink">{fileName}</span>
            <span className="text-ink-mute"> · {counts.total} filas</span>
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleNewFile}>
          <RotateCcw size={14} />
          Importar otro
        </Button>
      </div>

      {/* Stat chips */}
      <div className="flex flex-wrap gap-2 mb-4 text-xs">
        <Stat variant="chip" label="Total" value={counts.total} tone="neutral" />
        <Stat variant="chip" label="A enviar" value={toSendCount} tone="vegetal" highlight />
        <Stat variant="chip" label="Válidos" value={counts.valid} tone="vegetal" />
        <Stat variant="chip" label="Duplicados" value={counts.duplicate} tone="warn" />
        <Stat variant="chip" label="Inválidos" value={counts.invalid} tone="danger" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-2 mb-3">
        <div className="relative flex-1 min-w-[12rem] max-w-[18rem]">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-mute pointer-events-none"
          />
          <Input
            value={filters.state.search}
            onChange={(e) => filters.setSearch(e.target.value)}
            placeholder="Buscar propietario, mascota o teléfono…"
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter size={14} className="text-ink-mute" />
          <Select
            value={filters.state.category}
            onChange={(e) => filters.setCategory(e.target.value)}
            className="w-auto"
          >
            <option value="">Todas las categorías</option>
            {detectedCategoryNames.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Select
            value={filters.state.status}
            onChange={(e) =>
              filters.setStatus(e.target.value as typeof filters.state.status)
            }
            className="w-auto"
          >
            <option value="all">Todos los estados</option>
            <option value="valid">Válidos</option>
            <option value="duplicate">Duplicados</option>
            <option value="invalid">Inválidos</option>
          </Select>
        </div>
        <Button variant="ghost" size="sm" onClick={filters.reset} disabled={!filters.isActive}>
          <X size={14} />
          Limpiar
        </Button>
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setEnabledBulk(filters.filtered.map((r) => r.id), true)
            }
          >
            <CheckCheck size={14} />
            Marcar todos visibles
          </Button>
        </div>
      </div>

      {/* Table + preview */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr,380px] gap-5">
        <div>
          <p className="text-xs text-ink-mute mb-2">
            Mostrando {filters.filtered.length} de {result.recipients.length}{' '}
            destinatarios. Marca la casilla de cada fila para decidir quién
            recibe el mensaje.
          </p>
          <RecipientTable
            rows={filters.filtered}
            selectedId={selectedId}
            onSelect={selectRecipient}
            onToggle={toggleRecipient}
          />
        </div>
        <div>
          <MessagePreviewPanel
            recipient={selectedRecipient}
            onClose={() => selectRecipient(null)}
          />
        </div>
      </div>

      {/* Send action */}
      <div className="mt-6 flex items-center justify-between border-t border-mist pt-4">
        <div className="flex items-center gap-2 text-sm text-ink-soft">
          <Users size={14} />
          <span>
            <strong className="text-ink tnum">{toSendCount}</strong> destinatario
            (s) a enviar
          </span>
        </div>
        <Button
          variant="primary"
          size="lg"
          onClick={handleSend}
          disabled={toSendCount === 0}
        >
          Enviar campaña
          <ArrowRight size={16} />
        </Button>
      </div>
</div>
  )
}
