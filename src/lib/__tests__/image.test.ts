import { describe, expect, test } from 'vitest'
import {
  dataUriBytes,
  formatBytes,
  isAcceptedImageMimetype,
  validateImageFileMeta,
} from '../image'

describe('validateImageFileMeta', () => {
  test('accepts a normal JPEG within the size limit', () => {
    const res = validateImageFileMeta({
      mimetype: 'image/jpeg',
      size: 500_000,
    })
    expect(res).toEqual({ ok: true })
  })

  test('rejects non-image mimetypes', () => {
    const res = validateImageFileMeta({
      mimetype: 'application/pdf',
      size: 1000,
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/Formato/)
  })

  test('rejects files over 2 MB', () => {
    const res = validateImageFileMeta({
      mimetype: 'image/png',
      size: 3 * 1024 * 1024,
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/2 MB/)
  })

  test('rejects empty files', () => {
    const res = validateImageFileMeta({ mimetype: 'image/png', size: 0 })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/vacío/)
  })
})

describe('isAcceptedImageMimetype', () => {
  test('allows jpeg, png and webp only', () => {
    expect(isAcceptedImageMimetype('image/jpeg')).toBe(true)
    expect(isAcceptedImageMimetype('image/png')).toBe(true)
    expect(isAcceptedImageMimetype('image/webp')).toBe(true)
    expect(isAcceptedImageMimetype('image/gif')).toBe(false)
    expect(isAcceptedImageMimetype('')).toBe(false)
  })
})

describe('dataUriBytes', () => {
  test('computes raw byte size from a base64 data URI', () => {
    // 'Hello!' → base64 'SGVsbG8h' (6 bytes)
    expect(dataUriBytes('data:image/jpeg;base64,SGVsbG8h')).toBe(6)
    // '' → base64 '' (0 bytes)
    expect(dataUriBytes('data:image/jpeg;base64,')).toBe(0)
    // 'abc' → base64 'YWJj' (3 bytes)
    expect(dataUriBytes('data:image/png;base64,YWJj')).toBe(3)
  })

  test('returns 0 for malformed input', () => {
    expect(dataUriBytes('no-comma-here')).toBe(0)
  })
})

describe('formatBytes', () => {
  test('formats human-readable sizes', () => {
    expect(formatBytes(500)).toBe('500 B')
    expect(formatBytes(184_320)).toBe('180 KB')
    expect(formatBytes(1_572_864)).toBe('1.5 MB')
  })
})
