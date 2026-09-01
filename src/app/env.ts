/**
 * App-level configuration defaults.
 * Editable values (webhook URL, default country, column mapping) live in
 * localStorage via the settings store. These are code-level fallbacks.
 */
export const APP = {
  productName: 'VetCampaignManager',
  clinicName: 'Clínica Ariels',
  defaultCountryCode: '+51', // Peru
  schema: 'vetcampaign/v1',
  source: 'VetCampaignManager',
} as const

/**
 * Expected Excel sheet/column mapping.
 * Default candidates reflect the real VetPraxis export format observed in
 * samples/Reporte de Eventos. Extra candidates tolerate naming variations
 * so a VetPraxis format change is a one-line config fix.
 *
 * Real VetPraxis headers (as observed):
 *   CLIENTE | MASCOTA | TELÉFONOS | MOTIVO | TIPO DE EVENTO | ESTADO
 * Used in MVP:  CLIENTE (owner), MASCOTA (pet), TELÉFONOS (phone),
 *               TIPO DE EVENTO (category)
 * Ignored in MVP: MOTIVO, ESTADO
 */
export const EXCEL_MAP = {
  sheetCandidates: [
    'Worksheet',
    'Hoja1',
    'Sheet1',
    'Data',
    'Datos',
  ],
  columns: {
    owner: ['CLIENTE', 'Cliente', 'Propietario', 'Dueño', 'Owner'],
    pet: ['MASCOTA', 'Mascota', 'Paciente', 'Pet'],
    // Real column is TELÉFONOS (plural) but tolerates singular
    phone: ['TELÉFONOS', 'Telefonos', 'Teléfonos', 'Teléfono', 'Telefono', 'Celular', 'Phone', 'Cel'],
    // Real column is TIPO DE EVENTO (broad category); MOTIVO is finer sub-reason (ignored in MVP)
    category: ['TIPO DE EVENTO', 'Tipo de Evento', 'Tipo Evento', 'Categoría', 'Categoria', 'Promoción', 'Promocion'],
  },
} as const

// Columns required for a row to be considered. Empty optional fields yield ''.
export const REQUIRED_COLUMNS: ReadonlyArray<keyof typeof EXCEL_MAP.columns> = [
  'owner',
  'phone',
]