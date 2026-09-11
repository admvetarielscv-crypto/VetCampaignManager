/**
 * Campaign history over localStorage. Same signatures as the Supabase
 * implementation (`storage/supabase/index.ts`) so the storage seam holds:
 * switching backends does not touch feature code.
 *
 * Quota note: each record stores the dispatch payload WITHOUT image data
 * URIs (see `stripPayloadMedia`) — images live on templates, and copying
 * the base64 (~150–300KB) into every record would exhaust the ~5MB browser
 * quota in a handful of campaigns. Text-only records weigh ~35KB for a
 * 150-recipient send.
 */
import { getJSON, setJSON } from './storage'
import { KEYS } from './keys'
import type { CampaignDraft, CampaignRecord } from '@/lib/types'

interface MediaSnapshot {
  data?: string
  mimetype?: string
  fileName?: string
}

interface PayloadSnapshot {
  media?: Record<string, MediaSnapshot>
}

/**
 * Replace image data URIs in a payload snapshot with a marker, keeping
 * `mimetype` + `fileName` as evidence. Pure: returns a shallow copy, never
 * mutates the caller's payload (which is still shown in the send UI).
 */
export function stripPayloadMedia(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') return payload
  const { media } = payload as PayloadSnapshot
  if (!media || typeof media !== 'object') return payload
  const stripped: Record<string, MediaSnapshot> = {}
  for (const [key, item] of Object.entries(media)) {
    stripped[key] = {
      mimetype: item?.mimetype,
      fileName: item?.fileName,
      data: '[stripped]',
    }
  }
  return { ...(payload as PayloadSnapshot), media: stripped }
}

export async function recordCampaign(record: CampaignDraft): Promise<void> {
  const list = await getJSON<CampaignRecord[]>(KEYS.campaigns, [])
  const full: CampaignRecord = {
    ...record,
    payload: stripPayloadMedia(record.payload),
    createdAt: new Date().toISOString(),
  }
  await setJSON(KEYS.campaigns, [full, ...list])
}

export async function listCampaigns(limit = 50): Promise<CampaignRecord[]> {
  const list = await getJSON<CampaignRecord[]>(KEYS.campaigns, [])
  return list.slice(0, Math.max(0, limit))
}
