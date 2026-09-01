/**
 * First-run seeding. Populates localStorage with sample categories and a
 * default template so the receptionist sees something on first visit to
 * /settings. Only seeds when storage is empty — never overwrites.
 */
import { newId } from '@/lib/id'
import { setJSON } from './storage'
import { KEYS } from './keys'
import { listCategories, listTemplates } from './exports'
import type { Category, MessageTemplate } from '@/lib/types'

const SEED_CATEGORIES: Array<Omit<Category, 'id'>> = [
  { name: 'Vacuna' },
  { name: 'Antipulgas' },
  { name: 'Hidratación' },
]

const SEED_DEFAULT_BODY = [
  'Hola {{owner}} 👋',
  '',
  'Nos encantaría volver a ver a {{pet}} 🐾',
  '',
  'Esta semana, {{category}} incluye un beneficio especial para ti.',
  '',
  'Responde a este mensaje para agendar tu visita.',
].join('\n')

export async function seedIfEmpty(): Promise<void> {
  const cats = await listCategories()
  if (cats.length === 0) {
    const seeded: Category[] = SEED_CATEGORIES.map((c) => ({
      ...c,
      id: newId(),
    }))
    await setJSON(KEYS.categories, seeded)
  }

  const templates = await listTemplates()
  if (templates.length === 0) {
    const seeded: MessageTemplate[] = [
      {
        id: newId(),
        categoryId: null,
        name: 'Predeterminada',
        body: SEED_DEFAULT_BODY,
        isDefault: true,
      },
    ]
    await setJSON(KEYS.templates, seeded)
  }
}
