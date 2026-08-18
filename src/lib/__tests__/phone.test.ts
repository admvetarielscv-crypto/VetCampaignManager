import { describe, expect, test } from 'vitest'
import { normalizePhone } from '../phone'

describe('normalizePhone', () => {
  test.each([
    ['+51 - 983211121', { normalized: '+51983211121', valid: true }],
    [
      '+51 - 985963259(DUEÑA) - 977324052',
      { normalized: '+51985963259', valid: true },
    ],
    ['987123456', { normalized: '+51987123456', valid: true }],
    ['+51 - 44567890', { normalized: '', valid: false }],
    ['', { normalized: '', valid: false }],
    ['   +51 - 955111222   ', { normalized: '+51955111222', valid: true }],
    [
      '+51 - 448877665(FIJO) - 990011223',
      { normalized: '+51990011223', valid: true },
    ],
  ])('normalizePhone(%j) -> %j', (input, expected) => {
    expect(normalizePhone(input)).toEqual(expected)
  })

  test('strips only the first valid 9-digit mobile when multiple are present', () => {
    const { normalized, valid } = normalizePhone(
      '+51 - 985963259(DUEÑA) - 977324052 - 922000111',
    )
    expect(valid).toBe(true)
    expect(normalized).toBe('+51985963259')
  })

  test('ignores fixed lines even when annotated', () => {
    const { normalized, valid } = normalizePhone('+51 - 448877665(FIJO)')
    expect(valid).toBe(false)
    expect(normalized).toBe('')
  })

  test('rejects phones starting with non-9 even if 9 digits', () => {
    const { valid } = normalizePhone('+51 - 123456789')
    expect(valid).toBe(false)
  })
})
