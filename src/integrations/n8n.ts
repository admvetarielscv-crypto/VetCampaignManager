/**
 * n8n webhook client. The only network call in the app.
 *
 * - Fire-and-forget from the app's perspective: one POST with the campaign
 *   payload; n8n handles per-message delivery, retries, Evolution API.
 * - Mock mode when webhook URL is empty: returns 200 with the payload echo so
 *   development & demos work without n8n running.
 * - No retry on failure. A campaign must NEVER be duplicated silently: a
 *   timeout or network error is surfaced to the user, who decides to resend
 *   manually. n8n webhook should be configured to respond "Immediately" so
 *   the workflow runs in the background and the request returns fast.
 */
import type { N8nCampaignPayload } from '@/lib/campaign'
import { APP } from '@/app/env'

export interface SendResult {
  ok: boolean
  status: number
  mock: boolean
  /** Echoed payload when mocked; n8n response body otherwise (if any). */
  detail?: string
  error?: string
}

const DEFAULT_TIMEOUT_MS = 15_000

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}

export async function sendCampaign(
  payload: N8nCampaignPayload,
  webhookUrl: string,
  opts: { timeoutMs?: number } = {},
): Promise<SendResult> {
  // Mock mode: empty webhook URL → pretend success and echo the payload shape.
  if (!webhookUrl.trim()) {
    return {
      ok: true,
      status: 200,
      mock: true,
      detail: `Modo demo — payload con ${payload.recipients.length} destinatario(s) construido correctamente.`,
    }
  }

  const body = JSON.stringify(payload)
  const timeout = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS

  // Single attempt. No retry: resending a campaign would duplicate messages
  // to real clients. The user must explicitly retry from the UI.
  try {
    const res = await fetchWithTimeout(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
    if (res.ok) {
      return {
        ok: true,
        status: res.status,
        mock: false,
        detail: await safeReadText(res),
      }
    }
    // Non-2xx: surface immediately.
    return {
      ok: false,
      status: res.status,
      mock: false,
      error: `El webhook respondió ${res.status} ${res.statusText}`,
      detail: await safeReadText(res),
    }
  } catch (err) {
    const isAbort = err instanceof DOMException && err.name === 'AbortError'
    return {
      ok: false,
      status: 0,
      mock: false,
      error: isAbort
        ? `Tiempo de espera agotado (${timeout / 1000}s) al contactar el webhook.`
        : err instanceof Error
          ? err.message
          : 'No se pudo contactar el webhook.',
    }
  }
}

async function safeReadText(res: Response): Promise<string | undefined> {
  try {
    const text = await res.text()
    return text || undefined
  } catch {
    return undefined
  }
}

/** Convenience to build a payload with sane defaults for the app source/schema. */
export function useAppDefaults() {
  return { source: APP.source, schema: APP.schema }
}