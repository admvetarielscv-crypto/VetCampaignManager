import { cn } from '@/lib/cn'
import { CheckCheck } from 'lucide-react'

/**
 * WhatsApp-style message bubble. Reused by the template editor (synthetic
 * demo context) and the campaign preview (real recipient). Pure presentational.
 */
export interface MessagePreviewProps {
  recipientName: string
  message: string
  /** When true, renders an italic caption "Así lo verá {recipientName}". */
  caption?: boolean
  /**
   * Data URI of an attached image (template media). Rendered inside the
   * bubble above the text, mimicking WhatsApp's image + caption layout.
   */
  mediaUrl?: string | null
  className?: string
}

export function MessagePreview({
  recipientName,
  message,
  caption = true,
  mediaUrl = null,
  className,
}: MessagePreviewProps) {
  return (
    <div className={cn('flex flex-col', className)}>
      {caption && (
        <p className="text-2xs uppercase tracking-wide text-ink-mute mb-2">
          Así lo verá {recipientName || 'el destinatario'}
        </p>
      )}
      <div className="rounded-md bg-paper border border-mist overflow-hidden">
        {/* Header bar mimicking a WhatsApp chat */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-mist bg-vegetal-soft/40">
          <span className="h-7 w-7 rounded-full bg-vegetal text-paper flex items-center justify-center text-xs font-medium">
            {recipientName?.[0]?.toUpperCase() || '?'}
          </span>
          <div className="min-w-0 leading-tight">
            <p className="text-sm font-medium text-ink truncate">
              {recipientName || 'Destinatario'}
            </p>
            <p className="text-2xs text-ink-mute">en línea</p>
          </div>
        </div>
        {/* Bubble */}
        <div className="p-3 bg-mist-soft/30 min-h-[6rem]">
          <div className="rounded-md bg-[#dcf8c6] px-3 py-2 max-w-[85%] whitespace-pre-wrap text-sm text-ink leading-relaxed shadow-sm">
            {mediaUrl && (
              <img
                src={mediaUrl}
                alt="Imagen adjunta"
                className="rounded-sm mb-2 max-h-48 w-full object-cover"
              />
            )}
            {message || (
              <span className="text-ink-mute italic">
                (El mensaje aparecerá aquí)
              </span>
            )}
            <span className="flex items-center justify-end gap-1 mt-1 text-[10px] text-ink-mute">
              <span className="tnum">
                {new Date().toLocaleTimeString('es-PE', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              <CheckCheck size={12} className="text-sky-500" />
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
