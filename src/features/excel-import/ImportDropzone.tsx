import { useDropzone, type FileRejection } from 'react-dropzone'
import { FileSpreadsheet, UploadCloud } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/cn'
import { Spinner } from '@/shared/components/ui'
import { useExcelImport } from './useExcelImport'

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

export function ImportDropzone({
  importState,
}: {
  importState: ReturnType<typeof useExcelImport>
}) {
  const { status, handleFile } = importState

  const onDrop = (accepted: File[], rejected: FileRejection[]) => {
    if (rejected.length > 0) {
      const r = rejected[0]
      const firstErr = r.errors[0]
      if (firstErr.code === 'file-too-large') {
        importState.reset()
        // Inline message via the parent summary is handled outside; show here too.
        toast.error('El archivo supera 10 MB.')
        return
      }
    }
    if (accepted.length > 0) void handleFile(accepted[0])
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxSize: MAX_SIZE,
    multiple: false,
    disabled: status === 'parsing',
  })

  return (
    <div
      {...getRootProps()}
      className={cn(
        'relative rounded-md border-2 border-dashed transition-colors py-12 px-6 text-center cursor-pointer',
        'flex flex-col items-center justify-center gap-3 outline-none',
        isDragActive
          ? 'border-vegetal bg-vegetal-soft'
          : 'border-mist bg-paper hover:border-vegetal/50 hover:bg-mist-soft/40',
        status === 'parsing' && 'opacity-70 cursor-wait',
      )}
    >
      <input {...getInputProps()} aria-label="Seleccionar archivo Excel" />

      {status === 'parsing' ? (
        <>
          <Spinner className="h-6 w-6" />
          <p className="text-sm text-ink-soft">Leyendo el archivo…</p>
        </>
      ) : (
        <>
          <div className="rounded-md bg-vegetal-soft text-vegetal p-3">
            {isDragActive ? <UploadCloud size={26} /> : <FileSpreadsheet size={26} />}
          </div>
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-ink">
              {isDragActive
                ? 'Suelta el archivo aquí'
                : 'Arrastra el archivo Excel de VetPraxis'}
            </p>
            <p className="text-xs text-ink-mute">
              o haz clic para seleccionar · .xlsx o .xls · máx. 10 MB
            </p>
          </div>
        </>
      )}
    </div>
  )
}