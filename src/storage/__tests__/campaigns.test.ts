import { beforeEach, describe, expect, test } from 'vitest'
import { listCampaigns, recordCampaign, stripPayloadMedia } from '../campaigns'
import type { CampaignDraft } from '@/lib/types'

function draft(overrides: Partial<CampaignDraft> = {}): CampaignDraft {
  return {
    id: 'c1',
    sentBy: '',
    totalRecipients: 10,
    enabledRecipients: 8,
    invalidRecipients: 1,
    duplicateRecipients: 1,
    payload: { schema: 'vetcampaign/v1', recipients: [] },
    status: 'sent',
    errorMessage: null,
    ...overrides,
  }
}

beforeEach(() => {
  localStorage.clear()
})

describe('recordCampaign / listCampaigns', () => {
  test('persists a record and lists it newest first', async () => {
    await recordCampaign(draft({ id: 'c1' }))
    await recordCampaign(draft({ id: 'c2' }))
    const list = await listCampaigns()
    expect(list.map((r) => r.id)).toEqual(['c2', 'c1'])
    expect(list[0].createdAt).toBeTruthy()
  })

  test('respects the limit (most recent N)', async () => {
    for (let i = 0; i < 5; i++) {
      await recordCampaign(draft({ id: `c${i}` }))
    }
    const list = await listCampaigns(2)
    expect(list.map((r) => r.id)).toEqual(['c4', 'c3'])
  })

  test('returns empty list when nothing recorded', async () => {
    expect(await listCampaigns()).toEqual([])
  })

  test('keeps optional fields (mock, branch, sourceFile, excluded)', async () => {
    await recordCampaign(
      draft({
        mock: true,
        branch: 'Sede Norte',
        sourceFile: 'reporte.xlsx',
        excludedRecipients: 4,
      }),
    )
    const [only] = await listCampaigns()
    expect(only.mock).toBe(true)
    expect(only.branch).toBe('Sede Norte')
    expect(only.sourceFile).toBe('reporte.xlsx')
    expect(only.excludedRecipients).toBe(4)
  })
})

describe('stripPayloadMedia', () => {
  test('replaces image data URIs with a marker, keeps evidence', () => {
    const payload = {
      schema: 'vetcampaign/v1',
      media: {
        tpl1: { data: 'data:image/jpeg;base64,/9j/4AA…', mimetype: 'image/jpeg', fileName: 'promo.jpg' },
      },
      recipients: [{ id: 'r1', mediaKey: 'tpl1' }],
    }
    const out = stripPayloadMedia(payload) as typeof payload
    expect(out.media?.tpl1?.data).toBe('[stripped]')
    expect(out.media?.tpl1?.mimetype).toBe('image/jpeg')
    expect(out.media?.tpl1?.fileName).toBe('promo.jpg')
    expect(out.recipients).toBe(payload.recipients)
  })

  test('returns payload untouched when there is no media', () => {
    const payload = { schema: 'vetcampaign/v1' }
    expect(stripPayloadMedia(payload)).toBe(payload)
  })

  test('recorded payload has no base64 stored on disk', async () => {
    await recordCampaign(
      draft({
        payload: {
          media: { t: { data: 'data:image/png;base64,AAAA', mimetype: 'image/png' } },
        },
      }),
    )
    const raw = localStorage.getItem('vcm:campaigns:v1')
    expect(raw).not.toContain('base64')
    expect(raw).toContain('[stripped]')
  })
})
