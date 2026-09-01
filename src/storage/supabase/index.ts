/**
 * Supabase-backed storage. Same async signatures as the localStorage layer
 * (`storage/categories.ts`, `storage/templates.ts`, `storage/settings.ts`),
 * so feature code is identical regardless of backend.
 *
 * Tenant isolation is enforced at the database level via RLS policies
 * (see `supabase/migrations/0001_init_schema.sql`). Each query is implicitly
 * scoped to tenants the current user belongs to.
 */
import { newId } from '@/lib/id'
import { requireSupabase } from '@/integrations/supabase'
import { useTenantStore } from '@/shared/stores/tenantStore'
import type { Category, MessageTemplate } from '@/lib/types'

/**
 * Returns the current tenant id from the tenant store. Throws if there is no
 * active tenant — callers should ensure `hydrate()` has completed first.
 */
function tenantId(): string {
  const id = useTenantStore.getState().currentTenantId
  if (!id) {
    throw new Error('No hay tenant activo. Inicia sesión y selecciona una clínica.')
  }
  return id
}

// ── Categories ────────────────────────────────────────────────────────────────

export async function listCategories(): Promise<Category[]> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('categories')
    .select('id, name')
    .eq('tenant_id', tenantId())
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function saveCategory(c: Category): Promise<Category> {
  const sb = requireSupabase()
  const { error } = await sb
    .from('categories')
    .upsert({ id: c.id, tenant_id: tenantId(), name: c.name })
    .select('id, name')
    .single()
  if (error) throw error
  return c
}

export async function deleteCategory(id: string): Promise<void> {
  const sb = requireSupabase()
  const { error } = await sb.from('categories').delete().eq('id', id)
  if (error) throw error
}

export async function findCategoryByName(
  name: string,
): Promise<Category | undefined> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('categories')
    .select('id, name')
    .eq('tenant_id', tenantId())
    .ilike('name', name.trim())
    .maybeSingle()
  if (error) throw error
  return data ?? undefined
}

export function makeCategory(name: string): Category {
  return { id: newId(), name: name.trim() }
}

// ── Templates ────────────────────────────────────────────────────────────────

export async function listTemplates(): Promise<MessageTemplate[]> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('message_templates')
    .select('id, category_id, name, body, is_default')
    .eq('tenant_id', tenantId())
    .order('is_default', { ascending: false })
    .order('name')
  if (error) throw error
  return (data ?? []).map((row) => ({
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    body: row.body,
    isDefault: row.is_default,
  }))
}

export async function saveTemplate(t: MessageTemplate): Promise<MessageTemplate> {
  const sb = requireSupabase()
  const tid = tenantId()

  // If this template is the new default, clear the default flag on any other
  // template first to respect the one-default-per-tenant invariant.
  if (t.isDefault) {
    const { error: clearErr } = await sb
      .from('message_templates')
      .update({ is_default: false })
      .eq('tenant_id', tid)
      .neq('id', t.id)
    if (clearErr) throw clearErr
  }

  const { error } = await sb
    .from('message_templates')
    .upsert({
      id: t.id,
      tenant_id: tid,
      category_id: t.categoryId,
      name: t.name,
      body: t.body,
      is_default: t.isDefault,
    })
    .select('id, category_id, name, body, is_default')
    .single()
  if (error) throw error
  return t
}

export async function deleteTemplate(id: string): Promise<void> {
  const sb = requireSupabase()
  const { error } = await sb.from('message_templates').delete().eq('id', id)
  if (error) throw error
}

/**
 * Reassign every template bound to the given categoryId to the default
 * (categoryId = null). Returns the ids of the templates that were reassigned.
 */
export async function reassignTemplatesFromCategory(
  categoryId: string,
): Promise<string[]> {
  const sb = requireSupabase()
  const tid = tenantId()

  // Find affected templates first so we can return their ids.
  const { data: affected, error: selErr } = await sb
    .from('message_templates')
    .select('id')
    .eq('tenant_id', tid)
    .eq('category_id', categoryId)
  if (selErr) throw selErr

  const ids = (affected ?? []).map((r) => r.id)
  if (ids.length === 0) return []

  const { error } = await sb
    .from('message_templates')
    .update({ category_id: null })
    .eq('tenant_id', tid)
    .in('id', ids)
  if (error) throw error
  return ids
}

export async function getTemplateForCategory(
  categoryId: string,
): Promise<MessageTemplate | undefined> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('message_templates')
    .select('id, category_id, name, body, is_default')
    .eq('tenant_id', tenantId())
    .eq('category_id', categoryId)
    .maybeSingle()
  if (error) throw error
  if (!data) return undefined
  return {
    id: data.id,
    categoryId: data.category_id,
    name: data.name,
    body: data.body,
    isDefault: data.is_default,
  }
}

export async function getDefaultTemplate(): Promise<MessageTemplate | undefined> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('message_templates')
    .select('id, category_id, name, body, is_default')
    .eq('tenant_id', tenantId())
    .eq('is_default', true)
    .maybeSingle()
  if (error) throw error
  if (!data) return undefined
  return {
    id: data.id,
    categoryId: data.category_id,
    name: data.name,
    body: data.body,
    isDefault: data.is_default,
  }
}

export function makeTemplate(input: {
  categoryId: string | null
  name: string
  body: string
  isDefault: boolean
}): MessageTemplate {
  return { id: newId(), ...input }
}

// ── Settings (webhook URL + HMAC secret — server-side only) ──────────────────

export interface ClinicSettings {
  webhookUrl: string
  hmacSecret: string
}

export async function getSettings(): Promise<ClinicSettings> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('clinic_settings')
    .select('webhook_url, hmac_secret')
    .eq('tenant_id', tenantId())
    .maybeSingle()
  if (error) throw error
  if (!data) return { webhookUrl: '', hmacSecret: '' }
  return {
    webhookUrl: data.webhook_url,
    hmacSecret: data.hmac_secret,
  }
}

export async function saveSettings(s: ClinicSettings): Promise<ClinicSettings> {
  const sb = requireSupabase()
  const tid = tenantId()
  const { error } = await sb
    .from('clinic_settings')
    .upsert({
      tenant_id: tid,
      webhook_url: s.webhookUrl,
      hmac_secret: s.hmacSecret,
    })
  if (error) throw error
  return s
}

// ── Seed (no-op in Supabase mode — handled by SQL migrations + manual invites)

export async function seedIfEmpty(): Promise<void> {
  // In Supabase mode, seeding is done via SQL migrations. A new tenant gets
  // its clinic_settings row automatically via trigger, but categories and
  // templates are added by the user (or seeded by running `0002_seed_demo.sql`).
  // The auth hook calls `tenantStore.hydrate()` which loads real data.
  return
}

// ── Campaigns (historical record of each send) ──────────────────────────────

export interface CampaignRecord {
  id: string
  sentBy: string
  totalRecipients: number
  enabledRecipients: number
  invalidRecipients: number
  duplicateRecipients: number
  payload: unknown
  status: 'sent' | 'failed'
  errorMessage: string | null
  createdAt: string
}

export async function recordCampaign(record: {
  id: string
  sentBy: string
  totalRecipients: number
  enabledRecipients: number
  invalidRecipients: number
  duplicateRecipients: number
  payload: unknown
  status: 'sent' | 'failed'
  errorMessage: string | null
}): Promise<void> {
  const sb = requireSupabase()
  const { error } = await sb.from('campaigns').insert({
    id: record.id,
    tenant_id: tenantId(),
    sent_by: record.sentBy,
    total_recipients: record.totalRecipients,
    enabled_recipients: record.enabledRecipients,
    invalid_recipients: record.invalidRecipients,
    duplicate_recipients: record.duplicateRecipients,
    payload: record.payload,
    status: record.status,
    error_message: record.errorMessage,
  })
  if (error) throw error
}

export async function listCampaigns(limit = 50): Promise<CampaignRecord[]> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('campaigns')
    .select(
      'id, sent_by, total_recipients, enabled_recipients, invalid_recipients, duplicate_recipients, payload, status, error_message, created_at',
    )
    .eq('tenant_id', tenantId())
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map((row) => ({
    id: row.id,
    sentBy: row.sent_by,
    totalRecipients: row.total_recipients,
    enabledRecipients: row.enabled_recipients,
    invalidRecipients: row.invalid_recipients,
    duplicateRecipients: row.duplicate_recipients,
    payload: row.payload,
    status: row.status,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  }))
}

// ── Audit log ────────────────────────────────────────────────────────────────

export interface AuditEntry {
  id: number
  userId: string | null
  action: string
  entityType: string | null
  entityId: string | null
  metadata: unknown
  createdAt: string
}

export async function recordAudit(entry: {
  userId: string | null
  action: string
  entityType: string | null
  entityId: string | null
  metadata: unknown
}): Promise<void> {
  const sb = requireSupabase()
  const { error } = await sb.from('audit_log').insert({
    tenant_id: tenantId(),
    user_id: entry.userId,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    metadata: entry.metadata,
  })
  if (error) throw error
}

export async function listAudit(limit = 100): Promise<AuditEntry[]> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('audit_log')
    .select('id, user_id, action, entity_type, entity_id, metadata, created_at')
    .eq('tenant_id', tenantId())
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: row.metadata,
    createdAt: row.created_at,
  }))
}