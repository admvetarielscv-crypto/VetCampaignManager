/**
 * Runtime-validated environment variables.
 *
 * Validates `import.meta.env` once at app boot via zod and exports a typed
 * `RUNTIME` object. A missing *required* var throws with a clear message;
 * optional vars default to empty strings (MVP runs without a backend).
 *
 * Add new `VITE_*` vars here AND in `.env.example` so they stay in sync.
 */
import { z } from 'zod'

const envSchema = z.object({
  VITE_N8N_WEBHOOK_URL: z.string().url().or(z.literal('')).default(''),
  VITE_SUPABASE_URL: z.string().url().or(z.literal('')).default(''),
  VITE_SUPABASE_ANON_KEY: z.string().default(''),
  VITE_SENTRY_DSN: z.string().url().or(z.literal('')).default(''),
})

export type RuntimeEnv = z.infer<typeof envSchema>

function loadEnv(): RuntimeEnv {
  const parsed = envSchema.safeParse(import.meta.env)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new Error(
      `Configuración de entorno inválida. Revisa tu archivo .env:\n${issues}`,
    )
  }
  return parsed.data
}

export const RUNTIME: RuntimeEnv = loadEnv()

/** True when a Supabase backend is configured (Phase 2 migration). */
export const HAS_SUPABASE = RUNTIME.VITE_SUPABASE_URL !== ''
