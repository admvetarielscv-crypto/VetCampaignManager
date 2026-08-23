/**
 * Durable settings store. Hydrated from localStorage at app boot; every
 * mutation persists async and surfaces a toast on failure.
 */
import { create } from 'zustand'
import { toast } from 'sonner'
import { APP } from '@/app/env'
import {
  listCategories,
  saveCategory,
  deleteCategory,
  listTemplates,
  saveTemplate,
  deleteTemplate,
  reassignTemplatesFromCategory,
  getSettings,
  saveSettings,
  seedIfEmpty,
  makeCategory,
  makeTemplate,
} from '@/storage/exports'
import { resolveTemplateByCategoryName } from '@/lib/campaign'
import type { AppSettings, Category, MessageTemplate } from '@/lib/types'

interface SettingsState {
  categories: Category[]
  templates: MessageTemplate[]
  settings: AppSettings
  hydrated: boolean

  hydrate: () => Promise<void>

  addCategory: (name: string) => Promise<void>
  updateCategory: (id: string, name: string) => Promise<void>
  removeCategory: (id: string) => Promise<void>

  addTemplate: (input: {
    categoryId: string | null
    name: string
    body: string
    isDefault: boolean
  }) => Promise<MessageTemplate>
  updateTemplate: (t: MessageTemplate) => Promise<void>
  removeTemplate: (id: string) => Promise<void>
  markDefault: (id: string) => Promise<void>

  updateSettings: (s: Partial<AppSettings>) => Promise<void>
}

const EMPTY_SETTINGS: AppSettings = {
  webhookUrl: '',
  defaultCountryCode: APP.defaultCountryCode,
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  categories: [],
  templates: [],
  settings: EMPTY_SETTINGS,
  hydrated: false,

  hydrate: async () => {
    try {
      await seedIfEmpty()
    } catch (err) {
      console.error('seed failed', err)
    }
    const [categories, templates, settings] = await Promise.all([
      listCategories(),
      listTemplates(),
      getSettings(),
    ])
    set({ categories, templates, settings, hydrated: true })
  },

  addCategory: async (name) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const exists = get().categories.some(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase(),
    )
    if (exists) {
      toast.error('Ya existe una categoría con ese nombre.')
      return
    }
    const cat = makeCategory(trimmed)
    await saveCategory(cat)
    set((s) => ({ categories: [...s.categories, cat] }))
    toast.success('Categoría creada.')
  },

  updateCategory: async (id, name) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const exists = get().categories.some(
      (c) => c.id !== id && c.name.toLowerCase() === trimmed.toLowerCase(),
    )
    if (exists) {
      toast.error('Ya existe una categoría con ese nombre.')
      return
    }
    const cat = get().categories.find((c) => c.id === id)
    if (!cat) return
    const updated = { ...cat, name: trimmed }
    await saveCategory(updated)
    set((s) => ({
      categories: s.categories.map((c) => (c.id === id ? updated : c)),
    }))
    toast.success('Categoría actualizada.')
  },

  removeCategory: async (id) => {
    const reassigned = await reassignTemplatesFromCategory(id)
    await deleteCategory(id)
    set((s) => ({
      categories: s.categories.filter((c) => c.id !== id),
      templates: s.templates.map((t) =>
        t.categoryId === id ? { ...t, categoryId: null } : t,
      ),
    }))
    if (reassigned.length > 0) {
      toast.success(
        `Categoría eliminada. ${reassigned.length} plantilla(s) reasignada(s) a Predeterminada.`,
      )
    } else {
      toast.success('Categoría eliminada.')
    }
  },

  addTemplate: async (input) => {
    const t = makeTemplate(input)
    await saveTemplate(t)
    // Refetch to reflect invariant corrections (other defaults unmarked).
    const templates = await listTemplates()
    set({ templates })
    toast.success('Plantilla creada.')
    return t
  },

  updateTemplate: async (t) => {
    await saveTemplate(t)
    const templates = await listTemplates()
    set({ templates })
    toast.success('Plantilla guardada.')
  },

  removeTemplate: async (id) => {
    await deleteTemplate(id)
    set((s) => ({ templates: s.templates.filter((t) => t.id !== id) }))
    toast.success('Plantilla eliminada.')
  },

  markDefault: async (id) => {
    const t = get().templates.find((x) => x.id === id)
    if (!t || t.isDefault) return
    await saveTemplate({ ...t, isDefault: true })
    const templates = await listTemplates()
    set({ templates })
    toast.success('Predeterminada actualizada.')
  },

  updateSettings: async (partial) => {
    const next = { ...get().settings, ...partial }
    await saveSettings(next)
    set({ settings: next })
    toast.success('Configuración guardada.')
  },
}))

/** Resolve the template that applies for a given category name. */
export function resolveTemplateForCategoryName(
  state: SettingsState,
  categoryName: string,
): MessageTemplate | undefined {
  return resolveTemplateByCategoryName(categoryName, state.categories, state.templates)
}