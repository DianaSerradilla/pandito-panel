import { useState } from 'react'
import { Modal } from '../../components/Modal.tsx'
import { Pager } from '../../components/Pager.tsx'
import { SearchBox } from '../../components/SearchBox.tsx'
import { usePaging } from '../../components/usePaging.ts'
import { useToast } from '../../components/toast.ts'
import { paymentLabels, type EventRow, type TicketRow } from '../../data/types.ts'
import { useRows } from '../../data/useRows.ts'
import type { VariantInfo } from '../../data/useVariantCatalog.ts'
import { supabase } from '../../lib/supabase.ts'

interface TicketItem {
  ticket_id: string
  variant_id: string
  quantity: number
}

interface Props {
  event: EventRow
  items: VariantInfo[]
  onVoided: () => void
}

const money = (value: number) => `$ ${value.toLocaleString('es-AR')}`
const kindLabel = { sale: 'Venta', gift: 'Regalo', loss: 'Pérdida' } as const

/** Tickets of the chosen event. A ticket can be voided here, always with a reason. */
export function RecentTickets({ event, items, onVoided }: Props) {
  const tickets = useRows<TicketRow>('tickets', ['created_at'])
  const lines = useRows<TicketItem>('ticket_items')
  const [search, setSearch] = useState('')
  const [toVoid, setToVoid] = useState<TicketRow | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const { notify } = useToast()

  const name = (id: string) => items.find((i) => i.id === id)?.productName ?? '?'
  const summary = (ticketId: string) =>
    lines.rows.filter((l) => l.ticket_id === ticketId).map((l) => `${l.quantity}× ${name(l.variant_id)}`).join(', ')

  const needle = search.trim().toLowerCase()
  const mine = tickets.rows
    .filter((t) => t.event_id === event.id)
    .reverse()
    .map((t) => ({ ticket: t, detail: summary(t.id) }))
    .filter(({ ticket, detail }) => !needle || detail.toLowerCase().includes(needle) || kindLabel[ticket.kind].toLowerCase().includes(needle))
  const paging = usePaging(mine, 10)

  async function confirmVoid() {
    if (!supabase || !toVoid) return
    setBusy(true)
    const { error: failure } = await supabase.rpc('void_ticket', { p_ticket_id: toVoid.id, p_reason: reason.trim() })
    setBusy(false)
    if (failure) {
      notify(failure.message, 'error')
      return
    }
    notify('Registro anulado.', 'success')
    setToVoid(null)
    setReason('')
    onVoided()
  }

  return (
    <section className="space-y-3" aria-labelledby="tickets-title">
      <h2 id="tickets-title" className="text-lg font-semibold">Registros del evento</h2>
      <SearchBox id="tickets-search" label="Buscar registro" placeholder="Buscar por sticker o tipo" value={search} onChange={(v) => { setSearch(v); paging.setPage(0) }} />
      {tickets.error && <p className="error" role="alert">{tickets.error}</p>}
      {!tickets.loading && mine.length === 0 && <p className="hint">Todavía no hay registros.</p>}
      {mine.length > 0 && (
        <ul className="rounded-2xl border border-line bg-white">
          {paging.paged.map(({ ticket: t, detail }) => (
            <li key={t.id} className="flex items-start gap-3 border-t border-line p-3 first:border-t-0">
              <div className={`min-w-0 flex-1 space-y-1 ${t.status === 'voided' ? 'text-muted line-through' : ''}`}>
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{new Date(t.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
                  {t.status === 'voided' ? (
                    <span className="chip chip-off">Anulado</span>
                  ) : (
                    <span className={`chip ${t.kind === 'sale' ? 'chip-ok' : t.kind === 'gift' ? 'chip-warn' : 'chip-bad'}`}>{kindLabel[t.kind]}</span>
                  )}
                  {t.kind === 'sale' && <span className="font-semibold">{money(t.total)}</span>}
                </p>
                <p className="text-sm">{detail}</p>
                {(t.payment_method || t.promo_snapshot?.promotions?.length) && (
                  <p className="text-xs text-muted">
                    {[t.payment_method ? (paymentLabels[t.payment_method] ?? t.payment_method) : '', t.promo_snapshot?.promotions?.map((p) => p.name).join(', ')]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
              </div>
              {t.status === 'confirmed' && (
                <button type="button" aria-label="Anular registro" title="Anular" className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-danger hover:bg-crema" onClick={() => setToVoid(t)}>
                  <svg aria-hidden width="18" height="18" viewBox="0 0 16 16" fill="none">
                    <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8h5.8l.6-8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <Pager paging={paging} label="registros" id="tickets-page-size" />

      <Modal open={toVoid !== null} title="Anular registro" onClose={() => !busy && setToVoid(null)}>
        <div className="space-y-4">
          <p className="text-sm">El stock vuelve a su lugar y el registro deja de contar en el resumen del evento.</p>
          <div>
            <label htmlFor="void-reason" className="label">Motivo de la anulación</label>
            <input id="void-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-quiet" disabled={busy} onClick={() => setToVoid(null)}>Cancelar</button>
            <button type="button" className="btn" disabled={busy || reason.trim() === ''} onClick={() => void confirmVoid()}>
              {busy ? 'Anulando…' : 'Anular registro'}
            </button>
          </div>
        </div>
      </Modal>
    </section>
  )
}
