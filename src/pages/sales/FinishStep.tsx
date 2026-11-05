import { useState } from 'react'
import { paymentLabels, type EventRow } from '../../data/types.ts'
import { useRows } from '../../data/useRows.ts'
import { useVariantCatalog } from '../../data/useVariantCatalog.ts'
import { CloseCount } from './CloseCount.tsx'
import { RecentTickets } from './RecentTickets.tsx'
import { SalesExport } from './SalesExport.tsx'
import { Steps } from './Steps.tsx'

interface SummaryTicket {
  event_id: string | null
  kind: 'sale' | 'gift' | 'loss'
  status: 'confirmed' | 'voided'
  total: number
  payment_method: string | null
}

interface Props {
  event: EventRow
  /** Units still in the ticket that were never registered. */
  pending: number
  onBack: () => void
  onClosed: () => void
}

const money = (value: number) => `$ ${value.toLocaleString('es-AR')}`

/** Step 3: see how the day went, download the file for the spreadsheet, then close the event. */
export function FinishStep({ event, pending, onBack, onClosed }: Props) {
  const tickets = useRows<SummaryTicket>('tickets')
  const catalog = useVariantCatalog()
  const [ticketsTick, setTicketsTick] = useState(0)

  const mine = tickets.rows.filter((t) => t.event_id === event.id && t.status === 'confirmed')
  const sales = mine.filter((t) => t.kind === 'sale')
  const income = sales.reduce((sum, t) => sum + t.total, 0)
  const byPayment = Object.entries(paymentLabels)
    .map(([method, label]) => ({ label, amount: sales.filter((t) => t.payment_method === method).reduce((sum, t) => sum + t.total, 0) }))
    .filter((row) => row.amount > 0)

  const figures = [
    { label: 'Ventas', value: String(sales.length), detail: money(income) },
    { label: 'Regalos', value: String(mine.filter((t) => t.kind === 'gift').length), detail: 'registros' },
    { label: 'Pérdidas', value: String(mine.filter((t) => t.kind === 'loss').length), detail: 'registros' },
  ]

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Steps current={3} />
      <div>
        <h1 className="text-2xl font-semibold">Finalizar {event.name}</h1>
        <p className="hint">Revisá cómo salió, corregí lo que haya quedado mal, bajá el archivo para tu planilla y cerrá el evento.</p>
      </div>

      <section aria-labelledby="finish-summary" className="space-y-3">
        <h2 id="finish-summary" className="text-lg font-semibold">Resumen</h2>
        <dl className="grid gap-3 sm:grid-cols-3">
          {figures.map((f) => (
            <div key={f.label} className="rounded-2xl border border-line bg-white px-4 py-3">
              <dt className="text-sm text-muted">{f.label}</dt>
              <dd className="text-2xl font-semibold">{f.value}</dd>
              <dd className="text-sm text-muted">{f.detail}</dd>
            </div>
          ))}
        </dl>
        {byPayment.length > 0 && (
          <ul className="rounded-2xl border border-line bg-white px-4">
            {byPayment.map((row) => (
              <li key={row.label} className="flex justify-between gap-3 border-t border-line py-3 text-sm first:border-t-0">
                <span className="text-muted">{row.label}</span>
                <span className="font-medium">{money(row.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <RecentTickets
        key={`recent-${ticketsTick}`}
        event={event}
        items={catalog.items}
        onVoided={() => {
          setTicketsTick((v) => v + 1)
          tickets.reload()
        }}
      />

      <SalesExport event={event} />

      <CloseCount key={`count-${ticketsTick}`} event={event} items={catalog.items} pending={pending} onBack={onBack} onClosed={onClosed} />
    </div>
  )
}
