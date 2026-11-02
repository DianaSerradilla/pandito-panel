import { useState } from 'react'
import { useVariantCatalog } from '../data/useVariantCatalog.ts'
import { downloadCsv, toCsv } from '../lib/csv.ts'
import { readAll } from '../lib/readAll.ts'
import { supabase } from '../lib/supabase.ts'

const typeLabels: Record<string, string> = {
  intake: 'Ingreso',
  adjustment: 'Ajuste',
  display: 'Exhibición',
  damaged: 'Dañado',
  missing: 'Faltante',
  sale: 'Venta',
  gift: 'Regalo',
  reservation: 'Reserva',
  reservation_release: 'Liberación de reserva',
  reversal: 'Anulación',
  event_out: 'Salida a evento',
  event_return: 'Vuelta de evento',
}

interface Movement {
  id: number
  occurred_at: string
  variant_id: string
  type: string
  reversed_type: string | null
  quantity: number
  event_id: string | null
  order_id: string | null
  note: string | null
  created_by: string | null
}

interface Reconciliation {
  variant_id: string
  carried: number
  sold: number
  gifted: number
  returned: number
  expected_remaining: number
  counted: number | null
  difference: number | null
  note: string | null
}

const today = () => new Date().toLocaleDateString('sv-SE')

/**
 * Read-only CSV exports. Movements use the agreed columns (CLOSE-007); with an event, the closing reconciliation is also offered.
 * Nothing is written to the database.
 */
export function ExportButtons({ eventId, eventCode }: { eventId?: string; eventCode?: string }) {
  const catalog = useVariantCatalog()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; failed: boolean } | null>(null)

  async function lookups() {
    const client = supabase
    if (!client) throw new Error('Falta configurar Supabase.')
    const [variants, staff, events, orders] = await Promise.all([
      readAll<{ id: string; sku: string }>((a, b) => client.from('product_variants').select('id, sku').range(a, b)),
      readAll<{ user_id: string; display_name: string }>((a, b) => client.from('staff').select('user_id, display_name').range(a, b)),
      readAll<{ id: string; code: string }>((a, b) => client.from('events').select('id, code').range(a, b)),
      readAll<{ id: string; number: number }>((a, b) => client.from('orders').select('id, number').range(a, b)),
    ])
    const sku = new Map(variants.map((v) => [v.id, v.sku]))
    const info = new Map(catalog.items.map((i) => [i.id, i]))
    return {
      client,
      sku: (id: string) => sku.get(id) ?? '',
      product: (id: string) => info.get(id)?.productName ?? '',
      variant: (id: string) => info.get(id)?.label ?? '',
      user: (id: string | null) => staff.find((s) => s.user_id === id)?.display_name ?? '',
      event: (id: string | null) => events.find((e) => e.id === id)?.code ?? '',
      order: (id: string | null) => {
        const n = orders.find((o) => o.id === id)?.number
        return n ? `R-${String(n).padStart(3, '0')}` : ''
      },
    }
  }

  async function run(job: () => Promise<void>) {
    setBusy(true)
    setMessage(null)
    try {
      await job()
      setMessage({ text: 'Archivo descargado', failed: false })
    } catch (failure) {
      setMessage({ text: failure instanceof Error ? failure.message : 'No se pudo exportar.', failed: true })
    }
    setBusy(false)
  }

  const exportMovements = () =>
    run(async () => {
      const lookup = await lookups()
      const movements = await readAll<Movement>((a, b) => {
        let query = lookup.client.from('stock_movements').select('*').order('id').range(a, b)
        if (eventId) query = query.eq('event_id', eventId)
        if (from) query = query.gte('occurred_at', new Date(`${from}T00:00:00`).toISOString())
        if (to) query = query.lte('occurred_at', new Date(`${to}T23:59:59`).toISOString())
        return query
      })
      const rows = movements.map((m) => [
        lookup.sku(m.variant_id),
        lookup.product(m.variant_id),
        lookup.variant(m.variant_id),
        m.type === 'reversal' ? `Anulación de ${typeLabels[m.reversed_type ?? ''] ?? m.reversed_type}` : (typeLabels[m.type] ?? m.type),
        m.quantity,
        new Date(m.occurred_at).toLocaleString('es-AR'),
        lookup.event(m.event_id),
        lookup.order(m.order_id),
        lookup.user(m.created_by),
        m.note,
      ])
      const headers = ['SKU', 'Nombre comercial', 'Variante', 'Tipo', 'Cantidad', 'Fecha', 'Evento', 'Pedido', 'Usuario', 'Observación']
      downloadCsv(`movimientos${eventCode ? `-${eventCode}` : ''}-${today()}.csv`, toCsv(headers, rows))
    })

  const exportClosing = () =>
    run(async () => {
      const lookup = await lookups()
      const lines = await readAll<Reconciliation>((a, b) =>
        lookup.client.from('event_reconciliation').select('*').eq('event_id', eventId ?? '').range(a, b),
      )
      const rows = lines.map((r) => [
        lookup.sku(r.variant_id),
        lookup.product(r.variant_id),
        lookup.variant(r.variant_id),
        r.carried,
        r.sold,
        r.gifted,
        r.returned,
        r.expected_remaining,
        r.counted,
        r.difference,
        r.note,
      ])
      const headers = ['SKU', 'Nombre comercial', 'Variante', 'Llevado', 'Vendido', 'Regalado', 'Devuelto', 'Esperado', 'Contado', 'Diferencia', 'Observación']
      downloadCsv(`cierre-${eventCode ?? 'evento'}-${today()}.csv`, toCsv(headers, rows))
    })

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-3">
        {!eventId && (
          <>
            <div className="w-44">
              <label className="label" htmlFor="exp-from">Desde (opcional)</label>
              <input id="exp-from" type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="w-44">
              <label className="label" htmlFor="exp-to">Hasta (opcional)</label>
              <input id="exp-to" type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </>
        )}
        <button type="button" className="btn-quiet" disabled={busy || catalog.loading} onClick={() => void exportMovements()}>
          Descargar movimientos (Excel)
        </button>
        {eventId && (
          <button type="button" className="btn-quiet" disabled={busy || catalog.loading} onClick={() => void exportClosing()}>
            Descargar cierre del evento (Excel)
          </button>
        )}
      </div>
      <p className="hint">Se descarga un archivo CSV que abre Excel. Es solo lectura: no modifica ningún dato.</p>
      {message && <p role={message.failed ? 'alert' : 'status'} className={message.failed ? 'error' : 'hint'}>{message.text}</p>}
    </div>
  )
}
