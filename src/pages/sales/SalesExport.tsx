import { useState } from 'react'
import { paymentLabels, type EventRow } from '../../data/types.ts'
import { useVariantCatalog } from '../../data/useVariantCatalog.ts'
import { downloadCsv, toCsv } from '../../lib/csv.ts'
import { readAll } from '../../lib/readAll.ts'
import { useToast } from '../../components/toast.ts'
import { supabase } from '../../lib/supabase.ts'

interface TicketLine {
  variant_id: string
  quantity: number
  unit_price: number
  line_total: number
}

interface TicketRow {
  id: string
  event_id: string | null
  kind: 'sale' | 'gift' | 'loss'
  discount_total: number
  total: number
  payment_method: string | null
  note: string | null
  created_at: string
  ticket_items: TicketLine[]
}

const today = () => new Date().toLocaleDateString('sv-SE')

/**
 * One row per sold design (a line of a ticket), ready to paste into the root spreadsheet at home.
 * Read-only: nothing is written to the database. Voided tickets are left out.
 */
export function SalesExport({ event }: { event: EventRow }) {
  const catalog = useVariantCatalog()
  const [busy, setBusy] = useState(false)
  const { notify } = useToast()

  async function download() {
    const client = supabase
    if (!client) return
    setBusy(true)
    try {
      const tickets = await readAll<TicketRow>((a, b) => {
        let query = client
          .from('tickets')
          .select('id, event_id, kind, discount_total, total, payment_method, note, created_at, ticket_items(variant_id, quantity, unit_price, line_total)')
          .eq('status', 'confirmed')
          .order('created_at')
          .range(a, b)
        return query.eq('event_id', event.id)
      })
      const info = new Map(catalog.items.map((i) => [i.id, i]))
      const collectionName = new Map(catalog.collections.map((c) => [c.id, c.name]))

      const rows = tickets.flatMap((t) =>
        t.ticket_items.map((line) => {
          const item = info.get(line.variant_id)
          return [
            new Date(t.created_at).toLocaleString('es-AR'),
            event.name,
            t.kind === 'gift' ? 'Regalo' : t.kind === 'loss' ? 'Pérdida' : 'Venta',
            item?.productCode ?? '',
            item?.productName ?? '',
            item ? (collectionName.get(item.collectionId) ?? '') : '',
            item?.sizeName ?? '',
            item?.materialName ?? '',
            item?.finishName ?? '',
            line.quantity,
            line.unit_price,
            line.line_total,
            t.discount_total,
            t.total,
            t.payment_method ? (paymentLabels[t.payment_method] ?? t.payment_method) : '',
            t.note,
          ]
        }),
      )
      if (rows.length === 0) throw new Error('No hay ventas para esos filtros.')

      const headers = [
        'Fecha', 'Evento', 'Tipo', 'Código', 'Diseño', 'Colección', 'Tamaño', 'Material', 'Acabado',
        'Cantidad', 'Precio unitario', 'Subtotal línea', 'Descuento del ticket', 'Total del ticket', 'Medio de pago', 'Nota',
      ]
      downloadCsv(`ventas-${event.code}-${today()}.csv`, toCsv(headers, rows))
      notify(`Archivo descargado (${rows.length} filas).`, 'success')
    } catch (failure) {
      notify(failure instanceof Error ? failure.message : 'No se pudo exportar.', 'error')
    }
    setBusy(false)
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-4 sm:p-5 md:flex-row md:items-center md:gap-5" aria-labelledby="sales-export-title">
      <span aria-hidden className="hidden size-11 shrink-0 items-center justify-center rounded-xl bg-crema text-naranja-dark md:inline-flex">
        <svg width="22" height="22" viewBox="0 0 16 16" fill="none">
          <path d="M8 2v8M4.5 7 8 10.5 11.5 7M3 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <h2 id="sales-export-title" className="text-lg font-semibold">Archivo para tu planilla</h2>
        <p className="hint">Una fila por sticker, para cargar en tu planilla raíz. No modifica ningún dato.</p>
      </div>
      <button type="button" className="btn min-h-12 w-full shrink-0 md:w-auto" disabled={busy || catalog.loading} onClick={() => void download()}>
        {busy ? 'Preparando…' : 'Descargar ventas'}
      </button>
    </section>
  )
}
