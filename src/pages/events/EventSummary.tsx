import type { EventRow, TicketRow } from '../../data/types.ts'
import { useRows } from '../../data/useRows.ts'

interface IncomeRow {
  event_id: string
  income: number
  cash: number
  mercado_pago: number
  deposits: number
}

interface TicketLine {
  ticket_id: string
  quantity: number
}

const money = (value: number) => `$ ${value.toLocaleString('es-AR')}`

/** Totals of one event, computed from the confirmed tickets and the payments ledger. */
export function EventSummary({ event }: { event: EventRow }) {
  const tickets = useRows<TicketRow>('tickets')
  const lines = useRows<TicketLine>('ticket_items')
  const income = useRows<IncomeRow>('event_income')

  const mine = tickets.rows.filter((t) => t.event_id === event.id && t.status === 'confirmed')
  const sales = mine.filter((t) => t.kind === 'sale')
  const gifts = mine.filter((t) => t.kind === 'gift')
  const units = (list: TicketRow[]) => {
    const ids = new Set(list.map((t) => t.id))
    return lines.rows.filter((l) => ids.has(l.ticket_id)).reduce((sum, l) => sum + l.quantity, 0)
  }
  const losses = mine.filter((t) => t.kind === 'loss')
  const discounts =sales.reduce((sum, t) => sum + t.discount_total, 0)
  const paid = income.rows.find((r) => r.event_id === event.id)

  const figures: [string, string][] = [
    ['Ventas', `${sales.length} tickets · ${units(sales)} unidades`],
    ['Regalos', `${gifts.length} tickets · ${units(gifts)} unidades`],
    ['Pérdidas', `${losses.length} registros · ${units(losses)} unidades`],
    ['Descuentos y promos', money(discounts)],
    ['Cobrado', money(paid?.income ?? 0)],
    ['Efectivo', money(paid?.cash ?? 0)],
    ['Mercado Pago', money(paid?.mercado_pago ?? 0)],
  ]

  return (
    <div className="space-y-4">
      <p className="hint">Los totales salen de los tickets confirmados (los anulados no cuentan) y del registro de cobros.</p>
      <dl className="rounded-xl border border-line bg-white px-4">
        {figures.map(([term, value]) => (
          <div key={term} className="flex justify-between gap-3 border-t border-line py-3 text-sm first:border-t-0">
            <dt className="text-muted">{term}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
