/**
 * Pure campaign helpers: template resolution + message rendering.
 *
 * No React, no storage, no network. Reused by the campaign preview (Phase 3)
 * and the n8n payload builder (Phase 4).
 */
import type { Category, MessageTemplate, Recipient } from '@/lib/types'
import {
  contextFromRecipient,
  renderTemplate,
  type RenderResult,
} from '@/lib/template'

/**
 * Normalize a category-like string for tolerant matching:
 * lowercase, trim, strip accents/diacritics. Excel exports from VetPraxis
 * may carry accents ("Hidratación"); configured categories may not.
 */
export function normalizeCategoryName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/**
 * Resolve the template that applies for a given category name.
 * Order: exact category match → global default → undefined.
 * Matching is case- and accent-insensitive.
 */
export function resolveTemplateByCategoryName(
  categoryName: string,
  categories: Category[],
  templates: MessageTemplate[],
): MessageTemplate | undefined {
  const target = normalizeCategoryName(categoryName)
  const cat = categories.find(
    (c) => normalizeCategoryName(c.name) === target,
  )
  if (cat) {
    const bound = templates.find((t) => t.categoryId === cat.id)
    if (bound) return bound
  }
  return templates.find((t) => t.isDefault)
}

/** Resolve the template that applies for a given recipient's category. */
export function resolveTemplateForRecipient(
  recipient: Recipient,
  categories: Category[],
  templates: MessageTemplate[],
): MessageTemplate | undefined {
  return resolveTemplateByCategoryName(
    recipient.category,
    categories,
    templates,
  )
}

export interface RecipientMessage {
  text: string
  template?: MessageTemplate
  unknown: string[]
  empty: string[]
}

/**
 * Render the final WhatsApp message for a recipient, using the template
 * that applies for their category (or the default fallback).
 */
export function renderMessageForRecipient(
  recipient: Recipient,
  categories: Category[],
  templates: MessageTemplate[],
): RecipientMessage {
  const template = resolveTemplateForRecipient(recipient, categories, templates)
  if (!template) {
    return { text: '', unknown: [], empty: [] }
  }
  const result: RenderResult = renderTemplate(
    template.body,
    contextFromRecipient(recipient),
  )
  return {
    text: result.text,
    template,
    unknown: result.unknown,
    empty: result.empty,
  }
}

/**
 * Default "enabled" state per recipient. Valid phones default to on;
 * duplicates and invalid phones default to off. The receptionist can toggle
 * each row in the preview. (Pure helper; the store persists the overrides.)
 */
export function defaultEnabledFor(recipient: Recipient): boolean {
  return recipient.phoneStatus === 'valid'
}

export interface SendableRecipient {
  recipient: Recipient
  message: RecipientMessage
}

/**
 * Build the final list of recipients to actually send to, given the user's
 * enable/disable overrides. Used by the send screen (Phase 4) and the
 * preview's "to send" count.
 */
export function buildSendableRecipients(
  recipients: Recipient[],
  categories: Category[],
  templates: MessageTemplate[],
  enabled: Record<string, boolean>,
): SendableRecipient[] {
  const out: SendableRecipient[] = []
  for (const r of recipients) {
    const isOn = enabled[r.id] ?? defaultEnabledFor(r)
    if (!isOn) continue
    if (r.phoneStatus === 'invalid') continue
    const message = renderMessageForRecipient(r, categories, templates)
    if (!message.template) continue
    out.push({ recipient: r, message })
  }
  return out
}

/** Count by status (used by the preview header chips). */
export function countByStatus(recipients: Recipient[]): {
  total: number
  valid: number
  invalid: number
  duplicate: number
} {
  return {
    total: recipients.length,
    valid: recipients.filter((r) => r.phoneStatus === 'valid').length,
    invalid: recipients.filter((r) => r.phoneStatus === 'invalid').length,
    duplicate: recipients.filter((r) => r.phoneStatus === 'duplicate').length,
  }
}

// ── n8n payload contract ──────────────────────────────────────────────────────

/**
 * An image attached to a template, as sent to n8n → Evolution API
 * `sendMedia`. The `data` is a data URI (base64) so no public hosting is
 * needed; n8n passes it through as the `media` field.
 */
export interface N8nMediaItem {
  data: string
  mimetype: string
  fileName: string
}

/**
 * The payload posted to the n8n webhook. Versioned via `schema` so the n8n
 * workflow can route on schema in the future without breaking older flows.
 *
 * Each recipient carries the fully-rendered message so n8n / Evolution API
 * just forwards it. The per-recipient `id` lets future delivery reports join
 * back to a Supabase `deliveries` table.
 *
 * Media is deduplicated: images live once in the campaign-level `media` map
 * (keyed by template id); recipients reference them via `mediaKey`. Absent
 * when no recipient's template has an attached image.
 */
export interface N8nCampaignPayload {
  schema: string
  campaign: {
    id: string
    sentAt: string
    source: string
    /** Open slot for future fields (branchId, scheduledFor, …) without breaking. */
    [key: string]: unknown
  }
  media?: Record<string, N8nMediaItem>
  recipients: Array<{
    id: string
    owner: string
    pet: string
    phone: string
    category: string
    message: string
    /** Key into `media` when this recipient's template has an attached image. */
    mediaKey?: string
  }>
}

export interface BuildPayloadOptions {
  /** Bumped per-call id for the campaign (caller passes nanoid or similar). */
  campaignId: string
  /** ISO timestamp; defaults to now when omitted. */
  sentAt?: string
  /** Source label; defaults to the app constant. */
  source?: string
  /** Schema label; defaults to the app constant. */
  schema?: string
}

/**
 * Build the n8n webhook payload from a campaign session. Pure: takes the
 * already-built sendable list and freezes the envelope. The same function
 * can run later inside a Supabase edge function that signs the call.
 */
export function buildCampaignPayload(
  sendable: SendableRecipient[],
  opts: BuildPayloadOptions,
): N8nCampaignPayload {
  const media: Record<string, N8nMediaItem> = {}
  for (const { message } of sendable) {
    const m = message.template?.media
    if (m && message.template && !media[message.template.id]) {
      media[message.template.id] = {
        data: m.data,
        mimetype: m.mimetype,
        fileName: m.fileName,
      }
    }
  }
  const hasMedia = Object.keys(media).length > 0

  return {
    schema: opts.schema ?? 'vetcampaign/v1',
    campaign: {
      id: opts.campaignId,
      sentAt: opts.sentAt ?? new Date().toISOString(),
      source: opts.source ?? 'VetCampaignManager',
    },
    ...(hasMedia ? { media } : {}),
    recipients: sendable.map(({ recipient, message }) => ({
      id: recipient.id,
      owner: recipient.owner,
      pet: recipient.pet,
      phone: recipient.normalizedPhone ?? recipient.rawPhone,
      category: recipient.category,
      message: message.text,
      ...(message.template?.media ? { mediaKey: message.template.id } : {}),
    })),
  }
}