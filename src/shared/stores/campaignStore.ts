/**
 * In-memory campaign session state. NOT persisted: per the agreed MVP plan,
 * refreshing the page means the receptionist re-imports the Excel file.
 *
 * Durable data (categories, templates, webhook URL) lives in storage/ (Phase 2),
 * not here.
 */
import { create } from 'zustand'
import { defaultEnabledFor } from '@/lib/campaign'
import type { ImportResult, Recipient } from '@/lib/types'

export type CampaignPhase = 'import' | 'preview' | 'send'

interface CampaignState {
  phase: CampaignPhase
  rawFileName: string | null
  result: ImportResult | null
  /**
   * Per-recipient enable override. Initialized to defaults when a result is
   * set: valid→true, duplicates/invalid→false. The receptionist toggles rows
   * in the preview. Only "enabled" recipients are sent.
   */
  recipientEnabled: Record<string, boolean>
  /** Currently selected recipient id (drives the right-side preview panel). */
  selectedId: string | null

  setParsedResult: (fileName: string, result: ImportResult) => void
  setPhase: (phase: CampaignPhase) => void
  toggleRecipient: (id: string) => void
  setEnabledBulk: (ids: string[], enabled: boolean) => void
  selectRecipient: (id: string | null) => void
  reset: () => void
}

function initialEnabled(recipients: Recipient[]): Record<string, boolean> {
  const map: Record<string, boolean> = {}
  for (const r of recipients) {
    map[r.id] = defaultEnabledFor(r)
  }
  return map
}

const initialState = {
  phase: 'import' as CampaignPhase,
  rawFileName: null,
  result: null,
  recipientEnabled: {},
  selectedId: null,
}

export const useCampaignStore = create<CampaignState>((set) => ({
  ...initialState,

  setParsedResult: (fileName, result) =>
    set({
      rawFileName: fileName,
      result,
      recipientEnabled: initialEnabled(result.recipients),
      selectedId: result.recipients[0]?.id ?? null,
      phase: 'import',
    }),

  setPhase: (phase) => set({ phase }),

  toggleRecipient: (id) =>
    set((s) => {
      const r = s.result?.recipients.find((x) => x.id === id)
      if (!r) return s
      // Locked exclusions: invalid phones and branch-level "NO CONTACTAR".
      // Recently-contacted phones CAN be force-enabled (manual override).
      if (r.phoneStatus === 'invalid' || r.contactState?.doNotContact) return s
      return {
        recipientEnabled: {
          ...s.recipientEnabled,
          [id]: !(
            s.recipientEnabled[id] ?? defaultEnabledFor(r)
          ),
        },
      }
    }),

  setEnabledBulk: (ids, enabled) =>
    set((s) => {
      const next = { ...s.recipientEnabled }
      for (const id of ids) {
        const r = s.result?.recipients.find((x) => x.id === id)
        if (!r) continue
        if (r.phoneStatus === 'invalid' || r.contactState?.doNotContact) continue
        next[id] = enabled
      }
      return { recipientEnabled: next }
    }),

  selectRecipient: (id) => set({ selectedId: id }),

  reset: () =>
    set({
      ...initialState,
      recipientEnabled: {},
    }),
}))