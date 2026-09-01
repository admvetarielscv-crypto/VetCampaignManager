import { describe, expect, test } from 'vitest'
import { maskUrl } from '../format'

describe('maskUrl', () => {
  test('keeps protocol and first 4 chars of host, hides the rest', () => {
    expect(maskUrl('https://my-n8n.example.com/webhook/campaign')).toBe(
      'https://my-n•••••',
    )
  })

  test('returns input unchanged when it does not match a URL pattern', () => {
    expect(maskUrl('not-a-url')).toBe('not-a-url')
  })

  test('handles http URLs', () => {
    expect(maskUrl('http://10.0.0.5:1234/path')).toBe('http://10.0•••••')
  })
})
