/**
 * Domain types shared across the campaign lifecycle.
 * Pure data: no React, no storage, no network.
 */

export type PhoneStatus = 'valid' | 'invalid' | 'duplicate'

export interface Recipient {
  /** Stable client-side id (nanoid) — Supabase-row-compatible later. */
  id: string
  /** 1-based row number within the source sheet (for error reporting). */
  rowNumber: number
  owner: string
  /** Pet name with trailing '#' artifact stripped. */
  pet: string
  /** Raw phone field from the Excel (may contain several numbers + annotations). */
  rawPhone: string
  /** E.164-like normalized phone of the chosen number, if any valid found. */
  normalizedPhone?: string
  category: string
  phoneStatus: PhoneStatus
  /** Short reason when invalid/duplicate, omit when valid. */
  issue?: string
}

export interface ImportError {
  /** 1-based row number when the error is row-specific. */
  row?: number
  /** Column header name when the error is column-specific. */
  field?: string
  message: string
}

export interface CategoryCount {
  name: string
  count: number
}

export interface ImportResult {
  recipients: Recipient[]
  /** Workbook/structure-level errors (sheet not found, required column missing). */
  errors: ImportError[]
  totals: {
    totalRows: number
    valid: number
    invalid: number
    duplicate: number
  }
  detectedCategories: CategoryCount[]
}

// ── Settings: categories, templates, app config ───────────────────────────────

export interface Category {
  /** Stable client-side id (nanoid). */
  id: string
  /** Display name, e.g. "Vacuna". */
  name: string
}

/**
 * Image attached to a template. Stored locally as a data URI (base64) so the
 * payload can carry the actual image to n8n → Evolution API `sendMedia`
 * without needing any public hosting. Recipients receive the real image in
 * WhatsApp, never a URL.
 */
export interface TemplateMedia {
  /** Data URI, e.g. `data:image/jpeg;base64,...`. */
  data: string
  /** MIME type of the encoded image (post-resize), e.g. `image/jpeg`. */
  mimetype: string
  /** Original file name, kept for display and Evolution API `fileName`. */
  fileName: string
  /** Approximate byte size of the data URI payload. */
  bytes: number
}

export interface MessageTemplate {
  /** Stable client-side id (nanoid). */
  id: string
  /**
   * Associated category id, or null for the default fallback template.
   * At most one template per category; exactly one default overall.
   */
  categoryId: string | null
  /** Human label for the editor list, e.g. "Recordatorio vacuna". */
  name: string
  /** Body with {{owner}}, {{pet}}, {{category}} placeholders. */
  body: string
  /** True when this is the global default fallback template. */
  isDefault: boolean
  /** Optional image sent alongside the message (message becomes the caption). */
  media?: TemplateMedia | null
}

export interface AppSettings {
  /** n8n webhook URL (empty = mock mode in Phase 4). */
  webhookUrl: string
  /** Default country code for phone normalization, e.g. "+51" (Peru). */
  defaultCountryCode: string
  /** HMAC secret for signing n8n payloads. Supabase mode only. */
  hmacSecret?: string
  /**
   * Branch (sede) label captured on every campaign record. Free text for now:
   * single-clinic MVP, forward-compatible with a future `branches` table.
   */
  branchName?: string
}

// ── Campaign history ──────────────────────────────────────────────────────────

/**
 * Historical record of one dispatch. Persisted by the storage layer
 * (localStorage now, Supabase `campaigns` table later — same shape).
 * In localStorage mode the persisted `payload` strips image data URIs
 * (media.data) to stay far below the ~5MB browser quota; the image itself
 * lives on the template.
 */
export interface CampaignRecord {
  id: string
  /** Auth user id (Supabase mode); empty string in localStorage mode. */
  sentBy: string
  totalRecipients: number
  enabledRecipients: number
  invalidRecipients: number
  duplicateRecipients: number
  payload: unknown
  status: 'sent' | 'failed'
  errorMessage: string | null
  /** ISO timestamp, set by the storage layer at insert time. */
  createdAt: string
  /** Valid recipients not sent (manually disabled by the receptionist). */
  excludedRecipients?: number
  /** True for demo/test sends (mock webhook); real stats exclude these. */
  mock?: boolean
  /** Branch (sede) label captured from settings at send time. */
  branch?: string
  /** Source Excel file name. */
  sourceFile?: string
}

/** A campaign record as passed by the send flow, before `createdAt` is set. */
export type CampaignDraft = Omit<CampaignRecord, 'createdAt'>