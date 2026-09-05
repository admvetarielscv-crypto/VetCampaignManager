/**
 * Excel parsing for VetPraxis exports. Pure w.r.t. the SheetJS lib —
 * takes a File / ArrayBuffer, returns plain rows. No React, no storage.
 *
 * Tolerant header lookup: matches known candidate headers (case-insensitive,
 * accent-insensitive). The column mapping lives in app/env.ts EXCEL_MAP.
 */
import * as XLSX from 'xlsx'
import { EXCEL_MAP, REQUIRED_COLUMNS } from '@/app/env'
import type { ImportError } from '@/lib/types'

/** A normalized row ready to feed into validateRecipients. */
export interface ParsedRow {
  rowNumber: number
  owner: string
  pet: string
  rawPhone: string
  category: string
}

export interface ParseWorkbookResult {
  rows: ParsedRow[]
  sheetName: string | null
  errors: ImportError[]
}

const ACCEPTED_EXT = ['.xlsx', '.xls']

export function isAcceptedExcelFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return ACCEPTED_EXT.some((ext) => name.endsWith(ext))
}

/** Normalize a header string for tolerant matching: lowercase, strip accents. */
function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .trim()
    .replace(/á/g, 'a')
    .replace(/é/g, 'e')
    .replace(/í/g, 'i')
    .replace(/ó/g, 'o')
    .replace(/ú/g, 'u')
    .replace(/ñ/g, 'n')
}

/** Find the index of a column by trying candidate header names. */
function pickColumnIndex(
  headers: string[],
  candidates: readonly string[],
): number {
  const normalizedHeaders = headers.map(normalizeHeader)
  const normalizedCandidates = candidates.map(normalizeHeader)
  for (let i = 0; i < normalizedHeaders.length; i++) {
    if (normalizedCandidates.includes(normalizedHeaders[i])) return i
  }
  return -1
}

/**
 * Clean a pet name from VetPraxis artifacts:
 *   - Parenthetical notes anywhere ("ROCO (muerde)" -> "ROCO"), including
 *     unclosed ones cut to the end ("ROCO (muerde" -> "ROCO").
 *   - Trailing loose symbols ("MAXI #", "DOKY#", "FIRULAIS*") -> trimmed.
 * Exported for tests; a pure string helper.
 */
export function cleanPetName(raw: string): string {
  let name = raw.replace(/\([^)]*\)/g, '')
  name = name.replace(/\([^)]*$/, '')
  return name.replace(/[\s#*%.,:;/-]+$/, '').trim()
}

export async function parseWorkbook(
  file: File,
): Promise<ParseWorkbookResult> {
  if (!isAcceptedExcelFile(file)) {
    return {
      rows: [],
      sheetName: null,
      errors: [
        {
          message: `Formato no admitido. Usa un archivo ${ACCEPTED_EXT.join(' o ')}.`,
        },
      ],
    }
  }

  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })

  // 1) Pick the first sheet whose name matches a candidate; else first sheet.
  let sheetName: string | null = null
  for (const name of wb.SheetNames) {
    if ((EXCEL_MAP.sheetCandidates as readonly string[]).includes(name)) {
      sheetName = name
      break
    }
  }
  if (!sheetName) sheetName = wb.SheetNames[0] ?? null

  if (!sheetName) {
    return {
      rows: [],
      sheetName: null,
      errors: [{ message: 'El archivo no contiene ninguna hoja.' }],
    }
  }

  const ws = wb.Sheets[sheetName]
  // header:1 yields an array-of-arrays; raw:false keeps strings as strings.
  const matrix = XLSX.utils.sheet_to_json<string[]>(ws, {
    header: 1,
    raw: false,
    defval: '',
    blankrows: false,
  })

  if (matrix.length === 0) {
    return {
      rows: [],
      sheetName,
      errors: [{ message: 'La hoja está vacía.' }],
    }
  }

  const headers = (matrix[0] as string[]).map((h) => (h ?? '').toString())
  const colMap = {
    owner: pickColumnIndex(headers, EXCEL_MAP.columns.owner),
    pet: pickColumnIndex(headers, EXCEL_MAP.columns.pet),
    phone: pickColumnIndex(headers, EXCEL_MAP.columns.phone),
    category: pickColumnIndex(headers, EXCEL_MAP.columns.category),
  }

  const errors: ImportError[] = []
  for (const key of REQUIRED_COLUMNS) {
    if (colMap[key] === -1) {
      const label = headers.join(', ') || '(sin encabezados)'
      errors.push({
        field: key,
        message: `El archivo no tiene la columna "${key}". Revisa que sea el reporte exportado de VetPraxis (columnas detectadas: ${label}).`,
      })
    }
  }
  if (errors.length > 0) {
    return { rows: [], sheetName, errors }
  }

  // 2) Map data rows. Skip rows that are entirely empty across the mapped cols.
  const rows: ParsedRow[] = []
  for (let i = 1; i < matrix.length; i++) {
    const r = matrix[i] ?? []
    const get = (idx: number) =>
      idx === -1 ? '' : (r[idx] ?? '').toString().trim()
    const owner = get(colMap.owner)
    const pet = colMap.pet === -1 ? '' : cleanPetName(get(colMap.pet))
    const rawPhone = get(colMap.phone)
    const category = colMap.category === -1 ? '' : get(colMap.category)

    // Skip entirely empty rows.
    if (!owner && !pet && !rawPhone && !category) continue

    rows.push({
      rowNumber: i + 1, // 1-based visible row number
      owner,
      pet,
      rawPhone,
      category,
    })
  }

  if (rows.length === 0) {
    errors.push({ message: 'No se encontraron filas con datos.' })
  }

  return { rows, sheetName, errors }
}