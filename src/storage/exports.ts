/**
 * Storage barrel. Switches between localStorage (MVP) and Supabase (SaaS)
 * based on `HAS_SUPABASE` from `runtime.ts`. Feature code imports from here
 * and gets the right backend transparently.
 */
import { HAS_SUPABASE } from '@/integrations/supabase'
import type { CampaignRecord } from '@/lib/types'

// ── localStorage implementation (always available) ────────────────────────────
import {
  listCategories as listCategoriesLocal,
  saveCategory as saveCategoryLocal,
  deleteCategory as deleteCategoryLocal,
  makeCategory as makeCategoryLocal,
  findCategoryByName as findCategoryByNameLocal,
} from './categories'
import {
  listTemplates as listTemplatesLocal,
  saveTemplate as saveTemplateLocal,
  deleteTemplate as deleteTemplateLocal,
  reassignTemplatesFromCategory as reassignTemplatesFromCategoryLocal,
  getTemplateForCategory as getTemplateForCategoryLocal,
  getDefaultTemplate as getDefaultTemplateLocal,
  makeTemplate as makeTemplateLocal,
} from './templates'
import {
  getSettings as getSettingsLocal,
  saveSettings as saveSettingsLocal,
  DEFAULT_SETTINGS,
} from './settings'
import { seedIfEmpty as seedIfEmptyLocal } from './seed'
import {
  recordCampaign as recordCampaignLocal,
  listCampaigns as listCampaignsLocal,
} from './campaigns'
import {
  findContactStates as findContactStatesLocal,
  markContacted as markContactedLocal,
} from './contacts'
import type { ContactEntry, DeliveryEntry } from './supabase'

// ── Supabase implementation (only used when HAS_SUPABASE) ────────────────────
import * as supabaseStorage from './supabase'
import type { AppSettings } from '@/lib/types'

function pick<T>(local: T, remote: T): T {
  return HAS_SUPABASE ? remote : local
}

export const listCategories = () =>
  pick(listCategoriesLocal, supabaseStorage.listCategories)()

export const saveCategory = (c: Parameters<typeof saveCategoryLocal>[0]) =>
  pick(saveCategoryLocal, supabaseStorage.saveCategory)(c)

export const deleteCategory = (id: Parameters<typeof deleteCategoryLocal>[0]) =>
  pick(deleteCategoryLocal, supabaseStorage.deleteCategory)(id)

export const makeCategory = (name: Parameters<typeof makeCategoryLocal>[0]) =>
  pick(makeCategoryLocal, supabaseStorage.makeCategory)(name)

export const findCategoryByName = (
  name: Parameters<typeof findCategoryByNameLocal>[0],
) => pick(findCategoryByNameLocal, supabaseStorage.findCategoryByName)(name)

export const listTemplates = () =>
  pick(listTemplatesLocal, supabaseStorage.listTemplates)()

export const saveTemplate = (t: Parameters<typeof saveTemplateLocal>[0]) =>
  pick(saveTemplateLocal, supabaseStorage.saveTemplate)(t)

export const deleteTemplate = (id: Parameters<typeof deleteTemplateLocal>[0]) =>
  pick(deleteTemplateLocal, supabaseStorage.deleteTemplate)(id)

export const reassignTemplatesFromCategory = (
  categoryId: Parameters<typeof reassignTemplatesFromCategoryLocal>[0],
) =>
  pick(
    reassignTemplatesFromCategoryLocal,
    supabaseStorage.reassignTemplatesFromCategory,
  )(categoryId)

export const getTemplateForCategory = (
  categoryId: Parameters<typeof getTemplateForCategoryLocal>[0],
) =>
  pick(
    getTemplateForCategoryLocal,
    supabaseStorage.getTemplateForCategory,
  )(categoryId)

export const getDefaultTemplate = () =>
  pick(getDefaultTemplateLocal, supabaseStorage.getDefaultTemplate)()

export const makeTemplate = (
  input: Parameters<typeof makeTemplateLocal>[0],
) => pick(makeTemplateLocal, supabaseStorage.makeTemplate)(input)

/**
 * Adapters between `AppSettings` (what feature code uses) and the Supabase
 * storage layer. In Supabase mode the webhook + HMAC live on the BRANCH row
 * (migration 0003); the branch name comes from the same row so the UI can
 * label what it is configuring.
 */
const settingsAdapter = {
  get: async (): Promise<AppSettings> => {
    if (HAS_SUPABASE) {
      const c = await supabaseStorage.getSettings()
      return {
        webhookUrl: c.webhookUrl,
        defaultCountryCode: '', // filled by settingsStore from tenant
        hmacSecret: c.hmacSecret,
        branchName: c.branchName,
      }
    }
    return getSettingsLocal()
  },
  save: async (s: AppSettings): Promise<AppSettings> => {
    if (HAS_SUPABASE) {
      await supabaseStorage.saveSettings({
        webhookUrl: s.webhookUrl,
        hmacSecret: s.hmacSecret ?? '',
        branchName: s.branchName ?? '',
      })
      return s
    }
    return saveSettingsLocal(s)
  },
}

export const getSettings = settingsAdapter.get
export const saveSettings = settingsAdapter.save

// `DEFAULT_SETTINGS` is only meaningful in localStorage mode — Supabase mode
// uses `clinic_settings` table directly with a webhook URL + HMAC secret.
export { DEFAULT_SETTINGS }

// `seedIfEmpty` is only meaningful in localStorage mode (Supabase uses SQL
// migrations instead).
export const seedIfEmpty = () =>
  pick(seedIfEmptyLocal, supabaseStorage.seedIfEmpty)()

// ── Campaign + audit log ──────────────────────────────────────────────────────
// Campaigns persist on BOTH backends (localStorage envelope or the Supabase
// `campaigns` table) — same shape, see `CampaignRecord` in `lib/types`.
// The audit log is a Supabase-mode feature (no-ops in localStorage mode).

export type { CampaignRecord, CampaignDraft } from '@/lib/types'
export type { AuditEntry, ContactEntry, DeliveryEntry } from './supabase'
import type { AuditEntry } from './supabase'
import type { ContactState } from '@/lib/types'

const noopRecordAudit = async () => {}
const emptyAudit = async (): Promise<AuditEntry[]> => []

export const recordCampaign = pick(recordCampaignLocal, supabaseStorage.recordCampaign)
export const listCampaigns: (limit?: number) => Promise<CampaignRecord[]> =
  pick(listCampaignsLocal, supabaseStorage.listCampaigns)

// ── Contact ledger (branch-scoped; both backends) ─────────────────────────────

export const findContactStates: (
  phones: string[],
) => Promise<Map<string, ContactState>> = pick(
  findContactStatesLocal,
  supabaseStorage.findContactStates,
)
export const markContacted: (entries: ContactEntry[]) => Promise<void> = pick(
  markContactedLocal,
  supabaseStorage.markContacted,
)

// ── Delivery reports (Supabase only — local mode keeps counters on the
//    campaign record; per-message rows would eat the browser quota) ──────────

export const recordDeliveries: (
  campaignId: string,
  entries: DeliveryEntry[],
) => Promise<void> = HAS_SUPABASE
  ? supabaseStorage.recordDeliveries
  : async () => {}

export const recordAudit = HAS_SUPABASE ? supabaseStorage.recordAudit : noopRecordAudit
export const listAudit: (limit?: number) => Promise<AuditEntry[]> = HAS_SUPABASE
  ? supabaseStorage.listAudit
  : emptyAudit