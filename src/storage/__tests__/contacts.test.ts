import { beforeEach, describe, expect, test } from 'vitest'
import { findContactStates, markContacted } from '../contacts'

beforeEach(() => {
  localStorage.clear()
})

describe('contact ledger (localStorage)', () => {
  test('unknown phones → empty map', async () => {
    const states = await findContactStates(['+51987654321'])
    expect(states.size).toBe(0)
  })

  test('markContacted records last_contacted_at, idempotent per phone', async () => {
    await markContacted([
      { phone: '+51987654321', ownerName: 'María', petName: 'Rocko' },
    ])
    let states = await findContactStates(['+51987654321'])
    const first = states.get('+51987654321')
    expect(first?.lastContactedAt).toBeTruthy()
    expect(first?.doNotContact).toBe(false)

    // Second send to the same phone: still ONE record, refreshed timestamp.
    await markContacted([
      { phone: '+51987654321', ownerName: 'María', petName: 'Rocko' },
    ])
    states = await findContactStates(['+51987654321'])
    const second = states.get('+51987654321')
    expect(second?.lastContactedAt).toBeTruthy()
    expect(
      new Date(second?.lastContactedAt ?? 0).getTime(),
    ).toBeGreaterThanOrEqual(new Date(first?.lastContactedAt ?? 0).getTime())
  })

  test('blank names do not overwrite existing ones', async () => {
    await markContacted([
      { phone: '+51987654321', ownerName: 'María', petName: 'Rocko' },
    ])
    await markContacted([{ phone: '+51987654321', ownerName: '', petName: '' }])
    const raw = localStorage.getItem('vcm:contacts:v1')
    expect(raw).toContain('María')
  })
})
