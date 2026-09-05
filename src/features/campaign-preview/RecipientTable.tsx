import { useMemo, useState } from 'react'
import {
  flexRender,
  useTable,
  tableFeatures,
  rowSortingFeature,
  columnFilteringFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createSortedRowModel,
  createFilteredRowModel,
  createColumnHelper,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { ArrowUpDown, Inbox } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Chip, Table, Tbody, Td, Th, Thead, Tr } from '@/shared/components/ui'
import type { Recipient } from '@/lib/types'

export interface RecipientTableRow extends Recipient {
  enabled: boolean
}

interface Props {
  rows: RecipientTableRow[]
  selectedId: string | null
  onSelect: (id: string) => void
  onToggle: (id: string) => void
}

const statusTone: Record<Recipient['phoneStatus'], 'vegetal' | 'danger' | 'warn'> = {
  valid: 'vegetal',
  invalid: 'danger',
  duplicate: 'warn',
}

const statusLabel: Record<Recipient['phoneStatus'], string> = {
  valid: 'Válido',
  invalid: 'Inválido',
  duplicate: 'Duplicado',
}

const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  sortedRowModel: createSortedRowModel(),
  filteredRowModel: createFilteredRowModel(),
})

const columnHelper = createColumnHelper<typeof features, RecipientTableRow>()

export function RecipientTable({ rows, selectedId, onSelect, onToggle }: Props) {
  const [sorting, setSorting] = useState<SortingState>([])

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'enabled',
        header: '',
        enableSorting: false,
        cell: ({ row }) => {
          const r = row.original
          const disabled = r.phoneStatus === 'invalid'
          return (
            <input
              type="checkbox"
              checked={r.enabled}
              disabled={disabled}
              onChange={() => onToggle(r.id)}
              onClick={(e) => e.stopPropagation()}
              className="accent-vegetal h-4 w-4 align-middle disabled:opacity-40"
              title={
                disabled
                  ? 'No se puede enviar: teléfono inválido'
                  : r.enabled
                    ? 'Excluir del envío'
                    : 'Incluir en el envío'
              }
            />
          )
        },
        size: 32,
      }),
      columnHelper.accessor('owner', {
        header: 'Propietario',
        cell: ({ row }) => {
          const r = row.original
          return (
            <span className="font-medium text-ink truncate block max-w-[12rem]">
              {r.owner || <span className="text-ink-mute italic">vacío</span>}
            </span>
          )
        },
      }),
      columnHelper.accessor('pet', {
        header: 'Mascota',
        cell: ({ row }) => {
          const r = row.original
          return (
            <span className="text-ink-soft truncate block max-w-[8rem]">
              {r.pet || <span className="text-ink-mute italic">—</span>}
            </span>
          )
        },
      }),
      columnHelper.accessor('normalizedPhone', {
        id: 'phone',
        header: 'Teléfono',
        enableSorting: true,
        cell: ({ row }) => {
          const r = row.original
          return (
            <span
              className="text-ink text-sm"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {r.normalizedPhone || (
                <span className="text-ink-mute">{r.rawPhone || '—'}</span>
              )}
            </span>
          )
        },
      }),
      columnHelper.accessor('category', {
        header: 'Categoría',
        cell: ({ row }) => {
          const r = row.original
          return <span className="text-ink-soft">{r.category}</span>
        },
      }),
      columnHelper.accessor('phoneStatus', {
        id: 'status',
        header: 'Estado',
        cell: ({ row }) => {
          const r = row.original
          return <Chip tone={statusTone[r.phoneStatus]}>{statusLabel[r.phoneStatus]}</Chip>
        },
      }),
    ],
    [onToggle],
  )

  const table = useTable({
    features,
    data: rows,
    columns: columns as ColumnDef<typeof features, RecipientTableRow, unknown>[],
    state: { sorting },
    onSortingChange: setSorting,
  })

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-mist bg-paper py-12 text-center">
        <Inbox className="mx-auto mb-2 text-ink-mute" size={22} />
        <p className="text-sm text-ink-soft">
          No hay destinatarios que coincidan con los filtros.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-md border border-mist bg-paper overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <Thead className="bg-mist-soft/40">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <Th
                    key={h.id}
                    style={{ width: h.getSize() !== 150 ? h.getSize() : undefined }}
                  >
                    {h.isPlaceholder ? null : h.column.getCanSort() ? (
                      <button
                        className={cn(
                          'inline-flex items-center gap-1 hover:text-ink transition-colors',
                          h.column.getIsSorted() && 'text-ink',
                        )}
                        onClick={h.column.getToggleSortingHandler()}
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        <ArrowUpDown size={11} />
                      </button>
                    ) : (
                      flexRender(h.column.columnDef.header, h.getContext())
                    )}
                  </Th>
                ))}
              </tr>
            ))}
          </Thead>
          <Tbody>
            {table.getRowModel().rows.map((row) => {
              const r = row.original
              const active = r.id === selectedId
              return (
                <Tr
                  key={r.id}
                  onClick={() => onSelect(r.id)}
                  className={cn(
                    'cursor-pointer transition-colors',
                    active ? 'bg-vegetal-soft/30' : 'hover:bg-mist-soft/30',
                    !r.enabled && 'opacity-50',
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <Td key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </Td>
                  ))}
                </Tr>
              )
            })}
          </Tbody>
        </Table>
      </div>
    </div>
  )
}
