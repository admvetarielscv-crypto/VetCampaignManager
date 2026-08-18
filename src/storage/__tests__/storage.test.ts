import { beforeEach, describe, expect, test } from 'vitest'
import { getJSON, setJSON } from '../storage'

beforeEach(() => {
  localStorage.clear()
})

describe('storage envelope', () => {
  test('stores data under a versioned envelope and reads it back', async () => {
    await setJSON('k', [1, 2, 3])
    const raw = localStorage.getItem('k')
    expect(raw).toBe(JSON.stringify({ version: 1, data: [1, 2, 3] }))
    expect(await getJSON<number[]>('k', [])).toEqual([1, 2, 3])
  })

  test('returns fallback when key is absent', async () => {
    expect(await getJSON('missing', ['x'])).toEqual(['x'])
  })

  test('quarantines raw and returns fallback when JSON is corrupt', async () => {
    localStorage.setItem('k', '{bad json')
    const got = await getJSON<{ ok: boolean }>('k', { ok: true })
    expect(got).toEqual({ ok: true })
    expect(localStorage.getItem('vcm:_quarantine:k')).toBe('{bad json')
  })

  test('returns fallback when envelope lacks data field', async () => {
    localStorage.setItem('k', JSON.stringify({ version: 1 }))
    expect(await getJSON('k', 'fb')).toBe('fb')
  })

  test('returns fallback when envelope is not an object', async () => {
    localStorage.setItem('k', JSON.stringify('not-an-object'))
    expect(await getJSON('k', 'fb')).toBe('fb')
  })
})
