import { useCallback, useState } from 'react'
import { parseWorkbook } from '@/lib/excel'
import { validateRecipients } from '@/lib/recipients'
import { useCampaignStore } from '@/shared/stores/campaignStore'
import { useSettingsStore } from '@/shared/stores/settingsStore'
import { findContactStates } from '@/storage/exports'
import type { ImportResult, Recipient } from '@/lib/types'

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

        // Attach the branch's contact ledger state (last contact + flags) so
        // the preview can apply the re-contact guard and "NO CONTACTAR".
        const phones = [
          ...new Set(
            result.recipients
              .map((r) => r.normalizedPhone)
              .filter((p): p is string => Boolean(p)),
          ),
        ]
        let resultWithContacts = result
        try {
          const states = await findContactStates(phones)
          const recipients: Recipient[] = result.recipients.map((r) => {
            const state = r.normalizedPhone
              ? (states.get(r.normalizedPhone) as Recipient['contactState'])
              : undefined
            return state ? { ...r, contactState: state } : r
          })
          resultWithContacts = { ...result, recipients }
        } catch (err) {
          // Ledger unavailable (offline/RLS): proceed without the guard —
          // sending must never be blocked by a secondary read.
          console.warn('contact ledger lookup failed', err)
        }

        setParsedResult(file.name, resultWithContacts)
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