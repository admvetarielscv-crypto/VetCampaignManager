import { beforeEach, describe, expect, test } from 'vitest'
import {
  deleteTemplate,
  getDefaultTemplate,
  getTemplateForCategory,
  listTemplates,
  makeTemplate,
  reassignTemplatesFromCategory,
  saveTemplate,
} from '../templates'

beforeEach(() => {
  localStorage.clear()
})

const base = {
  categoryId: null,
  name: 't',
  body: 'hola {{owner}}',
  isDefault: false,
}

describe('templates storage', () => {
  test('listTemplates returns [] on empty storage', async () => {
    expect(await listTemplates()).toEqual([])
  })

  test('saveTemplate enforces the one-default invariant', async () => {
    const a = makeTemplate({ ...base, name: 'A', isDefault: true })
    const b = makeTemplate({ ...base, name: 'B', isDefault: true })
    await saveTemplate(a)
    await saveTemplate(b)
    const list = await listTemplates()
    expect(list.filter((t) => t.isDefault).map((t) => t.name)).toEqual(['B'])
  })

  test('deleteTemplate removes by id', async () => {
    const a = makeTemplate({ ...base, name: 'A' })
    const b = makeTemplate({ ...base, name: 'B' })
    await saveTemplate(a)
    await saveTemplate(b)
    await deleteTemplate(a.id)
    const list = await listTemplates()
    expect(list.map((t) => t.name)).toEqual(['B'])
  })

  test('reassignTemplatesFromCategory binds the templates to Predeterminada', async () => {
    const t = makeTemplate({ ...base, categoryId: 'c1', name: 'Bound' })
    await saveTemplate(t)
    const reassigned = await reassignTemplatesFromCategory('c1')
    expect(reassigned).toEqual([t.id])
    const list = await listTemplates()
    expect(list[0].categoryId).toBeNull()
  })

  test('getDefaultTemplate returns the single isDefault template', async () => {
    const a = makeTemplate({ ...base, name: 'A', isDefault: true })
    const b = makeTemplate({ ...base, name: 'B' })
    await saveTemplate(a)
    await saveTemplate(b)
    const def = await getDefaultTemplate()
    expect(def?.name).toBe('A')
  })

  test('getTemplateForCategory finds by categoryId', async () => {
    const t = makeTemplate({ ...base, categoryId: 'c1', name: 'Bound' })
    await saveTemplate(t)
    const got = await getTemplateForCategory('c1')
    expect(got?.name).toBe('Bound')
    expect(await getTemplateForCategory('missing')).toBeUndefined()
  })
})
