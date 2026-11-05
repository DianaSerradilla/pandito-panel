import { useState, type ReactNode } from 'react'
import { Drawer } from '../../components/Drawer.tsx'
import { useToast } from '../../components/toast.ts'
import { paymentLabels, type EventRow, type Promotion } from '../../data/types.ts'
import type { VariantInfo } from '../../data/useVariantCatalog.ts'
import { applyPromotions, describeDiscount, isCurrent, type PromoUnit } from '../../lib/promoMatch.ts'
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
  const [withPromo, setWithPromo] = useState(false)
  const [promoId, setPromoId] = useState('')
  const [finalText, setFinalText] = useState('')
  const [priceReason, setPriceReason] = useState('')
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
  // The promotion is chosen by hand: "Sin promo" by default, or one of the current ones.
  const currentPromos = promotions.filter((p) => isCurrent(p))
  const chosen = withPromo ? currentPromos.find((p) => p.id === promoId) : undefined
  const result =
    outcome === 'sale' && chosen ? applyPromotions([chosen], designsOf, promoUnits) : { applied: [], discount: 0, hints: [] }
  const applied = result.applied
  const hints = result.hints
  const promoDiscount = result.discount
  const calculated = subtotal - promoDiscount

  // Final price typed by hand: it can only go below the calculated one, and it needs a reason.
  const typed = finalText.trim() === '' ? null : /^\d+$/.test(finalText.trim()) ? Number(finalText.trim()) : NaN
  const adjusted = outcome === 'sale' && typed !== null && Number.isFinite(typed) && typed < calculated
  const priceProblem =
    outcome !== 'sale' || typed === null ? null
    : Number.isNaN(typed) ? 'Escribí solo números.'
    : typed > calculated ? `Solo se puede bajar el precio (máximo ${money(calculated)}).`
    : adjusted && priceReason.trim() === '' ? 'Contá por qué cambiaste el precio.'
    : null
  const total = outcome === 'sale' ? (adjusted ? (typed as number) : calculated) : 0
  const discount = outcome === 'sale' ? subtotal - total : 0
  const current = outcomes.find((o) => o.value === outcome) ?? outcomes[0]

  async function confirm() {
    if (!supabase || lines.length === 0 || priceProblem) return
    const clientId = newClientId()
    setBusy(true)
    const payload: TicketPayload = {
      p_kind: outcome,
      p_items: lines.map(({ item, qty }) => ({ variant_id: item.id, quantity: qty })),
      p_event_id: event.id,
      p_discount: outcome === 'sale' ? discount : 0,
      p_promo_snapshot:
        applied.length > 0 || adjusted
          ? {
              ...(applied.length > 0
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
                : {}),
              ...(adjusted ? { manual_price: { calculated, final: total, reason: priceReason.trim() } } : {}),
            }
          : null,
      p_payment_method: outcome === 'sale' ? payment : null,
      p_note: note.trim() || null,
    }
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
    setWithPromo(false)
    setPromoId('')
    setFinalText('')
    setPriceReason('')
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
            <button key={o.value} type="button" aria-pressed={outcome === o.value} className={choiceClass(outcome === o.value)} onClick={() => { setOutcome(o.value); setWithPromo(false); setPromoId(''); setFinalText(''); setPriceReason('') }}>
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

      {outcome === 'sale' && (
        <fieldset className="space-y-2">
          <legend className="label">¿Va con promo?</legend>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" aria-pressed={!withPromo} className={choiceClass(!withPromo)} onClick={() => { setWithPromo(false); setPromoId('') }}>
              Sin promo
            </button>
            <button type="button" aria-pressed={withPromo} className={choiceClass(withPromo)} onClick={() => setWithPromo(true)} disabled={currentPromos.length === 0}>
              Con promo
            </button>
          </div>
          {currentPromos.length === 0 && <p className="hint">No hay promos vigentes cargadas.</p>}
          {withPromo && (
            <div role="radiogroup" aria-label="Elegí la promo" className="space-y-2">
              {currentPromos.map((p) => (
                <label key={p.id} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border-2 px-3 py-2 text-sm ${promoId === p.id ? 'border-naranja-dark bg-white' : 'border-line bg-white'}`}>
                  <input type="radio" name="cart-promo" checked={promoId === p.id} onChange={() => setPromoId(p.id)} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{p.name}</span>
                    <span className="block text-xs text-muted">{describeDiscount(p)}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
          {withPromo && !chosen && <p className="hint">Elegí una promo para aplicarla.</p>}
          {chosen && applied.length === 0 && (
            <p role="status" className="rounded-xl bg-amarillo/30 px-3 py-2 text-sm">
              {hints.some((h) => h.promotion.id === chosen.id)
                ? <>Sumá {hints.find((h) => h.promotion.id === chosen.id)?.missing} más y entra <strong>{chosen.name}</strong>.</>
                : <>Con estos stickers no se puede aplicar <strong>{chosen.name}</strong>.</>}
            </p>
          )}
          {applied.map((a) => (
            <p key={`${a.promotion.id}|${a.packPrice}`} className="flex justify-between rounded-xl border-2 border-naranja-dark bg-white px-3 py-2 text-sm">
              <span className="font-medium">{a.promotion.name}{a.times > 1 ? ` ×${a.times}` : ''}</span>
              <span className="font-semibold text-ok">−{money(a.saved)}</span>
            </p>
          ))}
        </fieldset>
      )}

      {outcome === 'sale' && lines.length > 0 && (
        <div className="space-y-2">
          <div>
            <label htmlFor="cart-final" className="label">Precio final (opcional)</label>
            <input
              id="cart-final"
              inputMode="numeric"
              className="input"
              placeholder={String(calculated)}
              value={finalText}
              aria-invalid={priceProblem !== null}
              aria-describedby={priceProblem ? 'cart-final-error' : undefined}
              onChange={(e) => setFinalText(e.target.value)}
            />
            <p className="hint">Dejalo vacío para cobrar {money(calculated)}. Solo se puede bajar.</p>
          </div>
          {adjusted && (
            <div>
              <label htmlFor="cart-final-reason" className="label">¿Por qué cambiaste el precio?</label>
              <input id="cart-final-reason" className="input" value={priceReason} onChange={(e) => setPriceReason(e.target.value)} />
            </div>
          )}
          {priceProblem && <p id="cart-final-error" role="alert" className="text-sm text-danger">{priceProblem}</p>}
        </div>
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
              {promoDiscount > 0 && <p className="flex justify-between text-sm text-ok"><span>Promo</span><span>−{money(promoDiscount)}</span></p>}
              {adjusted && <p className="flex justify-between text-sm text-ok"><span>Ajuste de precio</span><span>−{money(calculated - total)}</span></p>}
            </>
          )}
          <p className="flex items-baseline justify-between text-xl font-semibold">
            <span>{outcome === 'sale' ? 'Total' : `${units} ${units === 1 ? 'sticker' : 'stickers'}`}</span>
            {outcome === 'sale' && <span>{money(total)}</span>}
          </p>
        </div>
        <button type="button" className="btn min-h-14 w-full text-lg" disabled={busy || lines.length === 0 || priceProblem !== null} onClick={() => void confirm()}>
          {busy ? 'Registrando…' : current.confirm}
        </button>
      </footer>
    </Shell>
  )
}
