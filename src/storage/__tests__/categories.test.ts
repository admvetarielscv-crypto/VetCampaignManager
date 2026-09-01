import { beforeEach, describe, expect, test } from 'vitest'
import {
  deleteCategory,
  findCategoryByName,
  listCategories,
  makeCategory,
  saveCategory,
} from '../categories'

beforeEach(() => {
  localStorage.clear()
})

describe('categories storage', () => {
  test('listCategories returns [] on empty storage', async () => {
    expect(await listCategories()).toEqual([])
  })

  test('saveCategory appends and updates by id', async () => {
    const c1 = makeCategory('Vacuna')
    await saveCategory(c1)
    expect((await listCategories()).map((c) => c.name)).toEqual(['Vacuna'])

    const renamed = { ...c1, name: 'Vacunas' }
    await saveCategory(renamed)
    const list = await listCategories()
    expect(list).toHaveLength(1)
    expect(list[0].name).toBe('Vacunas')
  })

  test('deleteCategory removes by id', async () => {
    const c1 = makeCategory('Vacuna')
    const c2 = makeCategory('Antipulgas')
    await saveCategory(c1)
    await saveCategory(c2)
    await deleteCategory(c1.id)
    expect((await listCategories()).map((c) => c.name)).toEqual(['Antipulgas'])
  })

  test('findCategoryByName is case- and whitespace-insensitive', async () => {
    await saveCategory(makeCategory('Vacuna'))
    const got = await findCategoryByName('  VACUNA  ')
    expect(got?.name).toBe('Vacuna')
    expect(await findCategoryByName('NoExiste')).toBeUndefined()
  })
})
