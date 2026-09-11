import { describe, expect, test } from 'vitest'
import {
  aggregateCampaigns,
  groupByBranch,
  groupByMonth,
  isRealCampaign,
  monthKey,
  monthLabel,
  type MonthBucket,
} from '../stats'
import type { CampaignRecord } from '../types'

function record(overrides: Partial<CampaignRecord> = {}): CampaignRecord {
  return {
    id: 'r1',
    sentBy: '',
    totalRecipients: 10,
    enabledRecipients: 8,
    invalidRecipients: 1,
    duplicateRecipients: 1,
    payload: {},
    status: 'sent',
    errorMessage: null,
    createdAt: '2026-09-10T12:00:00.000Z',
    ...overrides,
  }
}

describe('isRealCampaign', () => {
  test('mock sends are not real', () => {
    expect(isRealCampaign(record({ mock: true }))).toBe(false)
    expect(isRealCampaign(record())).toBe(true)
  })
})

describe('aggregateCampaigns', () => {
  test('sums real sends and ignores demo sends', () => {
    const totals = aggregateCampaigns([
      record(),
      record({ id: 'r2', enabledRecipients: 12 }),
      record({ id: 'r3', mock: true, enabledRecipients: 100 }),
    ])
    expect(totals.campaigns).toBe(2)
    expect(totals.messages).toBe(20)
    expect(totals.invalid).toBe(2)
    expect(totals.duplicate).toBe(2)
    expect(totals.excluded).toBe(0)
  })

  test('failed campaigns contribute 0 messages but keep import counters', () => {
    const totals = aggregateCampaigns([
      record(),
      record({ id: 'r2', status: 'failed', enabledRecipients: 8, excludedRecipients: 3 }),
    ])
    expect(totals.messages).toBe(8)
    expect(totals.excluded).toBe(3)
    expect(totals.campaigns).toBe(2)
  })

  test('excluded defaults to 0 for legacy records', () => {
    expect(aggregateCampaigns([record()]).excluded).toBe(0)
  })
})

describe('monthKey / monthLabel', () => {
  test('key is YYYY-MM local', () => {
    expect(monthKey('2026-09-10T12:00:00.000Z')).toBe('2026-09')
    expect(monthKey('not-a-date')).toBe('')
  })

  test('label is human readable', () => {
    expect(monthLabel('2026-09')).toMatch(/2026/)
  })
})

describe('groupByMonth', () => {
  test('zero-fills missing months and orders oldest first', () => {
    const now = new Date()
    const thisMonth = `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, '0')}`
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonth = `${prev.getFullYear()}-${`${prev.getMonth() + 1}`.padStart(2, '0')}`

    const buckets: MonthBucket[] = groupByMonth([
      record({ createdAt: `${thisMonth}-15T10:00:00.000Z`, enabledRecipients: 5 }),
      record({ createdAt: `${lastMonth}-05T10:00:00.000Z`, enabledRecipients: 3 }),
      record({ mock: true, createdAt: `${thisMonth}-16T10:00:00.000Z` }),
    ], 2)

    expect(buckets.map((b) => b.key)).toEqual([lastMonth, thisMonth])
    expect(buckets[0].totals.messages).toBe(3)
    expect(buckets[1].totals.messages).toBe(5)
    expect(buckets[1].totals.campaigns).toBe(1)
  })

  test('ignores records older than the window', () => {
    const buckets = groupByMonth(
      [record({ createdAt: '2020-01-01T00:00:00.000Z' })],
      2,
    )
    expect(buckets.every((b) => b.totals.campaigns === 0)).toBe(true)
  })
})

describe('groupByBranch', () => {
  test('groups by branch label, records without branch fall into Sin sede', () => {
    const buckets = groupByBranch([
      record({ branch: 'Sede Norte', enabledRecipients: 5 }),
      record({ branch: 'Sede Norte', enabledRecipients: 7 }),
      record({ enabledRecipients: 9 }),
    ])
    expect(buckets).toHaveLength(2)
    const norte = buckets.find((b) => b.branch === 'Sede Norte')
    expect(norte?.totals.campaigns).toBe(2)
    expect(norte?.totals.messages).toBe(12)
    const sinSede = buckets.find((b) => b.branch === 'Sin sede')
    expect(sinSede?.totals.messages).toBe(9)
  })

  test('sorts by messages descending', () => {
    const buckets = groupByBranch([
      record({ branch: 'Chica', enabledRecipients: 1 }),
      record({ branch: 'Grande', enabledRecipients: 50 }),
    ])
    expect(buckets[0].branch).toBe('Grande')
  })
})
