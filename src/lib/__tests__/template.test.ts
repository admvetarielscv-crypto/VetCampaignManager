import { describe, expect, test } from 'vitest'
import {
  DEMO_CONTEXT,
  extractVariables,
  renderTemplate,
} from '../template'

describe('renderTemplate', () => {
  test('replaces known variables with their resolved values', () => {
    const r = renderTemplate('Hola {{owner}} y {{pet}}', DEMO_CONTEXT)
    expect(r.text).toBe('Hola María y Rocky')
    expect(r.used.sort()).toEqual(['owner', 'pet'])
    expect(r.unknown).toEqual([])
    expect(r.empty).toEqual([])
  })

  test('reports unknown variables and leaves them in the text', () => {
    const r = renderTemplate('Hola {{owner}} ({{clinic}})', DEMO_CONTEXT)
    expect(r.text).toBe('Hola María ({{clinic}})')
    expect(r.unknown).toEqual(['clinic'])
  })

  test('reports known variables that resolve to empty', () => {
    const r = renderTemplate('Hola {{owner}} ({{pet}})', {
      ...DEMO_CONTEXT,
      pet: '',
    })
    expect(r.text).toBe('Hola María ()')
    expect(r.empty).toEqual(['pet'])
  })

  test('tolerates whitespace inside the braces', () => {
    const r = renderTemplate('{{ owner }} y {{  pet }}', DEMO_CONTEXT)
    expect(r.text).toBe('María y Rocky')
  })
})

describe('extractVariables', () => {
  test('returns unique referenced variable keys', () => {
    const keys = extractVariables('{{owner}} {{pet}} {{owner}} {{x}}')
    expect(keys.sort()).toEqual(['owner', 'pet', 'x'])
  })

  test('ignores malformed tokens', () => {
    const keys = extractVariables('{{}} {{  }} {{1bad}} {{owner}}')
    expect(keys).toEqual(['owner'])
  })
})
