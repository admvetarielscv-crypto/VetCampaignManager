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

  test('accepts countryCode parameter (default "+51") and strips it', () => {
    expect(normalizePhone('+51987654321')).toEqual({
      normalized: '+51987654321',
      valid: true,
    })
    expect(normalizePhone('+51 987654321', '+51')).toEqual({
      normalized: '+51987654321',
      valid: true,
    })
  })

  test('falls back to default "+51" when countryCode is omitted', () => {
    const { normalized, valid } = normalizePhone('987654321')
    expect(valid).toBe(true)
    expect(normalized).toBe('+51987654321')
  })

  test('non-Peru countryCode still produces Peru E.164 output when valid', () => {
    // Future-proofing: any country prefix is stripped, validation stays Peru-only.
    const { normalized, valid } = normalizePhone('+54 - 987654321', '+54')
    expect(valid).toBe(true)
    expect(normalized).toBe('+51987654321')
  })
})
