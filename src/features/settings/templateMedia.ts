/**
 * Browser-side conversion of a picked image file into a storable
 * `TemplateMedia` (resized data URI). Not pure — uses Image + canvas —
 * so it lives here, next to the editor that uses it.
 */
import {
  IMAGE_JPEG_QUALITY,
  IMAGE_MAX_DIMENSION,
  dataUriBytes,
  validateImageFileMeta,
} from '@/lib/image'
import type { TemplateMedia } from '@/lib/types'

/**
 * Validate + decode + downscale (max 1280px, JPEG ~82%) so the image fits
 * comfortably in localStorage and in the n8n payload. Throws an Error with
 * a Spanish message when the file is not acceptable.
 */
export async function fileToTemplateMedia(file: File): Promise<TemplateMedia> {
  const validation = validateImageFileMeta({
    mimetype: file.type,
    size: file.size,
  })
  if (!validation.ok) throw new Error(validation.error)

  const bitmap = await loadImage(file)
  const { width, height } = scaledDimensions(
    bitmap.width,
    bitmap.height,
    IMAGE_MAX_DIMENSION,
  )
  const dataUri = drawToJpegDataUri(bitmap, width, height)

  return {
    data: dataUri,
    mimetype: 'image/jpeg',
    fileName: file.name,
    bytes: dataUriBytes(dataUri),
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('No se pudo leer la imagen.'))
    }
    img.src = url
  })
}

function scaledDimensions(
  width: number,
  height: number,
  max: number,
): { width: number; height: number } {
  if (width <= max && height <= max) return { width, height }
  const ratio = width >= height ? max / width : max / height
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  }
}

function drawToJpegDataUri(
  img: HTMLImageElement,
  width: number,
  height: number,
): string {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo procesar la imagen.')
  // Flatten transparency onto white so PNG logos don't turn black in JPEG.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(img, 0, 0, width, height)
  return canvas.toDataURL('image/jpeg', IMAGE_JPEG_QUALITY)
}
