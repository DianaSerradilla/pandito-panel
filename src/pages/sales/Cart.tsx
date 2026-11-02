import { useState, type ReactNode } from 'react'
import { Drawer } from '../../components/Drawer.tsx'
import { useToast } from '../../components/toast.ts'
import { paymentLabels, type EventRow, type Promotion } from '../../data/types.ts'
import type { VariantInfo } from '../../data/useVariantCatalog.ts'
import { applyPromotions, describeDiscount, type PromoUnit } from '../../lib/promoMatch.ts'
import { isConnectionError, newClientId, queueTicket, type TicketPayload } from '../../lib/pendingTickets.ts'
import { supabase } from '../../lib/supabase.ts'

type Outcome = 'sale' | 'gift' | 'loss'

interface Props {
  asPanel: boolean
  open: boolean
  onClose: () => void
  event: EventRow
  items: VariantInfo[]
  quantities: Record<string, number>
  promotions: Promotion[]
  designsOf: (promotionId: string) => Set<string>
  onChange: (variantId: string, delta: number) => void
  onClear: () => void
  onConfirmed: () => void
}

const money = (value: number) => `$ ${value.toLocaleString('es-AR')}`

const outcomes: { value: Outcome; label: string; confirm: string; done: string }[] = [
  { value: 'sale', label: 'Vendí', confirm: 'Registrar venta', done: 'Venta registrada' },
  { value: 'gift', label: 'Regalé', confirm: 'Registrar regalo', done: 'Regalo registrado.' },
  { value: 'loss', label: 'Perdí', confirm: 'Registrar pérdida', done: 'Pérdida registrada.' },
]

const choiceClass = (selected: boolean) =>
  `min-h-12 rounded-xl border-2 px-3 text-base font-semibold ${
    selected ? 'border-tinta bg-tinta text-crema' : 'border-line bg-white text-tinta hover:bg-crema'
  }`

/** The ticket being built: what happened to the stickers, how it was paid, and the promotion if one fits. */
/** Beside the list on desktop, a full-screen sheet on a phone. */
function Shell({ asPanel, open, onClose, children }: { asPanel: boolean; open: boolean; onClose: () => void; children: ReactNode }) {
  if (asPanel) {
    return (
      <aside aria-label="Ticket" className="flex max-h-[calc(100dvh-2rem)] min-h-0 flex-col rounded-2xl border border-line bg-white lg:sticky lg:top-4">
        {children}
      </aside>
    )
  }
  return <Drawer open={open} label="Ticket" onClose={onClose}>{children}</Drawer>
}

const nowIso = () => new Date().toISOString()

export function Cart({ asPanel, open, onClose, event, items, quantities, promotions, designsOf, onChange, onClear, onConfirmed }: Props) {
  const [outcome, setOutcome] = useState<Outcome>('sale')
  const [payment, setPayment] = useState('cash')
  const [skipPromo, setSkipPromo] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const { notify } = useToast()

  const lines = Object.entries(quantities)
    .map(([id, qty]) => ({ item: items.find((i) => i.id === id), qty }))
    .filter((line): line is { item: VariantInfo; qty: number } => Boolean(line.item))
  const units = lines.reduce((sum, { qty }) => sum + qty, 0)
  const subtotal = lines.reduce((sum, { item, qty }) => sum + (item.price ?? 0) * qty, 0)

  const promoUnits: PromoUnit[] = lines.flatMap(({ item, qty }) =>
    Array.from({ length: qty }, () => ({
      productId: item.productId,
      sizeId: item.sizeId,
      materialId: item.materialId,
      finishId: item.finishId,
      price: item.price ?? 0,
    })),
  )
  const result = outcome === 'sale' ? applyPromotions(promotions, designsOf, promoUnits) : { applied: [], discount: 0, hints: [] }
  const applied = skipPromo ? [] : result.applied
  const hints = result.hints
  const discount = skipPromo ? 0 : result.discount
  const total = outcome === 'sale' ? subtotal - discount : 0
  const current = outcomes.find((o) => o.value === outcome) ?? outcomes[0]

  async function confirm() {
    if (!supabase || lines.length === 0) return
    setBusy(true)
    const payload: TicketPayload = {
      p_kind: outcome,
      p_items: lines.map(({ item, qty }) => ({ variant_id: item.id, quantity: qty })),
      p_event_id: event.id,
      p_discount: outcome === 'sale' ? discount : 0,
      p_promo_snapshot:
        applied.length > 0
          ? {
              promotions: applied.map((a) => ({
                id: a.promotion.id,
                name: a.promotion.name,
                kind: a.promotion.kind,
                times: a.times,
                pack_price: a.packPrice,
                discount: a.saved,
              })),
            }
          : null,
      p_payment_method: outcome === 'sale' ? payment : null,
      p_note: note.trim() || null,
    }
    const clientId = newClientId()
    const { error: failure } = await supabase.rpc('confirm_ticket', { ...payload, p_client_id: clientId })
    setBusy(false)
    let queued = false
    if (failure) {
      if (!isConnectionError(failure)) {
        notify(failure.message, 'error')
        return
      }
      // No signal: keep the ticket on this phone and send it when the connection is back.
      queueTicket({ clientId, eventId: event.id, savedAt: nowIso(), units, total, payload })
      queued = true
    }
    if (queued) notify('Sin conexión: el ticket quedó guardado en este celular y se envía solo.', 'success')
    else notify(outcome === 'sale' ? `${current.done}: ${money(total)}` : current.done, 'success')
    setOutcome('sale')
    setSkipPromo(false)
    setNote('')
    onConfirmed()
    onClose()
  }

  return (
    <Shell asPanel={asPanel} open={open} onClose={onClose}>
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 className="text-lg font-semibold">Ticket</h2>
        <div className="flex items-center gap-1">
          {lines.length > 0 && <button type="button" className="min-h-11 px-3 text-sm underline underline-offset-2" onClick={onClear}>Vaciar</button>}
          {!asPanel && (
            <button type="button" aria-label="Cerrar" onClick={onClose} className="inline-flex size-11 items-center justify-center rounded-lg text-muted hover:bg-crema">
              <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      </header>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4">
      {lines.length === 0 && <p className="hint">Todavía no sumaste stickers. Volvé a la lista y tocá +.</p>}
      {lines.length > 0 && (
        <ul className="rounded-xl border border-line bg-white">
          {lines.map(({ item, qty }) => (
            <li key={item.id} className="flex items-center gap-2 border-t border-line px-3 py-2 first:border-t-0">
              <span className="min-w-0 flex-1 text-sm">
                {item.productName}
                <span className="block text-xs text-muted">{item.sizeName} · {item.materialName} · {item.finishName}</span>
              </span>
              <button type="button" className="btn-quiet size-11 px-0 text-lg" aria-label={`Quitar uno de ${item.productName}`} onClick={() => onChange(item.id, -1)}>−</button>
              <span className="w-7 text-center text-base font-semibold" aria-live="polite">{qty}</span>
              <button type="button" className="btn-quiet size-11 px-0 text-lg" aria-label={`Sumar uno de ${item.productName}`} onClick={() => onChange(item.id, 1)}>+</button>
            </li>
          ))}
        </ul>
      )}

      <fieldset className="space-y-2">
        <legend className="label">¿Qué pasó?</legend>
        <div className="grid grid-cols-3 gap-2">
          {outcomes.map((o) => (
            <button key={o.value} type="button" aria-pressed={outcome === o.value} className={choiceClass(outcome === o.value)} onClick={() => { setOutcome(o.value); setSkipPromo(false) }}>
              {o.label}
            </button>
          ))}
        </div>
      </fieldset>

      {outcome === 'sale' && (
        <fieldset className="space-y-2">
          <legend className="label">¿Cómo pagó?</legend>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(paymentLabels).map(([value, label]) => (
              <button key={value} type="button" aria-pressed={payment === value} className={choiceClass(payment === value)} onClick={() => setPayment(value)}>
                {label}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {outcome === 'sale' && (result.applied.length > 0 || hints.length > 0) && (
        <fieldset className="space-y-2">
          <legend className="label">Promo</legend>
          {result.applied.length > 0 && (
            <div className="space-y-2">
              {result.applied.map((a) => (
                <div key={`${a.promotion.id}|${a.packPrice}`} className={`flex min-h-11 items-center gap-3 rounded-xl border-2 px-3 py-2 text-sm ${skipPromo ? 'border-line bg-white opacity-60' : 'border-naranja-dark bg-white'}`}>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{a.promotion.name}{a.times > 1 ? ` ×${a.times}` : ''}</span>
                    <span className="block text-xs text-muted">{describeDiscount(a.promotion)}</span>
                  </span>
                  <span className="font-semibold text-ok">−{money(a.saved)}</span>
                </div>
              ))}
              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-line bg-white px-3 text-sm">
                <input type="checkbox" checked={skipPromo} onChange={(e) => setSkipPromo(e.target.checked)} />
                Cobrar sin promo
              </label>
            </div>
          )}
          {hints.map((h) => (
            <p key={h.promotion.id} className="rounded-xl bg-amarillo/30 px-3 py-2 text-sm">
              Sumá {h.missing} {h.missing === 1 ? 'más' : 'más'} y entra <strong>{h.promotion.name}</strong>: {describeDiscount(h.promotion)}.
            </p>
          ))}
        </fieldset>
      )}

      <div>
        <label htmlFor="cart-note" className="label">Nota (opcional)</label>
        <input id="cart-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      </div>

      <footer className="space-y-3 border-t border-line bg-surface px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <div className="space-y-1">
          {outcome === 'sale' && discount > 0 && (
            <>
              <p className="flex justify-between text-sm text-muted"><span>Subtotal</span><span>{money(subtotal)}</span></p>
              <p className="flex justify-between text-sm text-ok"><span>Promo</span><span>−{money(discount)}</span></p>
            </>
          )}
          <p className="flex items-baseline justify-between text-xl font-semibold">
            <span>{outcome === 'sale' ? 'Total' : `${units} ${units === 1 ? 'sticker' : 'stickers'}`}</span>
            {outcome === 'sale' && <span>{money(total)}</span>}
          </p>
        </div>
        <button type="button" className="btn min-h-14 w-full text-lg" disabled={busy || lines.length === 0} onClick={() => void confirm()}>
          {busy ? 'Registrando…' : current.confirm}
        </button>
      </footer>
    </Shell>
  )
}
