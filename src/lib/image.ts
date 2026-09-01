/**
 * Pure image helpers for template attachments.
 *
 * No React, no canvas, no storage: validation and byte math only.
 * The browser-side conversion (file → resized data URI) lives in
 * `features/settings/templateMedia.ts` and is not unit-tested here.
 */

/** Max size of the original file picked from disk. */
export const IMAGE_MAX_INPUT_BYTES = 2 * 1024 * 1024

/** Mimetypes accepted for a template image. */
export const IMAGE_ACCEPTED_MIMETYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

/** After resize, the image is re-encoded to JPEG with these limits. */
export const IMAGE_MAX_DIMENSION = 1280
export const IMAGE_JPEG_QUALITY = 0.82

/** WhatsApp truncates captions beyond ~1024 chars; warn slightly earlier. */
export const CAPTION_WARN_CHARS = 1000

export type ImageValidation = { ok: true } | { ok: false; error: string }

/**
 * Validate a picked file's metadata (type + size) before decoding it.
 * Returns a Spanish-language error message when invalid.
 */
export function validateImageFileMeta(meta: {
  mimetype: string
  size: number
}): ImageValidation {
  if (!isAcceptedImageMimetype(meta.mimetype)) {
    return {
      ok: false,
      error: 'Formato no permitido. Usa JPG, PNG o WebP.',
    }
  }
  if (meta.size > IMAGE_MAX_INPUT_BYTES) {
    return {
      ok: false,
      error: 'La imagen supera 2 MB. Elige una más liviana.',
    }
  }
  if (meta.size === 0) {
    return { ok: false, error: 'El archivo está vacío.' }
  }
  return { ok: true }
}

export function isAcceptedImageMimetype(mimetype: string): boolean {
  return (IMAGE_ACCEPTED_MIMETYPES as readonly string[]).includes(mimetype)
}

/**
 * Approximate byte size of a data URI's payload (base64 → raw bytes).
 * Used to show the stored size and to track localStorage quota.
 */
export function dataUriBytes(dataUri: string): number {
  const comma = dataUri.indexOf(',')
  if (comma === -1) return 0
  const b64 = dataUri.slice(comma + 1)
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((b64.length * 3) / 4) - padding)
}

/** Human-readable size, e.g. "184 KB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
