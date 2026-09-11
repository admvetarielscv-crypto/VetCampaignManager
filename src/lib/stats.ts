/**
 * Pure campaign-history aggregations. No React, no storage, no network.
 *
 * All functions filter out demo sends (`mock === true`) so dashboards report
 * real numbers only. Failed campaigns count as 0 messages (nothing left the
 * webhook), but their import-time counters (invalid/duplicate/excluded) still
 * reflect the work done and are included.
 */
import type { CampaignRecord } from './types'

export interface CampaignTotals {
  campaigns: number
  /** Messages dispatched (enabled recipients of successful sends). */
  messages: number
  invalid: number
  duplicate: number
  excluded: number
}

export function isRealCampaign(r: CampaignRecord): boolean {
  return !r.mock
}

export function aggregateCampaigns(records: CampaignRecord[]): CampaignTotals {
  const real = records.filter(isRealCampaign)
  const sum = (pick: (r: CampaignRecord) => number) =>
    real.reduce((acc, r) => acc + pick(r), 0)
  return {
    campaigns: real.length,
    messages: sum((r) => (r.status === 'sent' ? r.enabledRecipients : 0)),
    invalid: sum((r) => r.invalidRecipients),
    duplicate: sum((r) => r.duplicateRecipients),
    excluded: sum((r) => r.excludedRecipients ?? 0),
  }
}

/** 'YYYY-MM' in the browser's local timezone. */
export function monthKey(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  return `${y}-${m}`
}

/** Human label for a 'YYYY-MM' key, e.g. "sep 2026". */
export function monthLabel(key: string): string {
  if (!/^\d{4}-\d{2}$/.test(key)) return key
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  const label = d.toLocaleDateString('es-PE', { month: 'short', year: 'numeric' })
  return label.replace('.', '').replace(' de ', ' ')
}

export interface MonthBucket {
  key: string
  label: string
  totals: CampaignTotals
}

/**
 * Group real campaigns into the last `lastN` months (current month included),
 * zero-filled, ordered oldest → newest.
 */
export function groupByMonth(
  records: CampaignRecord[],
  lastN = 2,
): MonthBucket[] {
  const now = new Date()
  const keys: string[] = []
  for (let i = lastN - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const y = d.getFullYear()
    const m = `${d.getMonth() + 1}`.padStart(2, '0')
    keys.push(`${y}-${m}`)
  }
  const byMonth = new Map<string, CampaignRecord[]>()
  for (const r of records.filter(isRealCampaign)) {
    const key = monthKey(r.createdAt)
    if (!keys.includes(key)) continue
    const bucket = byMonth.get(key) ?? []
    bucket.push(r)
    byMonth.set(key, bucket)
  }
  return keys.map((key) => ({
    key,
    label: monthLabel(key),
    totals: aggregateCampaigns(byMonth.get(key) ?? []),
  }))
}

export interface BranchBucket {
  branch: string
  totals: CampaignTotals
}

/**
 * Group real campaigns by branch (sede). Records without a branch label fall
 * into "Sin sede". Ordered by messages, descending.
 */
export function groupByBranch(records: CampaignRecord[]): BranchBucket[] {
  const byBranch = new Map<string, CampaignRecord[]>()
  for (const r of records.filter(isRealCampaign)) {
    const branch = r.branch?.trim() || 'Sin sede'
    const bucket = byBranch.get(branch) ?? []
    bucket.push(r)
    byBranch.set(branch, bucket)
  }
  return [...byBranch.entries()]
    .map(([branch, recs]) => ({ branch, totals: aggregateCampaigns(recs) }))
    .sort((a, b) => b.totals.messages - a.totals.messages)
}
