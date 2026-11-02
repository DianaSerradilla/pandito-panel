import { useState } from 'react'
import { Modal } from '../../components/Modal.tsx'
import { useToast } from '../../components/toast.ts'
import type { EventRow, Promotion } from '../../data/types.ts'
import { useCovers } from '../../data/useCovers.ts'
import { useRows } from '../../data/useRows.ts'
import { useVariantCatalog } from '../../data/useVariantCatalog.ts'
import { supabase } from '../../lib/supabase.ts'
import { Cart } from './Cart.tsx'
import { EventPicker } from './EventPicker.tsx'
import { ProductGrid } from './ProductGrid.tsx'
import { FinishStep } from './FinishStep.tsx'
import { Steps } from './Steps.tsx'
import { useIsDesktop } from './useIsDesktop.ts'

interface EventVariant {
  event_id: string
  variant_id: string
}

interface TicketRef {
  id: string
  event_id: string | null
  status: 'confirmed' | 'voided'
}

interface PromotionProduct {
  promotion_id: string
  product_id: string
}

export function SalesPage() {
  const events = useRows<EventRow>('events')
  const { notify } = useToast()
  // The active event is stored in the database, so a reload or another user lands in the same place.
  const event = events.rows.find((e) => e.status === 'active') ?? null

  async function activate(id: string) {
    if (!supabase) return
    const { error: failure } = await supabase.from('events').update({ status: 'active' }).eq('id', id)
    if (failure) notify(failure.message, 'error')
    events.reload()
  }

  if (!supabase) return null
  if (events.loading) return <p className="hint" role="status">Cargando…</p>
  if (!event) return <EventPicker events={events.rows} onChoose={activate} />
  return <Register event={event} onClosed={events.reload} />
}

function Register({ event, onClosed }: { event: EventRow; onClosed: () => void }) {
  const catalog = useVariantCatalog()
  const hoy = useRows<EventVariant>('event_variants')
  const promotions = useRows<Promotion>('promotions')
  const promotionProducts = useRows<PromotionProduct>('promotion_products')
  const { covers } = useCovers()
  const desktop = useIsDesktop()
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [ticketOpen, setTicketOpen] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  const [busy, setBusy] = useState(false)
  const tickets = useRows<TicketRef>('tickets')
  const { notify } = useToast()

  const hoyIds = new Set(hoy.rows.filter((r) => r.event_id === event.id).map((r) => r.variant_id))
  const designsOf = (promotionId: string) =>
    new Set(promotionProducts.rows.filter((r) => r.promotion_id === promotionId).map((r) => r.product_id))

  const add = (id: string, delta: number) =>
    setQuantities((current) => {
      const next = Math.max(0, (current[id] ?? 0) + delta)
      const { [id]: _removed, ...rest } = current
      return next === 0 ? rest : { ...rest, [id]: next }
    })
  const count = Object.values(quantities).reduce((sum, qty) => sum + qty, 0)
  const subtotal = Object.entries(quantities).reduce(
    (sum, [id, qty]) => sum + (catalog.items.find((i) => i.id === id)?.price ?? 0) * qty,
    0,
  )

  const registered = tickets.rows.filter((t) => t.event_id === event.id && t.status === 'confirmed')

  // For when the wrong event was picked: undo what was registered and put the event back to planned.
  async function discard() {
    if (!supabase) return
    setBusy(true)
    for (const ticket of registered) {
      const { error: failure } = await supabase.rpc('void_ticket', { p_ticket_id: ticket.id, p_reason: 'Evento elegido por error' })
      if (failure) {
        setBusy(false)
        notify(failure.message, 'error')
        return
      }
    }
    const { error: failure } = await supabase.from('events').update({ status: 'planned' }).eq('id', event.id)
    setBusy(false)
    if (failure) {
      notify(failure.message, 'error')
      return
    }
    notify('Listo, elegí el evento correcto.', 'success')
    setQuantities({})
    setDiscarding(false)
    onClosed()
  }

  if (finishing) {
    return <FinishStep event={event} pending={count} onBack={() => setFinishing(false)} onClosed={onClosed} />
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-24 lg:pb-0">
      <Steps current={2} />
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold">{event.name}</h1>
          <p className="hint truncate">{event.code}{event.location ? ` · ${event.location}` : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Descartar y empezar de nuevo"
            title="Descartar y empezar de nuevo"
            className="inline-flex size-11 items-center justify-center rounded-xl border-2 border-line bg-white text-danger hover:bg-crema"
            onClick={() => {
              tickets.reload()
              setDiscarding(true)
            }}
          >
            <svg aria-hidden width="20" height="20" viewBox="0 0 16 16" fill="none">
              <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8h5.8l.6-8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button type="button" className="btn-quiet min-h-11" onClick={() => setFinishing(true)}>Finalizar evento</button>
        </div>
      </header>

      <Modal open={discarding} title="Descartar y empezar de nuevo" onClose={() => !busy && setDiscarding(false)}>
        <div className="space-y-4">
          <p className="text-sm">
            <strong>{event.name}</strong> vuelve a Planificado y salís de Ventas para elegir otro evento. Se vacía el ticket
            {registered.length > 0 ? (
              <> y se anulan los <strong>{registered.length}</strong> {registered.length === 1 ? 'registro' : 'registros'} ya cargados (el stock vuelve a su lugar)</>
            ) : (
              <>; todavía no hay nada registrado</>
            )}
            .
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" className="btn-quiet min-h-12" disabled={busy} onClick={() => setDiscarding(false)}>Seguir en este evento</button>
            <button type="button" className="btn min-h-12" disabled={busy} onClick={() => void discard()}>{busy ? 'Descartando…' : 'Descartar todo'}</button>
          </div>
        </div>
      </Modal>

      {catalog.error && <p className="error" role="alert">{catalog.error}</p>}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <ProductGrid
          eventId={event.id}
          items={catalog.items}
          covers={covers}
          quantities={quantities}
          hoyIds={hoyIds}
          loading={catalog.loading || hoy.loading}
          onChange={add}
        />
        <Cart
          asPanel={desktop}
          open={ticketOpen}
          onClose={() => setTicketOpen(false)}
          event={event}
          items={catalog.items}
          quantities={quantities}
          promotions={promotions.rows.filter((p) => p.active)}
          designsOf={designsOf}
          onChange={add}
          onClear={() => {
            setQuantities({})
            setTicketOpen(false)
          }}
          onConfirmed={() => setQuantities({})}
        />
      </div>

      {!desktop && count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <button type="button" className="btn mx-auto flex min-h-14 w-full max-w-2xl items-center justify-between px-5 text-lg" onClick={() => setTicketOpen(true)}>
            <span>Ver ticket · {count} {count === 1 ? 'sticker' : 'stickers'}</span>
            <span>$ {subtotal.toLocaleString('es-AR')}</span>
          </button>
        </div>
      )}
    </div>
  )
}
