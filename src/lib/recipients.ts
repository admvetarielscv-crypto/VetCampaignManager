/**
 * Pure recipient validation: phone status, duplicate detection and
 * category aggregation. No React, no storage, no network.
 *
 * Mutates nothing; returns a fresh ImportResult.
 */
import { newId } from '@/lib/id'
import { normalizePhone } from '@/lib/phone'
import { APP } from '@/app/env'
import type {
  CategoryCount,
  ImportResult,
  Recipient,
} from '@/lib/types'

export interface ValidationInput {
  /** Already mapped rows (1-based row numbers, raw text fields). */
  rows: Array<{
    rowNumber: number
    owner: string
    pet: string
    rawPhone: string
    category: string
  }>
  /** Optional set of normalized phones already seen (for cross-call dedup). */
  seenPhones?: Set<string>
  /**
   * Country code passed to phone normalization. Defaults to APP.defaultCountryCode.
   * The MVP only validates Peru mobile shape (9 digits, leading 9).
   */
  countryCode?: string
}

export function validateRecipients(input: ValidationInput): ImportResult {
  const seen = input.seenPhones ? new Set(input.seenPhones) : new Set<string>()
  const recipients: Recipient[] = []
  const categoryMap = new Map<string, number>()
  const countryCode = input.countryCode ?? APP.defaultCountryCode

  for (const row of input.rows) {
    const { normalized, valid } = normalizePhone(row.rawPhone, countryCode)

    let phoneStatus: Recipient['phoneStatus']
    let issue: string | undefined

    if (!valid) {
      if (!row.rawPhone.trim()) {
        issue = 'Teléfono vacío'
      } else {
        issue = 'Teléfono no válido (requiere móvil peruano de 9 dígitos)'
      }
      phoneStatus = 'invalid'
    } else if (seen.has(normalized)) {
      phoneStatus = 'duplicate'
      issue = 'Teléfono duplicado'
    } else {
      phoneStatus = 'valid'
      seen.add(normalized)
    }

    const recipient: Recipient = {
      id: newId(),
      rowNumber: row.rowNumber,
      owner: row.owner.trim(),
      pet: row.pet.trim(),
      rawPhone: row.rawPhone.trim(),
      normalizedPhone: valid ? normalized : undefined,
      category: row.category.trim() || 'Sin categoría',
      phoneStatus,
      issue,
    }
    recipients.push(recipient)

    // Aggregate category counts across ALL rows (including invalid ones) so
    // the receptionist sees what came in the file.
    const catKey = recipient.category
    categoryMap.set(catKey, (categoryMap.get(catKey) ?? 0) + 1)
  }

  const detectedCategories: CategoryCount[] = [...categoryMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

  const totals = {
    totalRows: recipients.length,
    valid: recipients.filter((r) => r.phoneStatus === 'valid').length,
    invalid: recipients.filter((r) => r.phoneStatus === 'invalid').length,
    duplicate: recipients.filter((r) => r.phoneStatus === 'duplicate').length,
  }

  return {
    recipients,
    errors: [],
    totals,
    detectedCategories,
  }
}

/** Convenience selector — kept here rather than in the UI for reuse + testing. */
export function getValidRecipients(result: ImportResult): Recipient[] {
  return result.recipients.filter((r) => r.phoneStatus === 'valid')
}