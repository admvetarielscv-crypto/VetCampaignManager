import { describe, expect, test } from 'vitest'
import { validateRecipients } from '../recipients'

describe('validateRecipients', () => {
  test('flags empty phones as invalid with a clear reason', () => {
    const result = validateRecipients({
      rows: [
        { rowNumber: 2, owner: 'A', pet: 'P', rawPhone: '', category: 'Vacuna' },
      ],
    })
    expect(result.recipients).toHaveLength(1)
    expect(result.recipients[0].phoneStatus).toBe('invalid')
    expect(result.recipients[0].issue).toBe('Teléfono vacío')
    expect(result.totals.invalid).toBe(1)
  })

  test('keeps first occurrence and flags later duplicates', () => {
    const result = validateRecipients({
      rows: [
        {
          rowNumber: 2,
          owner: 'A',
          pet: 'P',
          rawPhone: '+51 - 987654321',
          category: 'Vacuna',
        },
        {
          rowNumber: 3,
          owner: 'A2',
          pet: 'P2',
          rawPhone: '+51 - 987654321',
          category: 'Vacuna',
        },
      ],
    })
    expect(result.recipients.map((r) => r.phoneStatus)).toEqual([
      'valid',
      'duplicate',
    ])
    expect(result.totals).toEqual({
      totalRows: 2,
      valid: 1,
      invalid: 0,
      duplicate: 1,
    })
  })

  test('respects an externally-provided seenPhones set', () => {
    const seen = new Set<string>(['+51911111222'])
    const result = validateRecipients({
      rows: [
        {
          rowNumber: 2,
          owner: 'A',
          pet: 'P',
          rawPhone: '+51 - 911111222',
          category: 'Vacuna',
        },
      ],
      seenPhones: seen,
    })
    expect(result.recipients[0].phoneStatus).toBe('duplicate')
    expect(seen.has('+51911111222')).toBe(true)
  })

  test('replaces blank categories with "Sin categoría"', () => {
    const result = validateRecipients({
      rows: [
        {
          rowNumber: 2,
          owner: 'A',
          pet: 'P',
          rawPhone: '+51 - 987654321',
          category: '',
        },
      ],
    })
    expect(result.recipients[0].category).toBe('Sin categoría')
  })

  test('aggregates detected categories sorted by count desc and name asc on tie', () => {
    const result = validateRecipients({
      rows: [
        { rowNumber: 2, owner: 'A', pet: 'P', rawPhone: '+51 - 981111111', category: 'Antipulgas' },
        { rowNumber: 3, owner: 'B', pet: 'P', rawPhone: '+51 - 982222222', category: 'Vacuna' },
        { rowNumber: 4, owner: 'C', pet: 'P', rawPhone: '+51 - 983333333', category: 'Vacuna' },
        { rowNumber: 5, owner: 'D', pet: 'P', rawPhone: '+51 - 984444444', category: 'Desparasitación' },
      ],
    })
    expect(result.detectedCategories).toEqual([
      { name: 'Vacuna', count: 2 },
      { name: 'Antipulgas', count: 1 },
      { name: 'Desparasitación', count: 1 },
    ])
  })
})
