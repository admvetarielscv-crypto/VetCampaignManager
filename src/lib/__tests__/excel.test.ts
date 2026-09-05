import { describe, expect, test } from 'vitest'
import { cleanPetName } from '../excel'

describe('cleanPetName', () => {
  test.each([
    ['MAXI #', 'MAXI'],
    ['DOKY#', 'DOKY'],
    ['FIRULAIS*', 'FIRULAIS'],
    ['ROCO%', 'ROCO'],
    ['ROCO (muerde)', 'ROCO'],
    ['ROCO(muerde)', 'ROCO'],
    ['ROCO (muerde', 'ROCO'],
    ['MAXI (', 'MAXI'],
    ['BOLILLO (muerde) #', 'BOLILLO'],
    ['MAX', 'MAX'],
  ])('cleanPetName(%j) -> %j', (input, expected) => {
    expect(cleanPetName(input)).toBe(expected)
  })
})
