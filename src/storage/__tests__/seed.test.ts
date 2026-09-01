import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { listCategories, listTemplates } from '../exports'
import { seedIfEmpty } from '../seed'
import { getSettings } from '../settings'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  localStorage.clear()
})

describe('seedIfEmpty', () => {
  test('seeds categories and a default template on first run', async () => {
    await seedIfEmpty()
    expect((await listCategories()).map((c) => c.name)).toEqual([
      'Vacuna',
      'Antipulgas',
      'Hidratación',
    ])
    const templates = await listTemplates()
    expect(templates).toHaveLength(1)
    expect(templates[0]).toMatchObject({
      name: 'Predeterminada',
      categoryId: null,
      isDefault: true,
    })
  })

  test('is idempotent — running it again does nothing', async () => {
    await seedIfEmpty()
    const cats1 = await listCategories()
    const tpls1 = await listTemplates()
    await seedIfEmpty()
    const cats2 = await listCategories()
    const tpls2 = await listTemplates()
    expect(cats1).toEqual(cats2)
    expect(tpls1).toEqual(tpls2)
  })

  test('does not touch the settings key', async () => {
    await seedIfEmpty()
    expect(await getSettings()).toEqual({
      webhookUrl: '',
      defaultCountryCode: '+51',
    })
  })
})
