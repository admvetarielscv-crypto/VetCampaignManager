import { describe, expect, test } from 'vitest'
import {
  buildCampaignPayload,
  buildSendableRecipients,
  countByStatus,
  daysSince,
  defaultEnabledFor,
  normalizeCategoryName,
  recentlyContacted,
  resolveTemplateByCategoryName,
  RECONTACT_DAYS,
} from '../campaign'
import type { Category, MessageTemplate, Recipient } from '../types'

const mkRecipient = (over: Partial<Recipient> = {}): Recipient => ({
  id: 'r1',
  rowNumber: 2,
  owner: 'María',
  pet: 'Rocky',
  rawPhone: '+51 - 980000000',
  normalizedPhone: '+51980000000',
  category: 'Vacuna',
  phoneStatus: 'valid',
  ...over,
})

const cats: Category[] = [
  { id: 'c1', name: 'Vacuna' },
  { id: 'c2', name: 'Hidratación' },
]

const templates: MessageTemplate[] = [
  {
    id: 't-vac',
    categoryId: 'c1',
    name: 'Vacuna',
    body: 'Hola {{owner}}, cita de {{category}} para {{pet}}',
    isDefault: false,
  },
  {
    id: 't-hid',
    categoryId: 'c2',
    name: 'Hidratación',
    body: 'Hola {{owner}}, hidrata a {{pet}}',
    isDefault: false,
  },
  {
    id: 't-def',
    categoryId: null,
    name: 'Predeterminada',
    body: 'Hola {{owner}} por defecto',
    isDefault: true,
  },
]

describe('normalizeCategoryName', () => {
  test('lowercases, trims and strips accents', () => {
    expect(normalizeCategoryName('  Hidratación ')).toBe('hidratacion')
    expect(normalizeCategoryName('VACUNA')).toBe('vacuna')
  })
})

describe('resolveTemplateByCategoryName', () => {
  test('prefers an exact category match over the global default', () => {
    const t = resolveTemplateByCategoryName('Vacuna', cats, templates)
    expect(t?.id).toBe('t-vac')
  })

  test('matches categories tolerantly (case + accents)', () => {
    expect(resolveTemplateByCategoryName('vacuna', cats, templates)?.id).toBe(
      't-vac',
    )
    expect(
      resolveTemplateByCategoryName('HIDRATACIÓN', cats, templates)?.id,
    ).toBe('t-hid')
  })

  test('falls back to the global default when no category match exists', () => {
    const t = resolveTemplateByCategoryName('Desparasitación', cats, templates)
    expect(t?.id).toBe('t-def')
  })

  test('returns undefined when there is no default and no match', () => {
    const t = resolveTemplateByCategoryName(
      'Desparasitación',
      cats,
      templates.filter((x) => !x.isDefault),
    )
    expect(t).toBeUndefined()
  })
})

describe('buildSendableRecipients', () => {
  test('keeps only enabled valid recipients and renders the resolved template', () => {
    const recipients = [
      mkRecipient({ id: '1', category: 'Vacuna' }),
      mkRecipient({ id: '2', category: 'HIDRATACIÓN' }),
      mkRecipient({ id: '3', category: 'Vacuna', phoneStatus: 'invalid' }),
      mkRecipient({ id: '4', category: 'Vacuna' }),
    ]
    const enabled = { '1': true, '2': true, '3': true, '4': false }
    const out = buildSendableRecipients(recipients, cats, templates, enabled)
    expect(out.map((s) => s.recipient.id)).toEqual(['1', '2'])
    expect(out[0].message.text).toBe('Hola María, cita de Vacuna para Rocky')
    expect(out[1].message.text).toBe('Hola María, hidrata a Rocky')
  })

  test('defaults an un-toggled recipient to enabled iff phoneStatus is valid', () => {
    const recipients = [
      mkRecipient({ id: '1' }),
      mkRecipient({ id: '2', phoneStatus: 'duplicate' }),
    ]
    const out = buildSendableRecipients(recipients, cats, templates, {})
    expect(out.map((s) => s.recipient.id)).toEqual(['1'])
  })
})

describe('buildCampaignPayload', () => {
  test('maps sendable list to payload recipients with rendered messages', () => {
    const r1 = mkRecipient({ id: '1', owner: 'María', pet: 'Rocky' })
    const sendable = buildSendableRecipients([r1], cats, templates, { '1': true })
    const payload = buildCampaignPayload(sendable, {
      campaignId: 'C',
      sentAt: '2026-01-01T00:00:00.000Z',
      source: 'Test',
      schema: 'vetcampaign/v1',
    })
    expect(payload.campaign).toEqual({
      id: 'C',
      sentAt: '2026-01-01T00:00:00.000Z',
      source: 'Test',
    })
    expect(payload.recipients).toHaveLength(1)
    expect(payload.recipients[0]).toMatchObject({
      id: '1',
      owner: 'María',
      pet: 'Rocky',
      phone: '+51980000000',
      category: 'Vacuna',
      message: 'Hola María, cita de Vacuna para Rocky',
    })
  })

  test('falls back to rawPhone when normalized is missing', () => {
    const r1 = mkRecipient({ id: '1', normalizedPhone: undefined })
    const sendable = buildSendableRecipients([r1], cats, templates, { '1': true })
    const payload = buildCampaignPayload(sendable, { campaignId: 'C' })
    expect(payload.recipients[0].phone).toBe('+51 - 980000000')
  })

  test('omits media when no template carries an image', () => {
    const r1 = mkRecipient({ id: '1', category: 'Vacuna' })
    const sendable = buildSendableRecipients([r1], cats, templates, { '1': true })
    const payload = buildCampaignPayload(sendable, { campaignId: 'C' })
    expect(payload.media).toBeUndefined()
    expect(payload.recipients[0].mediaKey).toBeUndefined()
  })

  test('includes campaign-level media map and per-recipient mediaKey', () => {
    const withImage = templates.map((t) =>
      t.id === 't-vac'
        ? {
            ...t,
            media: {
              data: 'data:image/jpeg;base64,QUJD',
              mimetype: 'image/jpeg',
              fileName: 'vacuna.jpg',
              bytes: 3,
            },
          }
        : t,
    )
    const recipients = [
      mkRecipient({ id: '1', category: 'Vacuna' }),
      mkRecipient({ id: '2', category: 'Vacuna' }),
      mkRecipient({ id: '3', category: 'Hidratación' }),
    ]
    const sendable = buildSendableRecipients(recipients, cats, withImage, {
      '1': true,
      '2': true,
      '3': true,
    })
    const payload = buildCampaignPayload(sendable, { campaignId: 'C' })

    expect(payload.media).toEqual({
      't-vac': {
        data: 'data:image/jpeg;base64,QUJD',
        mimetype: 'image/jpeg',
        fileName: 'vacuna.jpg',
      },
    })
    expect(payload.recipients[0].mediaKey).toBe('t-vac')
    expect(payload.recipients[1].mediaKey).toBe('t-vac')
    expect(payload.recipients[2].mediaKey).toBeUndefined()
  })
})

describe('countByStatus', () => {
  test('returns counts per phoneStatus', () => {
    const r: Recipient[] = [
      mkRecipient({ id: '1', phoneStatus: 'valid' }),
      mkRecipient({ id: '2', phoneStatus: 'valid' }),
      mkRecipient({ id: '3', phoneStatus: 'duplicate' }),
      mkRecipient({ id: '4', phoneStatus: 'invalid' }),
    ]
    expect(countByStatus(r)).toEqual({
      total: 4,
      valid: 2,
      duplicate: 1,
      invalid: 1,
    })
  })
})

// ── Contact ledger guard (S2) ─────────────────────────────────────────────────

// Fixed "now" so day math is deterministic.
const NOW = new Date('2026-09-12T12:00:00.000Z')

describe('daysSince', () => {
  test('whole days elapsed', () => {
    expect(daysSince('2026-09-12T06:00:00.000Z', NOW)).toBe(0) // same day
    expect(daysSince('2026-09-05T12:00:00.000Z', NOW)).toBe(7)
    expect(daysSince('2026-09-01T12:00:00.000Z', NOW)).toBe(11)
  })

  test('invalid date → null', () => {
    expect(daysSince('not-a-date', NOW)).toBeNull()
  })
})

describe('recentlyContacted', () => {
  test('within the window', () => {
    const days = RECONTACT_DAYS - 1
    const at = new Date(NOW.getTime() - days * 86_400_000).toISOString()
    expect(
      recentlyContacted(
        mkRecipient({ contactState: { lastContactedAt: at, doNotContact: false } }),
        NOW,
      ),
    ).toBe(true)
  })

  test('outside the window', () => {
    const at = new Date(NOW.getTime() - (RECONTACT_DAYS + 5) * 86_400_000).toISOString()
    expect(
      recentlyContacted(
        mkRecipient({ contactState: { lastContactedAt: at, doNotContact: false } }),
        NOW,
      ),
    ).toBe(false)
  })

  test('no ledger state → not recently contacted', () => {
    expect(recentlyContacted(mkRecipient(), NOW)).toBe(false)
  })
})

describe('defaultEnabledFor with the contact ledger', () => {
  test('valid without ledger state → enabled', () => {
    expect(defaultEnabledFor(mkRecipient(), NOW)).toBe(true)
  })

  test('invalid/duplicate → disabled', () => {
    expect(defaultEnabledFor(mkRecipient({ phoneStatus: 'invalid' }), NOW)).toBe(false)
    expect(defaultEnabledFor(mkRecipient({ phoneStatus: 'duplicate' }), NOW)).toBe(false)
  })

  test('recently contacted by this branch → disabled by default', () => {
    const at = new Date(NOW.getTime() - 2 * 86_400_000).toISOString()
    expect(
      defaultEnabledFor(
        mkRecipient({ contactState: { lastContactedAt: at, doNotContact: false } }),
        NOW,
      ),
    ).toBe(false)
  })

  test('contacted long ago → enabled again', () => {
    const at = new Date(NOW.getTime() - 30 * 86_400_000).toISOString()
    expect(
      defaultEnabledFor(
        mkRecipient({ contactState: { lastContactedAt: at, doNotContact: false } }),
        NOW,
      ),
    ).toBe(true)
  })

  test('NO CONTACTAR → disabled even when contacted long ago', () => {
    const at = new Date(NOW.getTime() - 30 * 86_400_000).toISOString()
    expect(
      defaultEnabledFor(
        mkRecipient({ contactState: { lastContactedAt: at, doNotContact: true } }),
        NOW,
      ),
    ).toBe(false)
  })
})
