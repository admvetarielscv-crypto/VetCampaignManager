import { useRef, useState } from 'react'
import { ImagePlus, RefreshCw, Trash2, AlertTriangle } from 'lucide-react'
import { formatBytes } from '@/lib/image'
import type { TemplateMedia } from '@/lib/types'
import { fileToTemplateMedia } from './templateMedia'

interface Props {
  media: TemplateMedia | null
  onChange: (media: TemplateMedia | null) => void
}

/**
 * Pick / preview / remove the optional image attached to a template.
 * The converted image is shown as a thumbnail (data URI) — the client
 * receives the real image in WhatsApp, with the message text as caption.
 */
export function TemplateMediaPicker({ media, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const pick = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    try {
      onChange(await fileToTemplateMedia(file))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la imagen.')
    }
  }

  return (
    <div>
      <label className="text-sm text-ink-soft block mb-1.5">
        Imagen adjunta (opcional)
      </label>
      <p className="text-xs text-ink-mute mb-2">
        Si cargas una imagen, los mensajes de esta plantilla se enviarán con la
        foto y el texto debajo. El cliente recibe la imagen real, no un enlace.
        JPG, PNG o WebP hasta 2 MB.
      </p>

      {media ? (
        <div className="flex items-start gap-3 rounded-sm border border-mist bg-paper p-3">
          <img
            src={media.data}
            alt={media.fileName}
            className="h-20 w-20 rounded-sm border border-mist object-cover shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-ink truncate" title={media.fileName}>
              {media.fileName}
            </p>
            <p className="text-xs text-ink-mute tnum">
              {formatBytes(media.bytes)} · lista para enviar
            </p>
            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="inline-flex items-center gap-1 rounded-sm border border-mist px-2 py-1 text-xs text-ink-soft hover:bg-mist-soft transition-colors"
              >
                <RefreshCw size={12} />
                Reemplazar
              </button>
              <button
                type="button"
                onClick={() => onChange(null)}
                className="inline-flex items-center gap-1 rounded-sm border border-mist px-2 py-1 text-xs text-danger hover:bg-danger-soft transition-colors"
              >
                <Trash2 size={12} />
                Quitar
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 rounded-sm border border-dashed border-mist bg-paper px-3 py-4 text-sm text-ink-soft hover:border-vegetal hover:text-vegetal hover:bg-vegetal-soft/30 transition-colors"
        >
          <ImagePlus size={16} />
          Cargar imagen desde tu computadora
        </button>
      )}

      {error && (
        <div className="flex items-center gap-2 mt-2 text-xs text-danger">
          <AlertTriangle size={12} />
          {error}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          void pick(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
