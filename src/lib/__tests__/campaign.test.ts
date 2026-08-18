import { describe, expect, test } from 'vitest'
import {
  buildCampaignPayload,
  buildSendableRecipients,
  countByStatus,
  normalizeCategoryName,
  resolveTemplateByCategoryName,
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
