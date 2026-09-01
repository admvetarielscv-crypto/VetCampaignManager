import { useCallback, useState } from 'react'
import { parseWorkbook } from '@/lib/excel'
import { validateRecipients } from '@/lib/recipients'
import { useCampaignStore } from '@/shared/stores/campaignStore'
import { useSettingsStore } from '@/shared/stores/settingsStore'
import type { ImportResult } from '@/lib/types'

export type ImportStatus = 'idle' | 'parsing' | 'success' | 'error'

export interface ImportErrorState {
  message: string
}

export function useExcelImport() {
  const [status, setStatus] = useState<ImportStatus>('idle')
  const [error, setError] = useState<ImportErrorState | null>(null)
  const setParsedResult = useCampaignStore((s) => s.setParsedResult)
  const countryCode = useSettingsStore((s) => s.settings.defaultCountryCode)

  const handleFile = useCallback(
    async (file: File) => {
      setStatus('parsing')
      setError(null)

      try {
        const parsed = await parseWorkbook(file)
        if (parsed.errors.length > 0) {
          setStatus('error')
          setError({ message: parsed.errors[0].message })
          return
        }

        const result: ImportResult = validateRecipients({
          rows: parsed.rows,
          countryCode,
        })

        if (parsed.rows.length === 0 && result.recipients.length === 0) {
          setStatus('error')
          setError({ message: 'No se encontraron filas con datos.' })
          return
        }

        setParsedResult(file.name, result)
        setStatus('success')
      } catch (err) {
        setStatus('error')
        const message =
          err instanceof Error
            ? err.message
            : 'No se pudo leer el archivo. Intenta de nuevo.'
        setError({ message })
      }
    },
    [setParsedResult, countryCode],
  )

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
  }, [])

  return { status, error, handleFile, reset }
}